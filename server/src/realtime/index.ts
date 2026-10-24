/**
 * The one place that pushes live events. Services call these helpers *after*
 * their database writes succeed; they publish to an in-process PubSub, and the
 * GraphQL subscription resolvers (graphql/resolvers/subscriptions.ts) decide —
 * per connection, with withFilter — who may receive each event.
 *
 * Publishing is unconditional and filtering happens on delivery: a subscription
 * resolver is the only gatekeeper, because GraphQL subscriptions do not run the
 * query resolvers' authorisation checks for pushed payloads.
 *
 * The in-memory PubSub is fine for one server process. Running several API
 * instances would need a shared engine (e.g. Redis) behind the same interface.
 */
import { randomUUID } from 'node:crypto'
import { PubSub } from 'graphql-subscriptions'
import type { WebSocket } from 'ws'
import {
  STATUS_LABELS,
  type LiveNotification,
  type NotificationKind,
  type TicketMessage,
  type TicketStatus,
  type TicketSummary,
  type UserRef,
} from '@livedesk/shared'

export const pubsub = new PubSub()

export const topics = {
  ticketEvent: 'TICKET_EVENT',
  notification: 'NOTIFICATION',
  presence: 'AGENT_PRESENCE',
  room: (ticketId: string) => `TICKET_ROOM:${ticketId}`,
} as const

export type TicketEventType =
  'created' | 'updated' | 'assigned' | 'status_changed' | 'rated' | 'message'

export interface TicketEventPayload {
  ticketEvents: {
    type: TicketEventType
    ticket: TicketSummary
    message: TicketMessage | null
    from: TicketStatus | null
    to: TicketStatus | null
    assignedTo: UserRef | null
    by: UserRef | null
  }
}

export interface NotificationPayload {
  notifications: LiveNotification
  /** User ids, or "staff" for every agent and admin. */
  recipients: string[] | 'staff'
}

export interface RoomPayload {
  ticketRoom: {
    type: 'typing' | 'viewers'
    user: UserRef | null
    typing: boolean | null
    viewers: UserRef[] | null
  }
  /** Who caused it, so people don't see their own typing indicator. */
  fromUserId: string | null
}

function publishTicket(
  event: Partial<TicketEventPayload['ticketEvents']> &
    Pick<TicketEventPayload['ticketEvents'], 'type' | 'ticket'>,
) {
  const payload: TicketEventPayload = {
    ticketEvents: { message: null, from: null, to: null, assignedTo: null, by: null, ...event },
  }
  void pubsub.publish(topics.ticketEvent, payload)
}

function notify(
  recipients: NotificationPayload['recipients'],
  kind: NotificationKind,
  ticket: TicketSummary,
  title: string,
  body: string,
) {
  if (Array.isArray(recipients)) {
    recipients = [...new Set(recipients.filter(Boolean))]
    if (recipients.length === 0) return
  }
  const notification: LiveNotification = {
    id: randomUUID(),
    kind,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title,
    body,
    createdAt: new Date().toISOString(),
  }
  void pubsub.publish(topics.notification, {
    notifications: notification,
    recipients,
  } satisfies NotificationPayload)
}

const firstName = (name: string) => name.split(' ')[0] ?? name

// ---------------------------------------------------------------------------
// Presence: which agents have a live connection, and who is viewing a ticket.

const onlineAgents = new Map<string, number>()

export function onlineAgentIds() {
  return [...onlineAgents.keys()]
}

function publishPresence() {
  void pubsub.publish(topics.presence, { agentPresence: onlineAgentIds() })
}

export function agentConnected(id: string) {
  onlineAgents.set(id, (onlineAgents.get(id) ?? 0) + 1)
  publishPresence()
}

export function agentDisconnected(id: string) {
  const left = (onlineAgents.get(id) ?? 1) - 1
  if (left > 0) onlineAgents.set(id, left)
  else onlineAgents.delete(id)
  publishPresence()
}

/** ticketId → userId → { user, number of open subscriptions } */
const viewers = new Map<string, Map<string, { user: UserRef; count: number }>>()

export function viewersOf(ticketId: string): UserRef[] {
  return [...(viewers.get(ticketId)?.values() ?? [])].map((v) => v.user)
}

function publishViewers(ticketId: string) {
  const payload: RoomPayload = {
    ticketRoom: { type: 'viewers', user: null, typing: null, viewers: viewersOf(ticketId) },
    fromUserId: null,
  }
  void pubsub.publish(topics.room(ticketId), payload)
}

