/**
 * Subscriptions don't go through the query resolvers, so nothing above checks
 * who receives a pushed payload. Every subscription here authorises twice:
 *  1. when it starts (subscribe): is this user allowed to listen at all?
 *  2. for every event (withFilter): may *this* connection see *this* payload?
 */
import { withFilter } from 'graphql-subscriptions'
import { objectIdSchema } from '@livedesk/shared'
import {
  joinTicket,
  leaveTicket,
  onlineAgentIds,
  pubsub,
  topics,
  viewersOf,
  type NotificationPayload,
  type RoomPayload,
  type TicketEventPayload,
} from '../../realtime'
import { loadVisibleTicket } from '../../services/ticket.service'
import type { AuthUser } from '../../types/auth'
import { requireUser, type GqlContext } from '../context'
import { onEnd, startWith } from '../iterators'

const isStaff = (u: AuthUser) => u.role !== 'customer'

/** withFilter's types make every argument optional; a subscription always has a context. */
function contextOf(ctx: GqlContext | undefined): GqlContext {
  if (!ctx) throw new Error('Subscription started without a context')
  return ctx
}

/** May `user` receive this ticket event? Mirrors the REST/GraphQL read rules. */
export function canReceiveTicketEvent(user: AuthUser, { ticketEvents: e }: TicketEventPayload) {
  if (isStaff(user)) return true
  // Customers: only their own tickets, and never internal notes.
  return e.ticket.customer.id === user.id && !e.message?.internal
}

export function canReceiveNotification(user: AuthUser, payload: NotificationPayload) {
  return payload.recipients === 'staff' ? isStaff(user) : payload.recipients.includes(user.id)
}

export const subscriptionResolvers = {
  Subscription: {
    ticketEvents: {
      subscribe: withFilter<TicketEventPayload, unknown, GqlContext>(
        (_?: unknown, __?: unknown, ctx?: GqlContext) => {
          requireUser(contextOf(ctx))
          return pubsub.asyncIterableIterator(topics.ticketEvent)
        },
        (payload: TicketEventPayload | undefined, _args: unknown, ctx: GqlContext | undefined) =>
          !!payload && !!ctx?.user && canReceiveTicketEvent(ctx.user, payload),
      ),
    },

    notifications: {
      subscribe: withFilter<NotificationPayload, unknown, GqlContext>(
        (_?: unknown, __?: unknown, ctx?: GqlContext) => {
          requireUser(contextOf(ctx))
          return pubsub.asyncIterableIterator(topics.notification)
        },
        (payload: NotificationPayload | undefined, _args: unknown, ctx: GqlContext | undefined) =>
          !!payload && !!ctx?.user && canReceiveNotification(ctx.user, payload),
      ),
    },

    ticketRoom: {
      subscribe: withFilter<RoomPayload, { ticketId?: string }, GqlContext>(
        async (_?: unknown, args?: { ticketId?: string }, ctx?: GqlContext) => {
          const user = requireUser(contextOf(ctx))
          const ticketId = objectIdSchema.parse(args?.ticketId)
          // Same rule as the ticket query: someone else's ticket is "not found".
          await loadVisibleTicket(user, ticketId)
          const inner = pubsub.asyncIterableIterator<RoomPayload>(topics.room(ticketId))
          joinTicket(ticketId, { id: user.id, name: user.name, role: user.role })
          const initial: RoomPayload = {
            ticketRoom: { type: 'viewers', user: null, typing: null, viewers: viewersOf(ticketId) },
            fromUserId: null,
          }
          return startWith(
            initial,
            onEnd(inner, () => leaveTicket(ticketId, user.id)),
          )
        },
        // Nobody needs to see their own typing indicator.
        (payload: RoomPayload | undefined, _args: unknown, ctx: GqlContext | undefined) =>
          !!payload && payload.fromUserId !== ctx?.user?.id,
      ),
    },

    agentPresence: {
      subscribe: (_: unknown, __: unknown, ctx: GqlContext) => {
        requireUser(ctx, 'agent', 'admin')
        return startWith(
          { agentPresence: onlineAgentIds() },
          pubsub.asyncIterableIterator<{ agentPresence: string[] }>(topics.presence),
        )
      },
    },
  },
}
