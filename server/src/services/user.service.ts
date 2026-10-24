import { Types } from 'mongoose'
import type {
  ActivityFeedItem,
  AuditAction,
  AuditEntry,
  CreateAgentInput,
  PageMeta,
  UserListItem,
  UserListQuery,
} from '@livedesk/shared'
import { badRequest, conflict, notFound } from '../lib/http-error'
import { AuditLogModel } from '../models/audit-log.model'
import { TicketActivityModel } from '../models/ticket-activity.model'
import { TicketModel } from '../models/ticket.model'
import { UserModel } from '../models/user.model'
import { realtime } from '../realtime'
import type { AuthUser } from '../types/auth'
import { hashPassword, revokeAllSessions } from './auth.service'
import { toActivity, toPublicUser, toUserRef } from './serializers'

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Users of one role with their ticket counts. Customers: raised; agents: assigned. */
export async function listUsers(query: UserListQuery) {
  const filter: Record<string, unknown> = { role: query.role }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i')
    filter.$or = [{ name: pattern }, { email: pattern }]
  }
  const { page, pageSize } = query
  const [total, users] = await Promise.all([
    UserModel.countDocuments(filter),
    UserModel.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ])

  const key = query.role === 'customer' ? '$customerId' : '$assignedAgentId'
  const stats = await TicketModel.aggregate<{
    _id: Types.ObjectId
    total: number
    open: number
    last: Date
  }>([
    { $match: { [key.slice(1)]: { $in: users.map((u) => u._id) } } },
    {
      $group: {
        _id: key,
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $in: ['$status', ['open', 'in_progress']] }, 1, 0] } },
        last: { $max: '$updatedAt' },
      },
    },
  ])
  const byId = new Map(stats.map((s) => [s._id.toString(), s]))

  const data: UserListItem[] = users.map((u) => {
    const s = byId.get(u._id.toString())
    return {
      ...toPublicUser(u),
      totalTickets: s?.total ?? 0,
      openTickets: s?.open ?? 0,
      lastActivityAt: s ? s.last.toISOString() : null,
    }
  })
  const meta: PageMeta = {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
  return { data, meta }
}

async function audit(actorId: string, action: AuditAction, targetUserId: Types.ObjectId | string) {
  await AuditLogModel.create({ actorId, action, targetUserId })
}

/**
 * Deactivating signs the user out everywhere at once: refresh tokens are
 * revoked, every request re-checks isActive, and live sockets are dropped.
 */
export async function setUserActive(actor: AuthUser, id: string, isActive: boolean) {
  if (!Types.ObjectId.isValid(id)) throw notFound('User not found')
  if (actor.id === id) throw badRequest("You can't change your own account status")
  const user = await UserModel.findById(id)
  if (!user) throw notFound('User not found')
  if (user.isActive === isActive) return toPublicUser(user)

  user.isActive = isActive
  await user.save()
  if (!isActive) {
    await revokeAllSessions(id, 'account_deactivated')
    realtime.disconnectUser(id)
  }
  await audit(actor.id, isActive ? 'user.activated' : 'user.deactivated', user._id)
  return toPublicUser(user)
}

/** Admins create agent accounts (there is no public sign-up for staff). */
export async function createAgent(actor: AuthUser, input: CreateAgentInput) {
  if (await UserModel.exists({ email: input.email })) {
    throw conflict('An account with this email already exists', 'EMAIL_TAKEN')
  }
  const agent = await UserModel.create({
    name: input.name,
    email: input.email,
    role: 'agent',
    passwordHash: await hashPassword(input.password),
  })
  await audit(actor.id, 'agent.created', agent._id)
  return toPublicUser(agent)
}

const FEED_LIMIT = 50

export async function listAudit(): Promise<AuditEntry[]> {
  const rows = await AuditLogModel.find()
    .sort({ createdAt: -1 })
    .limit(FEED_LIMIT)
    .populate([
      { path: 'actorId', select: 'name role' },
      { path: 'targetUserId', select: 'name role' },
    ])
    .lean()
  type Row = {
    _id: Types.ObjectId
    actorId: Parameters<typeof toUserRef>[0]
    targetUserId: Parameters<typeof toUserRef>[0]
    action: AuditAction
    createdAt: Date
  }
  return (rows as unknown as Row[]).map((r) => ({
    id: r._id.toString(),
    actor: toUserRef(r.actorId),
    action: r.action,
    target: r.targetUserId ? toUserRef(r.targetUserId) : null,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** Latest ticket activity across all tickets. */
export async function activityFeed(): Promise<ActivityFeedItem[]> {
  const rows = await TicketActivityModel.find()
    .sort({ createdAt: -1 })
    .limit(FEED_LIMIT)
    .populate([
      { path: 'actorId', select: 'name role' },
      { path: 'ticketId', select: 'ticketNumber subject' },
    ])
    .lean()
  type Row = Parameters<typeof toActivity>[0] & {
    ticketId: { _id: Types.ObjectId; ticketNumber: string; subject: string } | null
  }
  return (rows as unknown as Row[])
    .filter((r) => r.ticketId)
    .map((r) => ({
      ...toActivity({ ...r, ticketId: r.ticketId!._id }),
      ticketNumber: r.ticketId!.ticketNumber,
      ticketSubject: r.ticketId!.subject,
    }))
}