export function joinTicket(ticketId: string, user: UserRef) {
  const room = viewers.get(ticketId) ?? new Map()
  const entry = room.get(user.id) ?? { user, count: 0 }
  entry.count++
  room.set(user.id, entry)
  viewers.set(ticketId, room)
  publishViewers(ticketId)
}

export function leaveTicket(ticketId: string, userId: string) {
  const room = viewers.get(ticketId)
  const entry = room?.get(userId)
  if (!room || !entry) return
  if (--entry.count <= 0) room.delete(userId)
  if (room.size === 0) viewers.delete(ticketId)
  publishViewers(ticketId)
}

export function publishTyping(ticketId: string, user: UserRef, typing: boolean) {
  const payload: RoomPayload = {
    ticketRoom: { type: 'typing', user, typing, viewers: null },
    fromUserId: user.id,
  }
  void pubsub.publish(topics.room(ticketId), payload)
}

// ---------------------------------------------------------------------------
// Open WebSockets per user, so a deactivated user can be cut off at once.

const socketsByUser = new Map<string, Set<WebSocket>>()

export function trackSocket(userId: string, socket: WebSocket) {
  const set = socketsByUser.get(userId) ?? new Set()
  set.add(socket)
  socketsByUser.set(userId, set)
  socket.once('close', () => {
    set.delete(socket)
    if (set.size === 0) socketsByUser.delete(userId)
  })
}

/** For tests: forget all in-memory state. */
export function resetRealtime() {
  onlineAgents.clear()
  viewers.clear()
  socketsByUser.clear()
}

// ---------------------------------------------------------------------------

export const realtime = {
  ticketCreated(ticket: TicketSummary) {
    publishTicket({ type: 'created', ticket })
    notify(
      'staff',
      'created',
      ticket,
      `New ticket ${ticket.ticketNumber}`,
      `${ticket.customer.name}: ${ticket.subject}`,
    )
  },

  ticketUpdated(
    ticket: TicketSummary,
    by: UserRef,
    changes: {
      status?: { from: TicketStatus; to: TicketStatus }
      assignedTo?: UserRef | null
    } = {},
  ) {
    publishTicket({ type: 'updated', ticket, by })
    if (changes.assignedTo !== undefined) {
      publishTicket({ type: 'assigned', ticket, by, assignedTo: changes.assignedTo })
      if (changes.assignedTo && changes.assignedTo.id !== by.id) {
        notify(
          [changes.assignedTo.id],
          'assigned',
          ticket,
          `${ticket.ticketNumber} assigned to you`,
          `${by.name} assigned "${ticket.subject}" to you`,
        )
      }
    }
    if (changes.status) {
      publishTicket({ type: 'status_changed', ticket, by, ...changes.status })
      if (by.role !== 'customer') {
        notify(
          [ticket.customer.id],
          'status',
          ticket,
          `${ticket.ticketNumber} is now ${STATUS_LABELS[changes.status.to]}`,
          ticket.subject,
        )
      }
    }
  },

  message(message: TicketMessage, ticket: TicketSummary) {
    // Internal notes are published like any message; the subscription filter
    // only delivers them to staff.
    publishTicket({ type: 'message', ticket, message, by: message.author })
    if (message.internal) return
    const preview = message.body.length > 80 ? `${message.body.slice(0, 80)}…` : message.body
    if (message.author.role === 'customer') {
      if (ticket.assignedAgent) {
        notify(
          [ticket.assignedAgent.id],
          'message',
          ticket,
          `${firstName(message.author.name)} replied on ${ticket.ticketNumber}`,
          preview,
        )
      }
    } else {
      notify(
        [ticket.customer.id],
        'message',
        ticket,
        `New reply on ${ticket.ticketNumber}`,
        `${firstName(message.author.name)}: ${preview}`,
      )
    }
  },

  ticketRated(ticket: TicketSummary, score: number) {
    publishTicket({ type: 'rated', ticket })
    if (ticket.assignedAgent) {
      notify(
        [ticket.assignedAgent.id],
        'status',
        ticket,
        `${firstName(ticket.customer.name)} rated ${ticket.ticketNumber} ${'★'.repeat(score)}${'☆'.repeat(5 - score)}`,
        ticket.subject,
      )
    }
  },

  /** e.g. read receipts: no notification, just fresh state for whoever is watching. */
  ticketTouched(ticket: TicketSummary) {
    publishTicket({ type: 'updated', ticket })
  },

  /** Deactivated user or password change: close their live connections at once. */
  disconnectUser(userId: string) {
    for (const socket of socketsByUser.get(userId) ?? []) socket.close(4403, 'Forbidden')
  },
}
