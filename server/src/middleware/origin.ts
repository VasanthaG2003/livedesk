import type { RequestHandler } from 'express'
import type { Env } from '../config/env'
import { HttpError } from '../lib/http-error'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Defence in depth against CSRF on top of SameSite cookies and Apollo's CSRF
 * prevention: a browser request that changes data must come from one of our
 * own origins. Requests without an Origin header (curl, server-to-server)
 * carry no victim's cookies.
 */
export function requireTrustedOrigin(env: Env): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin')
    if (!SAFE_METHODS.has(req.method) && origin && !env.CLIENT_ORIGINS.includes(origin)) {
      throw new HttpError(403, 'BAD_ORIGIN', 'Request origin not allowed')
    }
    next()
  }
}
