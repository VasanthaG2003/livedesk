import { createContext, useContext } from 'react'
import type { Client } from 'graphql-ws'
import type { LiveNotification } from '@livedesk/shared'
import type { ConnectionState } from '@/components/layout/ConnectionIndicator'

export interface RealtimeValue {
  client: Client | null
  connection: ConnectionState
  onlineAgentIds: string[]
  notifications: LiveNotification[]
  unreadNotifications: number
  markNotificationsSeen: () => void
}

export const RealtimeContext = createContext<RealtimeValue | null>(null)

export function useRealtime(): RealtimeValue {
  const value = useContext(RealtimeContext)
  if (!value) throw new Error('useRealtime must be used inside <RealtimeProvider>')
  return value
}
