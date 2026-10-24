import type { Response } from 'express'
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
} from '@livedesk/shared'
import type { Env } from '../../config/env'
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '../../lib/cookies'
import { HttpError, badRequest, conflict, unauthorized } from '../../lib/http-error'
import { createLimiter } from '../../lib/rate-limit'
import { UserModel } from '../../models/user.model'
import {
  burnPasswordCheck,
  createSession,
  hashPassword,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  signAccessToken,
  signSocketToken,
  verifyPassword,
} from '../../services/auth.service'
import { toPublicUser } from '../../services/serializers'
import { realtime } from '../../realtime'
import { requireHttp, requireUser, type GqlContext } from '../context'

// Slows down password guessing and sign-up spam (per IP).
const authLimit = createLimiter({
  limit: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Too many attempts. Try again in a few minutes.',
})
const limited = (ctx: GqlContext, op: string) =>
  authLimit(`${op}:${ctx.ip}`, ctx.env.NODE_ENV !== 'test')

const isDuplicateKey = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 11000

async function startSession(
  res: Response,
  env: Env,
  user: { _id: { toString(): string }; role: 'customer' | 'agent' | 'admin' },
) {
  const userId = user._id.toString()
  const [access, refresh] = await Promise.all([
    signAccessToken(userId, user.role, env.JWT_ACCESS_SECRET),
    createSession(userId),
  ])
  setAuthCookies(res, env, access, refresh)
}

export const authResolvers = {
  Query: {
    me: (_: unknown, __: unknown, ctx: GqlContext) => (ctx.user ? toPublicUser(ctx.user) : null),
  },

  Mutation: {
    /** Public. Always creates a customer: the input type has no role field. */
    async register(_: unknown, args: { input: RegisterInput }, ctx: GqlContext) {
      const { res } = requireHttp(ctx)
      limited(ctx, 'register')
      const input = registerSchema.parse(args.input)
      if (await UserModel.exists({ email: input.email })) {
        throw conflict('An account with this email already exists', 'EMAIL_TAKEN')
      }
      let user
      try {
        user = await UserModel.create({
          ...input,
          passwordHash: await hashPassword(input.password),
          role: 'customer',
        })
      } catch (err) {
        if (isDuplicateKey(err))
          throw conflict('An account with this email already exists', 'EMAIL_TAKEN')
        throw err
      }
      await startSession(res, ctx.env, user)
      return toPublicUser(user)
    },

    /** Public. The same message for "no such email" and "wrong password". */
    async login(_: unknown, args: { input: LoginInput }, ctx: GqlContext) {
      const { res } = requireHttp(ctx)
      limited(ctx, 'login')
      const input = loginSchema.parse(args.input)
      const user = await UserModel.findOne({ email: input.email }).select('+passwordHash')
      if (!user) {
        await burnPasswordCheck(input.password)
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password')
      }
      if (!(await verifyPassword(user.passwordHash, input.password))) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password')
      }
      if (!user.isActive)
        throw new HttpError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated')
      await startSession(res, ctx.env, user)
      return toPublicUser(user)
    },

    /** Uses the refresh cookie; rotates it. */
    async refreshSession(_: unknown, __: unknown, ctx: GqlContext) {
      const { req, res } = requireHttp(ctx)
      const token: unknown = req.cookies?.[REFRESH_COOKIE]
      if (typeof token !== 'string' || !token) throw unauthorized('No session')

      const result = await rotateSession(token)
      if (!result.ok) {
        if (result.reason === 'raced') {
          // Another tab refreshed a moment ago and the browser already holds the new cookie.
          throw new HttpError(409, 'REFRESH_RACED', 'Session was just refreshed; retry')
        }
        clearAuthCookies(res, ctx.env)
        throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again')
      }
      const user = await UserModel.findById(result.userId)
      if (!user || !user.isActive) {
        await revokeSession(result.token)
        clearAuthCookies(res, ctx.env)
        throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again')
      }
      const access = await signAccessToken(result.userId, user.role, ctx.env.JWT_ACCESS_SECRET)
      setAuthCookies(res, ctx.env, access, result.token)
      return toPublicUser(user)
    },

    /** Ends this device's session. Works even when already signed out. */
    async logout(_: unknown, __: unknown, ctx: GqlContext) {
      const { req, res } = requireHttp(ctx)
      const token: unknown = req.cookies?.[REFRESH_COOKIE]
      if (typeof token === 'string' && token) await revokeSession(token)
      clearAuthCookies(res, ctx.env)
      return true
    },

    /** Signs out every other device, including their live connections. */
    async changePassword(_: unknown, args: { input: ChangePasswordInput }, ctx: GqlContext) {
      const me = requireUser(ctx)
      const { res } = requireHttp(ctx)
      limited(ctx, 'change-password')
      const input = changePasswordSchema.parse(args.input)
      const user = await UserModel.findById(me.id).select('+passwordHash')
      if (!user) throw unauthorized()
      if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
        throw badRequest('Current password is incorrect', {
          currentPassword: 'Current password is incorrect',
        })
      }
      user.passwordHash = await hashPassword(input.newPassword)
      await user.save()
      await revokeAllSessions(me.id, 'password_changed')
      realtime.disconnectUser(me.id)
      await startSession(res, ctx.env, user)
      return true
    },

    /** A 60-second token for opening the subscriptions WebSocket. */
    async subscriptionToken(_: unknown, __: unknown, ctx: GqlContext) {
      return signSocketToken(requireUser(ctx).id, ctx.env.JWT_SOCKET_SECRET)
    },
  },
}
