/**
 * Metrics computed from stored timestamps with MongoDB aggregations — nothing
 * here is sample data. Every "PeriodValue" covers the selected window and the
 * equally long window before it, so the UI can show a trend.
 */
import { Types, type PipelineStage } from 'mongoose'
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type AdminStats,
  type AgentStatsRow,
  type MyStats,
  type PeriodValue,
  type StatsQuery,
  type TicketCategory,
  type TicketStatus,
} from '@livedesk/shared'
import { TicketModel } from '../models/ticket.model'
import { UserModel } from '../models/user.model'
import { onlineAgentIds } from '../realtime'

const DAY_MS = 24 * 60 * 60 * 1000

type Filter = Record<string, unknown>
interface Window {
  from: Date
  to: Date
}

function windows(days: number) {
  const to = new Date()
  const from = new Date(to.getTime() - days * DAY_MS)
  return {
    current: { from, to },
    previous: { from: new Date(from.getTime() - days * DAY_MS), to: from },
  }
}

const inWindow = (w: Window) => ({ $gte: w.from, $lt: w.to })

async function count(scope: Filter, field: string, w: Window) {
  return TicketModel.countDocuments({ ...scope, [field]: inWindow(w) })
}

/** Average of (end - start) in ms over tickets whose `end` falls in the window. */
async function avgDuration(scope: Filter, start: string, end: string, w: Window) {
  const [row] = await TicketModel.aggregate<{ avg: number }>([
    { $match: { ...scope, [end]: inWindow(w) } },
    { $group: { _id: null, avg: { $avg: { $subtract: [`$${end}`, `$${start}`] } } } },
  ])
  return row ? Math.round(row.avg) : null
}

/**
 * SLA compliance for tickets whose first-reply deadline fell in the window and
 * has already passed (or was answered): % answered on time.
 */
async function slaMetPct(scope: Filter, w: Window) {
  const now = new Date()
  const [row] = await TicketModel.aggregate<{ total: number; met: number }>([
    {
      $match: {
        ...scope,
        firstResponseDueAt: inWindow(w),
        $or: [{ firstResponseAt: { $ne: null } }, { firstResponseDueAt: { $lte: now } }],
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        met: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$firstResponseAt', null] },
                  { $lte: ['$firstResponseAt', '$firstResponseDueAt'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ])
  return row && row.total > 0 ? Math.round((row.met / row.total) * 100) : null
}

async function csat(scope: Filter, w: Window) {
  const [row] = await TicketModel.aggregate<{ avg: number; n: number }>([
    { $match: { ...scope, 'rating.ratedAt': inWindow(w) } },
    { $group: { _id: null, avg: { $avg: '$rating.score' }, n: { $sum: 1 } } },
  ])
  return { average: row ? Math.round(row.avg * 10) / 10 : null, count: row?.n ?? 0 }
}

async function both<T>(fn: (w: Window) => Promise<T>, days: number) {
  const { current, previous } = windows(days)
  const [c, p] = await Promise.all([fn(current), fn(previous)])
  return { current: c, previous: p } as { current: T; previous: T }
}

async function byCategory(scope: Filter, w: Window) {
  const rows = await TicketModel.aggregate<{ _id: TicketCategory; n: number }>([
    { $match: { ...scope, createdAt: inWindow(w) } },
    { $group: { _id: '$category', n: { $sum: 1 } } },
  ])
  const out = Object.fromEntries(TICKET_CATEGORIES.map((c) => [c, 0])) as Record<
    TicketCategory,
    number
  >
  for (const r of rows) out[r._id] = r.n
  return out
}

async function byStatus(scope: Filter) {
  const rows = await TicketModel.aggregate<{ _id: TicketStatus; n: number }>([
    { $match: scope },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ])
  const out = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>
  for (const r of rows) out[r._id] = r.n
  return out
}

/** Calendar days (YYYY-MM-DD) in `tz`, oldest first, ending today. */
function dayKeys(days: number, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const now = Date.now()
  const keys = new Set<string>()
  for (let i = days - 1; i >= 0; i--) keys.add(fmt.format(new Date(now - i * DAY_MS)))
  return [...keys]
}

async function dailyCounts(scope: Filter, field: string, w: Window, tz: string) {
  const stages: PipelineStage[] = [
    { $match: { ...scope, [field]: inWindow(w) } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: tz } },
        n: { $sum: 1 },
      },
    },
  ]
  const rows = await TicketModel.aggregate<{ _id: string; n: number }>(stages)
  return new Map(rows.map((r) => [r._id, r.n]))
}

async function agentRows(w: Window): Promise<AgentStatsRow[]> {
  const agents = await UserModel.find({ role: 'agent', isActive: true })
    .select('name role')
    .sort({ name: 1 })
    .lean()
  const ids = agents.map((a) => a._id)
  const [open, resolved, response, ratings] = await Promise.all([
    TicketModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { assignedAgentId: { $in: ids }, status: { $in: ['open', 'in_progress'] } } },
      { $group: { _id: '$assignedAgentId', n: { $sum: 1 } } },
    ]),
    TicketModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { assignedAgentId: { $in: ids }, resolvedAt: inWindow(w) } },
      { $group: { _id: '$assignedAgentId', n: { $sum: 1 } } },
    ]),
    TicketModel.aggregate<{ _id: Types.ObjectId; avg: number }>([
      { $match: { assignedAgentId: { $in: ids }, firstResponseAt: inWindow(w) } },
      {
        $group: {
          _id: '$assignedAgentId',
          avg: { $avg: { $subtract: ['$firstResponseAt', '$createdAt'] } },
        },
      },
    ]),
    TicketModel.aggregate<{ _id: Types.ObjectId; avg: number; n: number }>([
      { $match: { assignedAgentId: { $in: ids }, 'rating.ratedAt': inWindow(w) } },
      { $group: { _id: '$assignedAgentId', avg: { $avg: '$rating.score' }, n: { $sum: 1 } } },
    ]),
  ])
  const lookup = <T extends { _id: Types.ObjectId }>(rows: T[]) =>
    new Map(rows.map((r) => [r._id.toString(), r]))
  const [o, r, f, c] = [lookup(open), lookup(resolved), lookup(response), lookup(ratings)]
  const online = new Set(onlineAgentIds())
  return agents.map((a) => {
    const id = a._id.toString()
    const rating = c.get(id)
    return {
      agent: { id, name: a.name, role: a.role },
      online: online.has(id),
      openAssigned: o.get(id)?.n ?? 0,
      resolved: r.get(id)?.n ?? 0,
      avgFirstResponseMs: f.has(id) ? Math.round(f.get(id)!.avg) : null,
      csat: rating ? Math.round(rating.avg * 10) / 10 : null,
      csatCount: rating?.n ?? 0,
    }
  })
}

