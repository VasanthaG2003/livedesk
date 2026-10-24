import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Client } from 'graphql-ws'
import { toast } from 'sonner'
import type { LiveNotification, Role, TicketMessage, TicketSummary } from '@livedesk/shared'
import type { ConnectionState } from '@/components/layout/ConnectionIndicator'
import { S } from '@/lib/operations'
import { applyMessage, applyTicket } from './cache'
import { RealtimeContext, type RealtimeValue } from './RealtimeContext'
import { createLiveClient } from './socket'

const MAX_NOTIFICATIONS = 30

interface TicketEvent {
  type: 'created' | 'updated' | 'assigned' | 'status_changed' | 'rated' | 'message'
  ticket: TicketSummary
  message: TicketMessage | null
}

/** Subscribes and returns the unsubscribe function. */
function listen<T>(client: Client, query: string, onData: (data: T) => void) {
  return client.subscribe<T>(
    { query },
    {
      next: (result) => result.data && onData(result.data as T),
      error: () => {},
      complete: () => {},
    },
  )
}

/**
 * One graphql-ws connection per signed-in tab. Subscription events update the
 * TanStack Query cache, so every screen re-renders from the same data whether
 * it arrived over HTTP or live.
 */
export function RealtimeProvider({ role, children }: { role: Role; children: ReactNode }) {
  const qc = useQueryClient()
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [onlineAgentIds, setOnlineAgentIds] = useState<string[]>([])
  const [notifications, setNotifications] = useState<LiveNotification[]>([])
  const [seenCount, setSeenCount] = useState(0)
  // Created once; it opens the WebSocket lazily when the effect below subscribes.
  const [client] = useState(() =>
    createLiveClient({
      onConnecting: () => setConnection('connecting'),
      onConnected: (reconnected) => {
        setConnection('connected')
        // Anything could have changed while we were away: refetch what's on screen.
        if (reconnected) void qc.invalidateQueries()
      },
      onClosed: () => setConnection(navigator.onLine ? 'connecting' : 'disconnected'),
    }),
  )

  useEffect(() => {
    const stops = [
      listen<{ ticketEvents: TicketEvent }>(client, S.ticketEvents, ({ ticketEvents: e }) =>
        e.message ? applyMessage(qc, e.message, e.ticket) : applyTicket(qc, e.ticket),
      ),
      listen<{ notifications: LiveNotification }>(
        client,
        S.notifications,
        ({ notifications: n }) => {
          setNotifications((list) => [n, ...list].slice(0, MAX_NOTIFICATIONS))
          // No pop-up for the ticket you're already looking at.
          if (!window.location.pathname.includes(n.ticketId))
            toast(n.title, { description: n.body })
        },
      ),
      ...(role === 'customer'
        ? []
        : [
            listen<{ agentPresence: string[] }>(client, S.agentPresence, (d) =>
              setOnlineAgentIds(d.agentPresence),
            ),
          ]),
    ]
    // Unsubscribing from everything also closes the socket (lazy client).
    return () => {
      for (const stop of stops) stop()
    }
  }, [client, qc, role])

  const value = useMemo<RealtimeValue>(
    () => ({
      client,
      connection,
      onlineAgentIds,
      notifications,
      unreadNotifications: Math.max(0, notifications.length - seenCount),
      markNotificationsSeen: () => setSeenCount(notifications.length),
    }),
    [client, connection, onlineAgentIds, notifications, seenCount],
  )

  return <RealtimeContext value={value}>{children}</RealtimeContext>
}
