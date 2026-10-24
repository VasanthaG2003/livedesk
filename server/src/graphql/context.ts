import type { Request, Response } from 'express'
import { GraphQLError } from 'graphql'
import { errors as joseErrors } from 'jose'
import type { Role } from '@livedesk/shared'
import type { Env } from '../config/env'
import { ACCESS_COOKIE } from '../lib/cookies'
import { UserModel } from '../models/user.model'
import { verifyAccessToken } from '../services/auth.service'
import type { AuthUser } from '../types/auth'

export interface GqlContext {
  env: Env
  /** Null when signed out. Loaded from the database on every operation. */
  user: AuthUser | null
  /** Why `user` is null when a session cookie was sent. */
  authError: 'TOKEN_EXPIRED' | 'UNAUTHENTICATED' | null
  ip: string
  /** HTTP only: used to set and clear the session cookies. */
  req?: Request
  res?: Response
}

export async function loadActiveUser(id: string): Promise<AuthUser | null> {
  const user = await UserModel.findById(id).lean()
  if (!user || !user.isActive) return null
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }
}

/** HTTP context: the user comes from the HttpOnly access-token cookie. */
export async function httpContext(env: Env, req: Request, res: Response): Promise<GqlContext> {
  const base = { env, req, res, ip: req.ip ?? 'unknown' }
  const token: unknown = req.cookies?.[ACCESS_COOKIE]
  if (typeof token !== 'string' || !token) return { ...base, user: null, authError: null }
  try {
    const userId = await verifyAccessToken(token, env.JWT_ACCESS_SECRET)
    const user = await loadActiveUser(userId)
    return { ...base, user, authError: user ? null : 'UNAUTHENTICATED' }
  } catch (err) {
    const authError = err instanceof joseErrors.JWTExpired ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED'
    return { ...base, user: null, authError }
  }
}

/** The signed-in user, optionally restricted to some roles. */
export function requireUser(ctx: GqlContext, ...roles: Role[]): AuthUser {
  if (!ctx.user) {
    const expired = ctx.authError === 'TOKEN_EXPIRED'
    throw new GraphQLError(expired ? 'Your session has expired' : 'Authentication required', {
      extensions: { code: expired ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED', status: 401 },
    })
  }
  if (roles.length > 0 && !roles.includes(ctx.user.role)) {
    throw new GraphQLError('You do not have permission to do that', {
      extensions: { code: 'FORBIDDEN', status: 403 },
    })
  }
  return ctx.user
}

export function requireHttp(ctx: GqlContext): { req: Request; res: Response } {
  if (!ctx.req || !ctx.res) {
    throw new GraphQLError('This operation must be sent over HTTP', {
      extensions: { code: 'BAD_REQUEST', status: 400 },
    })
  }
  return { req: ctx.req, res: ctx.res }
}