const rangeOf = ({ days, tz }: StatsQuery) => {
  const { current } = windows(days)
  return { days, tz, from: current.from.toISOString(), to: current.to.toISOString() }
}

export async function adminStats(query: StatsQuery): Promise<AdminStats> {
  const { days, tz } = query
  const scope: Filter = {}
  const { current } = windows(days)

  const [
    created,
    resolved,
    firstResponse,
    resolution,
    sla,
    rating,
    statuses,
    categories,
    createdDaily,
    resolvedDaily,
    agents,
  ] = await Promise.all([
    both((w) => count(scope, 'createdAt', w), days),
    both((w) => count(scope, 'resolvedAt', w), days),
    both((w) => avgDuration(scope, 'createdAt', 'firstResponseAt', w), days),
    both((w) => avgDuration(scope, 'createdAt', 'resolvedAt', w), days),
    both((w) => slaMetPct(scope, w), days),
    csat(scope, current),
    byStatus(scope),
    byCategory(scope, current),
    dailyCounts(scope, 'createdAt', current, tz),
    dailyCounts(scope, 'resolvedAt', current, tz),
    agentRows(current),
  ])

  return {
    range: rangeOf(query),
    byStatus: statuses,
    created: created as PeriodValue,
    resolved: resolved as PeriodValue,
    avgFirstResponseMs: firstResponse,
    avgResolutionMs: resolution,
    slaMetPct: sla,
    csat: rating,
    trend: dayKeys(days, tz).map((day) => ({
      day,
      created: createdDaily.get(day) ?? 0,
      resolved: resolvedDaily.get(day) ?? 0,
    })),
    byCategory: categories,
    agents,
    team: { agentsOnline: agents.filter((a) => a.online).length, totalAgents: agents.length },
  }
}

export async function myStats(agentId: string, query: StatsQuery): Promise<MyStats> {
  const { days } = query
  const scope: Filter = { assignedAgentId: new Types.ObjectId(agentId) }
  const { current } = windows(days)
  const [openAssigned, resolved, firstResponse, sla, rating, categories] = await Promise.all([
    TicketModel.countDocuments({ ...scope, status: { $in: ['open', 'in_progress'] } }),
    both((w) => count(scope, 'resolvedAt', w), days),
    both((w) => avgDuration(scope, 'createdAt', 'firstResponseAt', w), days),
    both((w) => slaMetPct(scope, w), days),
    csat(scope, current),
    byCategory(scope, current),
  ])
  return {
    range: rangeOf(query),
    openAssigned,
    resolved: resolved as PeriodValue,
    avgFirstResponseMs: firstResponse,
    slaMetPct: sla,
    csat: rating,
    byCategory: categories,
  }
}
