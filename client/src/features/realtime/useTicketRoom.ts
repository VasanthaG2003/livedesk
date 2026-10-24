import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserRef } from '@livedesk/shared'
import { gql } from '@/lib/api'
import { M, S } from '@/lib/operations'
import { useRealtime } from './RealtimeContext'

const TYPING_TIMEOUT_MS = 5000

interface RoomEvent {
  type: 'typing' | 'viewers'
  typing: boolean | null
  user: UserRef | null
  viewers: UserRef[] | null
}

/**
 * Subscribes to a ticket's room while the page is open — the subscription
 * itself is what counts as "viewing". graphql-ws re-subscribes after a
 * reconnect. Returns who else is viewing, who is typing, and a typing sender.
 */
export function useTicketRoom(ticketId: string, myId: string) {
  const { client } = useRealtime()
  const [viewers, setViewers] = useState<UserRef[]>([])
  const [typing, setTyping] = useState<UserRef[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    if (!client) return
    const timersMap = timers.current
    const stop = client.subscribe<{ ticketRoom: RoomEvent }>(
      { query: S.ticketRoom, variables: { ticketId } },
      {
        next: ({ data }) => {
          const e = data?.ticketRoom
          if (!e) return
          if (e.type === 'viewers') return setViewers(e.viewers ?? [])
          const user = e.user
          if (!user) return
          clearTimeout(timersMap.get(user.id))
          setTyping((list) => [
            ...list.filter((u) => u.id !== user.id),
            ...(e.typing ? [user] : []),
          ])
          if (e.typing) {
            // If the "stopped typing" event never arrives (closed tab), clear it anyway.
            timersMap.set(
              user.id,
              setTimeout(
                () => setTyping((list) => list.filter((u) => u.id !== user.id)),
                TYPING_TIMEOUT_MS,
              ),
            )
          }
        },
        error: () => {},
        complete: () => {},
      },
    )
    return () => {
      stop()
      for (const t of timersMap.values()) clearTimeout(t)
      timersMap.clear()
    }
  }, [client, ticketId])

  const sendTyping = useCallback(
    (isTyping: boolean) => void gql(M.setTyping, { ticketId, typing: isTyping }).catch(() => {}),
    [ticketId],
  )

  return {
    viewers: viewers.filter((v) => v.id !== myId),
    typing: typing.filter((u) => u.id !== myId),
    sendTyping,
  }
}
