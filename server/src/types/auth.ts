import type { Role } from '@livedesk/shared'

/** The signed-in user, loaded fresh from the database for every operation. */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: Date
}
