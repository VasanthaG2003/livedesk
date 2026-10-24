import type { Role } from '@livedesk/shared'
import { homeFor } from './api'

/**
 * Where to go after signing in. `next` must be a path inside this app for that
 * role, so a crafted link like /login?next=https://evil.example can't redirect away.
 */
export function afterSignIn(role: Role, next: string | null) {
  const home = homeFor(role)
  if (next && (next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`))) {
    return next
  }
  return home
}
