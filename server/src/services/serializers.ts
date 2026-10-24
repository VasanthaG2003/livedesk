// Converts database records into API response shapes. Building responses
// field by field means internal fields (passwordHash, __v, …) can never leak.
import type { Types } from 'mongoose'
import type {
  PublicUser,
  Role,
  TicketActivity,
  TicketActivityAction,
  TicketCategory,
  TicketDetail,
  TicketMessage,
  TicketPriority,
  TicketRating,
  TicketStatus,
  TicketSummary,
  UserRef,
} from '@livedesk/shared'
import type { AuthUser } from '../types/auth'

interface UserLike {
  _id: Types.ObjectId
  name: string
  role: Role
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

/** A deleted user still renders as something sensible. */
export function toUserRef(user: UserLike | null | undefined): UserRef {
  if (!user) return { id: '', name: 'Deleted user', role: 'customer' }
  return { id: user._id.toString(), name: user.name, role: user.role }
}

export function toPublicUser(
  user: (UserLike & { email: string; isActive: boolean; createdAt: Date }) | AuthUser,
): PublicUser {
  return {
    id: 'id' in user ? user.id : user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }
}

/** A ticket with customerId / assignedAgentId populated. */
export interface PopulatedTicket {
  _id: Types.ObjectId
  ticketNumber: string
  subject: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  customerId: UserLike | null
  assignedAgentId: UserLike | null
  firstResponseAt?: Date | null
  firstResponseDueAt?: Date | null
  resolvedAt?: Date | null
  closedAt?: Date | null
  lastMessageAt?: Date | null
  lastMessageFrom?: 'customer' | 'staff' | null
  customerReadAt?: Date | null
  staffReadAt?: Date | null
  rating?: { score: number; comment?: string | null; ratedAt: Date } | null
  createdAt: Date
  updatedAt: Date
}

export function toTicketSummary(t: PopulatedTicket): TicketSummary {
  return {
    id: t._id.toString(),
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    customer: toUserRef(t.customerId),
    assignedAgent: t.assignedAgentId ? toUserRef(t.assignedAgentId) : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    firstResponseDueAt: iso(t.firstResponseDueAt),
    firstResponseAt: iso(t.firstResponseAt),
    lastMessageAt: iso(t.lastMessageAt),
    lastMessageFrom: t.lastMessageFrom ?? null,
    customerReadAt: iso(t.customerReadAt),
    staffReadAt: iso(t.staffReadAt),
  }
}

export function toTicketDetail(t: PopulatedTicket): TicketDetail {
  return {
    ...toTicketSummary(t),
    description: t.description,
    resolvedAt: iso(t.resolvedAt),
    closedAt: iso(t.closedAt),
    rating: t.rating
      ? {
          score: t.rating.score as TicketRating['score'],
          comment: t.rating.comment ?? null,
          ratedAt: t.rating.ratedAt.toISOString(),
        }
      : null,
  }
}

export function toMessage(m: {
  _id: Types.ObjectId
  ticketId: Types.ObjectId
  authorId: UserLike | null
  body: string
  internal?: boolean
  createdAt: Date
}): TicketMessage {
  return {
    id: m._id.toString(),
    ticketId: m.ticketId.toString(),
    author: toUserRef(m.authorId),
    body: m.body,
    internal: m.internal ?? false,
    createdAt: m.createdAt.toISOString(),
  }
}

export function toActivity(a: {
  _id: Types.ObjectId
  ticketId: Types.ObjectId
  actorId: UserLike | null
  action: TicketActivityAction
  previousValue?: string | null
  newValue?: string | null
  createdAt: Date
}): TicketActivity {
  return {
    id: a._id.toString(),
    ticketId: a.ticketId.toString(),
    actor: toUserRef(a.actorId),
    action: a.action,
    previousValue: a.previousValue ?? null,
    newValue: a.newValue ?? null,
    createdAt: a.createdAt.toISOString(),
  }
}
