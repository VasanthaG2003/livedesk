import type { CookieOptions, Response } from 'express'
import type { Env } from '../config/env'
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from '../services/auth.service'

export const ACCESS_COOKIE = 'ld_access'
export const REFRESH_COOKIE = 'ld_refresh'

function base(env: Env): CookieOptions {
  return {
    httpOnly: true, // not readable by JavaScript, so XSS can't steal it
    secure: env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // not sent on cross-site POSTs (CSRF protection)
  }
}

// The refresh token is only sent to the GraphQL endpoint (where refreshSession
// lives), never to static assets or other paths.
const REFRESH_PATH = '/graphql'

export function setAuthCookies(res: Response, env: Env, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base(env),
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  })
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base(env),
    path: REFRESH_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  })
}

export function clearAuthCookies(res: Response, env: Env) {
  res.clearCookie(ACCESS_COOKIE, { ...base(env), path: '/' })
  res.clearCookie(REFRESH_COOKIE, { ...base(env), path: REFRESH_PATH })
}
