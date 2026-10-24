import { createHash, randomBytes, randomUUID } from 'node:crypto'
import argon2 from 'argon2'
import { SignJWT, jwtVerify } from 'jose'
import type { Types } from 'mongoose'
import type { Role } from '@livedesk/shared'
import { SessionModel, type RevokeReason } from '../models/session.model'

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const AUDIENCE = 'livedesk:api'

// ---------- Passwords ----------

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id })
}

export function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password)
}

let dummyHash: Promise<string> | undefined
/**
 * Verifies against a throwaway hash when the email doesn't exist, so a login
 * for an unknown email takes as long as one with a wrong password and response
 * timing doesn't reveal which emails are registered.
 */
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(randomUUID())
  await argon2.verify(await dummyHash, password)
}

// ---------- Access tokens (short-lived JWT in an HttpOnly cookie) ----------

const keyCache = new Map<string, Uint8Array>()
const key = (secret: string) => {
  let k = keyCache.get(secret)
  if (!k) keyCache.set(secret, (k = new TextEncoder().encode(secret)))
  return k
}

export function signAccessToken(userId: string, role: Role, secret: string) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key(secret))
}

/** Returns the user id. Throws jose errors (e.g. JWTExpired) for bad tokens. */
export async function verifyAccessToken(token: string, secret: string) {
  const { payload } = await jwtVerify(token, key(secret), {
    algorithms: ['HS256'],
    audience: AUDIENCE,
  })
  if (!payload.sub) throw new Error('Token has no subject')
  return payload.sub
}

// ---------- Socket tokens (60 s, only good for opening one WebSocket) ----------

const SOCKET_AUDIENCE = 'livedesk:socket'

export function signSocketToken(userId: string, secret: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setAudience(SOCKET_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(key(secret))
}

export async function verifySocketToken(token: string, secret: string) {
  const { payload } = await jwtVerify(token, key(secret), {
    algorithms: ['HS256'],
    audience: SOCKET_AUDIENCE,
  })
  if (!payload.sub) throw new Error('Token has no subject')
  return payload.sub
}

// ---------- Refresh tokens (opaque, stored hashed, rotated on every use) ----------

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export async function createSession(
  userId: string | Types.ObjectId,
  familyId: string = randomUUID(),
) {
  const token = randomBytes(32).toString('base64url')
  await SessionModel.create({
    userId,
    familyId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  })
  return token
}

/** If an old token is presented within this window, assume two tabs refreshed at once. */
const CONCURRENT_REFRESH_GRACE_MS = 10_000

export type RotateResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'raced' | 'reused' }

export async function rotateSession(token: string): Promise<RotateResult> {
  const tokenHash = sha256(token)
  const now = new Date()

  // Atomically claim the token: only one request can revoke it.
  const claimed = await SessionModel.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: now, revokedReason: 'rotated' } },
  )

  if (!claimed) {
    const existing = await SessionModel.findOne({ tokenHash })
    // Logged out, password changed, or already caught as stolen: just sign in again.
    if (!existing || existing.revokedReason !== 'rotated' || !existing.revokedAt) {
      return { ok: false, reason: 'invalid' }
    }
    if (now.getTime() - existing.revokedAt.getTime() < CONCURRENT_REFRESH_GRACE_MS) {
      return { ok: false, reason: 'raced' }
    }
    // An already-rotated token came back long after: it was probably stolen.
    // End every session in this login family so the thief's copy stops working too.
    await revokeFamily(existing.familyId, 'reuse_detected')
    return { ok: false, reason: 'reused' }
  }

  if (claimed.expiresAt <= now) return { ok: false, reason: 'expired' }

  const next = await createSession(claimed.userId, claimed.familyId)
  return { ok: true, userId: claimed.userId.toString(), token: next }
}

const revoke = (reason: RevokeReason) => ({ revokedAt: new Date(), revokedReason: reason })

async function revokeFamily(familyId: string, reason: RevokeReason) {
  await SessionModel.updateMany({ familyId, revokedAt: null }, revoke(reason))
}

export async function revokeSession(token: string) {
  await SessionModel.updateOne({ tokenHash: sha256(token), revokedAt: null }, revoke('logout'))
}

export async function revokeAllSessions(userId: string, reason: RevokeReason) {
  await SessionModel.updateMany({ userId, revokedAt: null }, revoke(reason))
}
