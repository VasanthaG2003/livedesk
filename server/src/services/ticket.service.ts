import mongoose, { Types, type PopulateOptions } from 'mongoose'
import {
  FIRST_RESPONSE_SLA_MINUTES,
  canTransition,
  type CreateTicketInput,
  type ListTicketsQuery,
  type PageMeta,
  type RateTicketInput,
  type TicketActivityAction,
  type TicketPriority,
  type TicketListResponse,
  type TicketStatus,
  type UpdateTicketInput,
} from '@livedesk/shared'
import { HttpError, badRequest, conflict, forbidden, notFound } from '../lib/http-error'
import { nextSequence } from '../models/counter.model'
import { TicketActivityModel } from '../models/ticket-activity.model'
import { TicketMessageModel } from '../models/ticket-message.model'
import { TicketModel, type TicketDoc } from '../models/ticket.model'
import { UserModel } from '../models/user.model'
import { realtime } from '../realtime'
import type { AuthUser } from '../types/auth'
import {
  toActivity,
  toMessage,
  toTicketDetail,
  toTicketSummary,
  type PopulatedTicket,
} from './serializers'

/*
 * Access policy (enforced here, never only in the UI):
 * - customer: sees and writes in their own tickets only. Anything else is a 404,
 *   so a guessed id doesn't even reveal that the ticket exists.
 * - agent:    sees every ticket (shared queue). Can reply to / change a ticket
 *   that is unassigned or assigned to them. Replying to an unassigned ticket
 *   takes it.
 * - admin:    sees and changes everything, including reassigning between agents.
 * - closed tickets are read-only for everyone.
 */

const TICKET_NUMBER_OFFSET = 1000 // first ticket is TK-1001
const userRefFields = 'name role'
const ticketPopulate: PopulateOptions[] = [
  { path: 'customerId', select: userRefFields },
  { path: 'assignedAgentId', select: userRefFields },
]

const isStaff = (u: AuthUser) => u.role === 'agent' || u.role === 'admin'
const ref = (u: AuthUser) => ({ id: u.id, name: u.name, role: u.role })

/** SLA: when the first staff reply is due for a ticket created at `createdAt`. */
const firstResponseDue = (priority: TicketPriority, createdAt: Date) =>
  new Date(createdAt.getTime() + FIRST_RESPONSE_SLA_MINUTES[priority] * 60_000)

function parseId(id: string) {
  // An invalid id can't match anything: answer exactly like a missing ticket.
  if (!Types.ObjectId.isValid(id)) throw notFound('Ticket not found')
  return new Types.ObjectId(id)
}

/** Loads a ticket the user may view, or throws 404. Also used to authorise socket rooms. */
export async function loadVisibleTicket(actor: AuthUser, id: string): Promise<TicketDoc> {
  const ticket = await TicketModel.findById(parseId(id))
  if (!ticket) throw notFound('Ticket not found')
  if (actor.role === 'customer' && !ticket.customerId.equals(actor.id)) {
    throw notFound('Ticket not found')
  }
  return ticket
}

function assertAgentMayWork(actor: AuthUser, ticket: TicketDoc) {
  if (
    actor.role === 'agent' &&
    ticket.assignedAgentId &&
    !ticket.assignedAgentId.equals(actor.id)
  ) {
    throw new HttpError(403, 'NOT_ASSIGNED', 'This ticket is assigned to another agent')
  }
}

function assertNotClosed(ticket: TicketDoc) {
  if (ticket.status === 'closed') {
    throw conflict('This ticket is closed and can no longer be changed', 'TICKET_CLOSED')
  }
}

/** Keeps resolvedAt / closedAt consistent with the status. */
function applyStatus(ticket: TicketDoc, status: TicketStatus, now: Date) {
  ticket.status = status
  if (status === 'resolved') ticket.resolvedAt = now
  if (status === 'closed') {
    ticket.closedAt = now
    ticket.resolvedAt ??= now
  }
  if (status === 'open' || status === 'in_progress') {
    ticket.resolvedAt = null
    ticket.closedAt = null
  }
}

interface ActivityInput {
  action: TicketActivityAction
  previousValue?: string | null
  newValue?: string | null
}

