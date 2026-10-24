import {
  createTicketSchema,
  listTicketsQuerySchema,
  objectIdSchema,
  rateTicketSchema,
  replySchema,
  savedReplySchema,
  updateTicketSchema,
  type CreateTicketInput,
  type RateTicketInput,
  type ReplyInput,
  type SavedReplyInput,
  type UpdateTicketInput,
} from '@livedesk/shared'
import { createLimiter } from '../../lib/rate-limit'
import { publishTyping } from '../../realtime'
import * as savedReplies from '../../services/saved-reply.service'
import * as tickets from '../../services/ticket.service'
import { requireUser, type GqlContext } from '../context'

/*
 * Access per operation (resource-level rules live in ticket.service.ts):
 *   tickets / ticket / messages / activity   any signed-in user; customers see only their own
 *   createTicket                             customer
 *   updateTicket                             agent (own/unassigned), admin
 *   sendMessage                              owner customer, agent (own/unassigned), admin;
 *                                            internal: true = staff-only note, any staff
 *   markRead, setTyping                      anyone who can view the ticket
 *   rateTicket                               owner customer, once, when resolved/closed
 *   agents, savedReplies (+ create/delete)   agent, admin
 */

type TicketListArgs = {
  filter?: Record<string, unknown> | null
  page?: number | null
  pageSize?: number | null
}

// Typing events are cheap but chatty; one per user per second is plenty.
const typingLimit = createLimiter({ limit: 1, windowMs: 1000, message: 'Slow down' })

export const ticketResolvers = {
  Query: {
    tickets: (_: unknown, args: TicketListArgs, ctx: GqlContext) =>
      tickets.listTickets(
        requireUser(ctx),
        listTicketsQuerySchema.parse({
          ...args.filter,
          ...(args.page != null && { page: args.page }),
          ...(args.pageSize != null && { pageSize: args.pageSize }),
        }),
      ),
    ticket: (_: unknown, args: { id: string }, ctx: GqlContext) =>
      tickets.getTicket(requireUser(ctx), args.id),
    messages: (_: unknown, args: { ticketId: string }, ctx: GqlContext) =>
      tickets.listMessages(requireUser(ctx), args.ticketId),
    activity: (_: unknown, args: { ticketId: string }, ctx: GqlContext) =>
      tickets.listActivity(requireUser(ctx), args.ticketId),
    agents: (_: unknown, __: unknown, ctx: GqlContext) => {
      requireUser(ctx, 'agent', 'admin')
      return tickets.listAgents()
    },
    savedReplies: (_: unknown, __: unknown, ctx: GqlContext) =>
      savedReplies.listSavedReplies(requireUser(ctx, 'agent', 'admin')),
  },

  Mutation: {
    createTicket: (_: unknown, args: { input: CreateTicketInput }, ctx: GqlContext) =>
      tickets.createTicket(requireUser(ctx, 'customer'), createTicketSchema.parse(args.input)),

    updateTicket: (_: unknown, args: { id: string; input: UpdateTicketInput }, ctx: GqlContext) => {
      const user = requireUser(ctx, 'agent', 'admin')
      // GraphQL sends "not provided" as absent and "unassign" as null; keep that distinction.
      const input = Object.fromEntries(
        Object.entries(args.input).filter(([k, v]) => v !== null || k === 'assignedAgentId'),
      )
      return tickets.updateTicket(user, args.id, updateTicketSchema.parse(input))
    },

    sendMessage: (_: unknown, args: { ticketId: string; input: ReplyInput }, ctx: GqlContext) => {
      const user = requireUser(ctx)
      const { body, internal } = replySchema.parse({
        ...args.input,
        internal: args.input.internal ?? undefined,
      })
      return tickets.addMessage(user, args.ticketId, body, internal)
    },

    markRead: (_: unknown, args: { ticketId: string }, ctx: GqlContext) =>
      tickets.markRead(requireUser(ctx), args.ticketId),

    rateTicket: (_: unknown, args: { ticketId: string; input: RateTicketInput }, ctx: GqlContext) =>
      tickets.rateTicket(
        requireUser(ctx, 'customer'),
        args.ticketId,
        rateTicketSchema.parse({ ...args.input, comment: args.input.comment ?? undefined }),
      ),

    /** Typing indicator for a ticket you can see. Published to that ticket's room only. */
    async setTyping(_: unknown, args: { ticketId: string; typing: boolean }, ctx: GqlContext) {
      const user = requireUser(ctx)
      const ticketId = objectIdSchema.parse(args.ticketId)
      if (args.typing) typingLimit(`${user.id}:${ticketId}`)
      await tickets.loadVisibleTicket(user, ticketId)
      publishTyping(ticketId, { id: user.id, name: user.name, role: user.role }, args.typing)
      return true
    },

    createSavedReply: (_: unknown, args: { input: SavedReplyInput }, ctx: GqlContext) =>
      savedReplies.createSavedReply(
        requireUser(ctx, 'agent', 'admin'),
        savedReplySchema.parse(args.input),
      ),

    async deleteSavedReply(_: unknown, args: { id: string }, ctx: GqlContext) {
      await savedReplies.deleteSavedReply(requireUser(ctx, 'agent', 'admin'), args.id)
      return true
    },
  },
}
