import { triageRequestSchema, type TriageRequest } from '@livedesk/shared'
import { createLimiter } from '../../lib/rate-limit'
import * as ai from '../../services/ai.service'
import { requireUser, type GqlContext } from '../context'

/*
 *   aiStatus       any signed-in user
 *   triageTicket   customer (≤ 10/min per user)
 *   draftReply     agent (own/unassigned), admin (≤ 10/min per user)
 */

// Each call costs money, so cap it per user (not per IP: offices share IPs).
const aiLimit = createLimiter({
  limit: 10,
  windowMs: 60_000,
  message: 'Too many AI requests. Try again in a minute.',
})

export const aiResolvers = {
  Query: {
    aiStatus: (_: unknown, __: unknown, ctx: GqlContext) => {
      requireUser(ctx)
      return { enabled: ai.aiEnabled() }
    },
  },
  Mutation: {
    triageTicket: (_: unknown, args: { input: TriageRequest }, ctx: GqlContext) => {
      const user = requireUser(ctx, 'customer')
      aiLimit(user.id, ctx.env.NODE_ENV !== 'test')
      return ai.triage(triageRequestSchema.parse(args.input))
    },
    async draftReply(_: unknown, args: { ticketId: string }, ctx: GqlContext) {
      const user = requireUser(ctx, 'agent', 'admin')
      aiLimit(user.id, ctx.env.NODE_ENV !== 'test')
      return (await ai.draftReply(user, args.ticketId)).draft
    },
  },
}
