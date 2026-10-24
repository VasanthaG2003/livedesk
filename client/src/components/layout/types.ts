import type { LucideIcon } from 'lucide-react'
import type { Role } from '@livedesk/shared'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Match the path exactly (used for index routes like the dashboard). */
  end?: boolean
}

export interface ShellUser {
  name: string
  role: Role
}

export type ShellTone = 'light' | 'dark'
