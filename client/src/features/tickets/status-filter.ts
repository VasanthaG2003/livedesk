import type { TicketStatus } from '@livedesk/shared'

export type StatusFilter = TicketStatus | 'all'

export function countByStatus(tickets: { status: TicketStatus }[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: tickets.length,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  }
  for (const t of tickets) counts[t.status]++
  return counts
}
