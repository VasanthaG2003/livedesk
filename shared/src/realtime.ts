// Socket.IO event contract, shared by server and client so payloads can't drift.
import type { TicketStatus } from './constants'
import type { TicketMessage, TicketSummary, UserRef } from './types'

export type NotificationKind = 'created' | 'message' | 'assigned' | 'status'

export interface LiveNotification {
  id: string
  kind: NotificationKind
  ticketId: string
  ticketNumber: string
  title: string
  body: string
  createdAt: string
}

export type JoinResult = { ok: true; viewers: UserRef[] } | { ok: false; error: string }

/** Events the server sends. Every one is emitted only after the database write succeeded. */
export interface ServerToClientEvents {
  'ticket:created': (p: { ticket: TicketSummary }) => void
  'ticket:updated': (p: { ticket: TicketSummary }) => void
  'ticket:assigned': (p: { ticket: TicketSummary; assignedTo: UserRef | null; by: UserRef }) => void
  'ticket:statusChanged': (p: {
    ticket: TicketSummary
    from: TicketStatus
    to: TicketStatus
    by: UserRef
  }) => void
  'ticket:message': (p: { message: TicketMessage; ticket: TicketSummary }) => void
  'ticket:typing': (p: { ticketId: string; user: UserRef; typing: boolean }) => void
  'ticket:viewers': (p: { ticketId: string; viewers: UserRef[] }) => void
  'presence:agents': (p: { onlineAgentIds: string[] }) => void
  notification: (p: LiveNotification) => void
}

/** Events the client may send. The server checks permissions for each one. */
export interface ClientToServerEvents {
  'ticket:join': (p: { ticketId: string }, ack: (result: JoinResult) => void) => void
  'ticket:leave': (p: { ticketId: string }) => void
  'ticket:typing': (p: { ticketId: string; typing: boolean }) => void
}

/** Whether `ticket` has a chat message the viewer hasn't read yet. */
export function isUnread(ticket: TicketSummary, viewer: 'customer' | 'staff'): boolean {
  if (!ticket.lastMessageAt || !ticket.lastMessageFrom || ticket.lastMessageFrom === viewer)
    return false
  const readAt = viewer === 'customer' ? ticket.customerReadAt : ticket.staffReadAt
  return !readAt || readAt < ticket.lastMessageAt
}
