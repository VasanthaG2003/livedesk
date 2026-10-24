import type { QueryClient } from '@tanstack/react-query'
import type { TicketDetail, TicketMessage, TicketSummary } from '@livedesk/shared'
import { ticketKeys } from '@/features/tickets/api'

/**
 * Applies a ticket from a socket event to the cache. Older versions are
 * ignored, so out-of-order or duplicate events can't roll the UI back.
 * Read receipts don't change updatedAt, so an equal timestamp still applies.
 */
export function applyTicket(qc: QueryClient, ticket: TicketSummary) {
  qc.setQueryData<TicketDetail>(ticketKeys.detail(ticket.id), (old) =>
    old && old.updatedAt > ticket.updatedAt ? old : old ? { ...old, ...ticket } : old,
  )
  // Events carry the summary fields only; if this ticket is open on screen,
  // refetch its full details (rating, description, resolvedAt…).
  void qc.invalidateQueries({ queryKey: ticketKeys.detail(ticket.id), exact: true })
  // Lists and dashboards re-sort and re-count on the server; refetch the ones on screen.
  void qc.invalidateQueries({ queryKey: ticketKeys.lists })
  void qc.invalidateQueries({ queryKey: ['admin'] })
  void qc.invalidateQueries({ queryKey: ['stats'] })
}

export function applyMessage(qc: QueryClient, message: TicketMessage, ticket: TicketSummary) {
  qc.setQueryData<TicketMessage[]>(ticketKeys.messages(ticket.id), (old) =>
    old && !old.some((m) => m.id === message.id) ? [...old, message] : old,
  )
  applyTicket(qc, ticket)
  void qc.invalidateQueries({ queryKey: ticketKeys.activity(ticket.id) })
}