async function recordActivity(ticketId: Types.ObjectId, actorId: string, entries: ActivityInput[]) {
  if (entries.length === 0) return
  await TicketActivityModel.insertMany(entries.map((e) => ({ ticketId, actorId, ...e })))
}

async function populated(ticket: TicketDoc): Promise<PopulatedTicket> {
  await ticket.populate(ticketPopulate)
  return ticket.toObject() as unknown as PopulatedTicket
}

function saveWithConcurrency(ticket: TicketDoc) {
  return ticket.save().catch((err: unknown) => {
    if (err instanceof mongoose.Error.VersionError) {
      throw conflict('Someone else updated this ticket. Reload and try again.', 'STALE_TICKET')
    }
    throw err
  })
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------------------------------------------------------------------------

export async function createTicket(actor: AuthUser, input: CreateTicketInput) {
  const seq = await nextSequence('ticket')
  const now = new Date()
  const ticket = await TicketModel.create({
    ...input,
    ticketNumber: `TK-${TICKET_NUMBER_OFFSET + seq}`,
    status: 'open',
    customerId: actor.id, // always the caller — never taken from the request
    firstResponseDueAt: firstResponseDue(input.priority, now),
  })
  await recordActivity(ticket._id, actor.id, [{ action: 'created' }])
  const detail = toTicketDetail(await populated(ticket))
  realtime.ticketCreated(detail)
  return detail
}

export async function listTickets(actor: AuthUser, query: ListTicketsQuery) {
  const filter: Record<string, unknown> = {}

  if (actor.role === 'customer') {
    filter.customerId = new Types.ObjectId(actor.id)
  } else {
    if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId)
    if (query.assignee === 'me') filter.assignedAgentId = new Types.ObjectId(actor.id)
    else if (query.assignee === 'unassigned') filter.assignedAgentId = null
    else if (query.assignee) filter.assignedAgentId = new Types.ObjectId(query.assignee)
  }
  if (query.status) filter.status = query.status
  if (query.category) filter.category = query.category
  if (query.priority) filter.priority = query.priority

  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i')
    const or: Record<string, unknown>[] = [{ subject: pattern }, { ticketNumber: pattern }]
    if (isStaff(actor)) {
      // Also match customer names (bounded lookup).
      const customers = await UserModel.find({ role: 'customer', name: pattern })
        .select('_id')
        .limit(50)
        .lean()
      if (customers.length) or.push({ customerId: { $in: customers.map((c) => c._id) } })
    }
    filter.$or = or
  }

  // Per-status totals use the same filters except status, so tabs show what each would contain.
  const countFilter = { ...filter }
  delete countFilter.status

  const { page, pageSize } = query
  const [total, rows, grouped] = await Promise.all([
    TicketModel.countDocuments(filter),
    TicketModel.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate(ticketPopulate)
      .lean(),
    TicketModel.aggregate<{ _id: TicketStatus; n: number }>([
      { $match: countFilter },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
  ])

  const counts: Record<TicketStatus, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 }
  for (const g of grouped) counts[g._id] = g.n

  const meta: PageMeta = {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
  const response: TicketListResponse = {
    data: rows.map((t) => toTicketSummary(t as unknown as PopulatedTicket)),
    meta,
    counts,
  }
  return response
}

export async function getTicket(actor: AuthUser, id: string) {
  const ticket = await loadVisibleTicket(actor, id)
  return toTicketDetail(await populated(ticket))
}

const MESSAGE_LIMIT = 500

export async function listMessages(actor: AuthUser, id: string) {
  const ticket = await loadVisibleTicket(actor, id)
  // Customers never receive internal notes.
  const filter = isStaff(actor)
    ? { ticketId: ticket._id }
    : { ticketId: ticket._id, internal: false }
  const messages = await TicketMessageModel.find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .limit(MESSAGE_LIMIT)
    .populate({ path: 'authorId', select: userRefFields })
    .lean()
  return messages.map((m) => toMessage(m as unknown as Parameters<typeof toMessage>[0]))
}

export async function listActivity(actor: AuthUser, id: string) {
  const ticket = await loadVisibleTicket(actor, id)
  const rows = await TicketActivityModel.find({ ticketId: ticket._id })
    .sort({ createdAt: 1, _id: 1 })
    .limit(MESSAGE_LIMIT)
    .populate({ path: 'actorId', select: userRefFields })
    .lean()
  return rows.map((a) => toActivity(a as unknown as Parameters<typeof toActivity>[0]))
}

/**
 * Adds a chat message or an internal note.
 * Public message side effects:
 * - customer writing in a resolved ticket reopens it;
 * - an agent replying to an unassigned ticket takes it, and an open ticket
 *   moves to In Progress;
 * - the first staff reply sets firstResponseAt (SLA and response-time metric);
 * - the author's side is marked as having read the conversation.
 * Internal notes (staff only) have no side effects and are never shown to the
 * customer. Any staff member may add one, e.g. to help a colleague.
 */
export async function addMessage(actor: AuthUser, id: string, body: string, internal = false) {
  if (internal && !isStaff(actor)) throw forbidden('Only staff can add internal notes')
  const ticket = await loadVisibleTicket(actor, id)
  assertNotClosed(ticket)
  if (!internal) assertAgentMayWork(actor, ticket)

  const now = new Date()
  const activity: ActivityInput[] = []
  const statusBefore = ticket.status

  if (internal) {
    // No status, assignment or SLA changes for notes.
  } else if (actor.role === 'customer') {
    if (ticket.status === 'resolved') {
      activity.push({ action: 'status_changed', previousValue: 'resolved', newValue: 'open' })
      applyStatus(ticket, 'open', now)
    }
  } else {
    if (actor.role === 'agent' && !ticket.assignedAgentId) {
      ticket.assignedAgentId = new Types.ObjectId(actor.id)
      activity.push({ action: 'assigned', newValue: actor.name })
    }
    if (ticket.status === 'open') {
      activity.push({ action: 'status_changed', previousValue: 'open', newValue: 'in_progress' })
      applyStatus(ticket, 'in_progress', now)
    }
    ticket.firstResponseAt ??= now
  }

  if (!internal) {
    ticket.lastMessageAt = now
    ticket.lastMessageFrom = isStaff(actor) ? 'staff' : 'customer'
    if (isStaff(actor)) ticket.staffReadAt = now
    else ticket.customerReadAt = now
  }

  const message = await TicketMessageModel.create({
    ticketId: ticket._id,
    authorId: actor.id,
    body,
    internal,
  })
  // Bump updatedAt even when nothing else changed, so lists sort by latest activity.
  ticket.updatedAt = now
  ticket.markModified('updatedAt')
  await saveWithConcurrency(ticket)
  await recordActivity(ticket._id, actor.id, activity)

  await message.populate({ path: 'authorId', select: userRefFields })
  const result = {
    message: toMessage(message.toObject() as unknown as Parameters<typeof toMessage>[0]),
    ticket: toTicketDetail(await populated(ticket)),
  }
  realtime.message(result.message, result.ticket)
  if (ticket.status !== statusBefore) {
    realtime.ticketUpdated(result.ticket, ref(actor), {
      status: { from: statusBefore, to: ticket.status },
    })
  }
  return result
}

/**
 * Marks the conversation as read by the caller's side (customer or staff).
 * Doesn't touch updatedAt or the version, so it never causes a "stale" conflict.
 */
export async function markRead(actor: AuthUser, id: string) {
  const ticket = await loadVisibleTicket(actor, id)
  const field = isStaff(actor) ? 'staffReadAt' : 'customerReadAt'
  await TicketModel.updateOne(
    { _id: ticket._id },
    { $set: { [field]: new Date() } },
    { timestamps: false },
  )
  const fresh = await TicketModel.findById(ticket._id).populate(ticketPopulate).lean()
  const summary = toTicketSummary(fresh as unknown as PopulatedTicket)
  realtime.ticketTouched(summary)
  return summary
}

/** Staff only (enforced by the route): status, priority and assignment changes. */
export async function updateTicket(actor: AuthUser, id: string, input: UpdateTicketInput) {
  const ticket = await loadVisibleTicket(actor, id)
  assertNotClosed(ticket)
  assertAgentMayWork(actor, ticket)

  if (input.expectedUpdatedAt && ticket.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw conflict('Someone else updated this ticket. Reload and try again.', 'STALE_TICKET')
  }

  const now = new Date()
  const activity: ActivityInput[] = []
  const statusBefore = ticket.status
  let assignedTo: { id: string; name: string; role: 'agent' } | null | undefined

  if (input.assignedAgentId !== undefined) {
    const current = ticket.assignedAgentId?.toString() ?? null
    const next = input.assignedAgentId
    if (next !== current) {
      if (actor.role === 'agent') {
        // Agents may only take an unassigned ticket or release their own.
        const takingFree = next === actor.id && current === null
        const releasingOwn = next === null && current === actor.id
        if (!takingFree && !releasingOwn) throw forbidden('Only an admin can reassign this ticket')
      }
      if (next === null) {
        ticket.assignedAgentId = null
        assignedTo = null
        activity.push({ action: 'unassigned' })
      } else {
        const agent = await UserModel.findOne({ _id: next, role: 'agent', isActive: true }).lean()
        if (!agent)
          throw badRequest('Assignee must be an active agent', {
            assignedAgentId: 'Not an active agent',
          })
        ticket.assignedAgentId = agent._id
        assignedTo = { id: agent._id.toString(), name: agent.name, role: 'agent' }
        activity.push({ action: 'assigned', newValue: agent.name })
      }
    }
  }

  if (input.priority && input.priority !== ticket.priority) {
    activity.push({
      action: 'priority_changed',
      previousValue: ticket.priority,
      newValue: input.priority,
    })
    ticket.priority = input.priority
    // The deadline follows the new priority until someone has replied.
    if (!ticket.firstResponseAt)
      ticket.firstResponseDueAt = firstResponseDue(input.priority, ticket.createdAt)
  }

  if (input.status && input.status !== ticket.status) {
    if (!canTransition(ticket.status, input.status)) {
      throw conflict(
        `Can't move a ticket from ${ticket.status} to ${input.status}`,
        'INVALID_TRANSITION',
      )
    }
    activity.push({
      action: 'status_changed',
      previousValue: ticket.status,
      newValue: input.status,
    })
    applyStatus(ticket, input.status, now)
  }

  if (activity.length === 0) return toTicketDetail(await populated(ticket))

  await saveWithConcurrency(ticket)
  await recordActivity(ticket._id, actor.id, activity)
  const detail = toTicketDetail(await populated(ticket))
  realtime.ticketUpdated(detail, ref(actor), {
    ...(ticket.status !== statusBefore && { status: { from: statusBefore, to: ticket.status } }),
    ...(assignedTo !== undefined && { assignedTo }),
  })
  return detail
}

/**
 * Customer rates their resolved or closed ticket, once. The assigned agent is
 * notified; the score feeds the admin CSAT metric.
 */
export async function rateTicket(actor: AuthUser, id: string, input: RateTicketInput) {
  if (actor.role !== 'customer') throw forbidden('Only the customer can rate a ticket')
  const ticket = await loadVisibleTicket(actor, id)
  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    throw conflict('You can rate a ticket once it is resolved', 'NOT_RESOLVED')
  }
  // Atomic "only if not rated yet" so a double click can't rate twice.
  const updated = await TicketModel.findOneAndUpdate(
    { _id: ticket._id, rating: null },
    {
      $set: { rating: { score: input.score, comment: input.comment || null, ratedAt: new Date() } },
    },
    { returnDocument: 'after', timestamps: false },
  )
  if (!updated) throw conflict('You have already rated this ticket', 'ALREADY_RATED')
  await recordActivity(ticket._id, actor.id, [{ action: 'rated', newValue: String(input.score) }])
  const detail = toTicketDetail(await populated(updated))
  realtime.ticketRated(detail, input.score)
  return detail
}

/** Active agents, for assignment pickers. Staff only (enforced by the route). */
export async function listAgents() {
  const agents = await UserModel.find({ role: 'agent', isActive: true })
    .select(userRefFields)
    .sort({ name: 1 })
    .limit(200)
    .lean()
  return agents.map((a) => ({ id: a._id.toString(), name: a.name, role: a.role }))
}
