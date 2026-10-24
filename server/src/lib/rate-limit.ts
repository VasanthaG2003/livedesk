import { HttpError } from './http-error'

/**
 * Fixed-window limiter for individual GraphQL operations (express-rate-limit
 * works per URL, and every GraphQL operation shares one URL).
 */
export function createLimiter({
  limit,
  windowMs,
  message,
}: {
  limit: number
  windowMs: number
  message: string
}) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return function check(key: string, enabled = true) {
    if (!enabled) return
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
      }
      return
    }
    if (++entry.count > limit) throw new HttpError(429, 'RATE_LIMITED', message)
  }
}
