import {
  createAgentSchema,
  statsQuerySchema,
  userListQuerySchema,
  type CreateAgentInput,
  type Role,
} from '@livedesk/shared'
import * as stats from '../../services/stats.service'
import * as users from '../../services/user.service'
import { requireUser, type GqlContext } from '../context'

/*
 *   adminStats, users, auditLog, activityFeed, setUserActive, createAgent   admin
 *   customers                                                             agent, admin (read-only)
 *   myStats                                                               agent
 */

type StatsArgs = { days?: number | null; tz?: string | null }
const statsQuery = (args: StatsArgs) =>
  statsQuerySchema.parse({
    ...(args.days != null && { days: args.days }),
    ...(args.tz != null && { tz: args.tz }),
  })

type ListArgs = { role?: Role; q?: string | null; page?: number | null }
const listQuery = (role: Role, args: ListArgs) =>
  userListQuerySchema.parse({
    role,
    q: args.q ?? undefined,
    ...(args.page != null && { page: args.page }),
  })

export const adminResolvers = {
  Query: {
    adminStats: (_: unknown, args: StatsArgs, ctx: GqlContext) => {
      requireUser(ctx, 'admin')
      return stats.adminStats(statsQuery(args))
    },
    myStats: (_: unknown, args: StatsArgs, ctx: GqlContext) =>
      stats.myStats(requireUser(ctx, 'agent').id, statsQuery(args)),
    users: (_: unknown, args: ListArgs & { role: Role }, ctx: GqlContext) => {
      requireUser(ctx, 'admin')
      return users.listUsers(listQuery(args.role, args))
    },
    customers: (_: unknown, args: ListArgs, ctx: GqlContext) => {
      requireUser(ctx, 'agent', 'admin')
      return users.listUsers(listQuery('customer', args))
    },
    auditLog: (_: unknown, __: unknown, ctx: GqlContext) => {
      requireUser(ctx, 'admin')
      return users.listAudit()
    },
    activityFeed: (_: unknown, __: unknown, ctx: GqlContext) => {
      requireUser(ctx, 'admin')
      return users.activityFeed()
    },
  },

  Mutation: {
    setUserActive: (_: unknown, args: { id: string; isActive: boolean }, ctx: GqlContext) =>
      users.setUserActive(requireUser(ctx, 'admin'), args.id, args.isActive),
    createAgent: (_: unknown, args: { input: CreateAgentInput }, ctx: GqlContext) =>
      users.createAgent(requireUser(ctx, 'admin'), createAgentSchema.parse(args.input)),
  },
}
