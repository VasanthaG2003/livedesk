// Shapes of API responses. Dates travel as ISO-8601 strings.
import type { Role, TicketCategory, TicketPriority, TicketStatus } from './constants'

export interface ApiSuccess<T> {
  data: T
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ApiPage<T> {
  data: T[]
  meta: PageMeta
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    /** Field-level validation messages, keyed by field path. */
    fields?: Record<string, string>
  }
}

export interface PublicUser {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: string
}

/** The minimum needed to show who someone is next to a ticket or message. */
export interface UserRef {
  id: string
  name: string
  role: Role
}

export interface TicketSummary {
  id: string
  ticketNumber: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  customer: UserRef
  assignedAgent: UserRef | null
  createdAt: string
  updatedAt: string
  /** SLA: when the first staff reply is due, and when it actually happened. */
  firstResponseDueAt: string | null
  firstResponseAt: string | null
  /** Last public chat message, used for unread markers and "seen" receipts. */
  lastMessageAt: string | null
  lastMessageFrom: 'customer' | 'staff' | null
  customerReadAt: string | null
  staffReadAt: string | null
}

export interface TicketRating {
  score: 1 | 2 | 3 | 4 | 5
  comment: string | null
  ratedAt: string
}

export interface TicketDetail extends TicketSummary {
  description: string
  resolvedAt: string | null
  closedAt: string | null
  rating: TicketRating | null
}

export interface TicketMessage {
  id: string
  ticketId: string
  author: UserRef
  body: string
  /** Internal notes are visible to staff only and never sent to the customer. */
  internal: boolean
  createdAt: string
}

export type TicketActivityAction =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'unassigned'
  | 'replied'
  | 'rated'

export interface TicketActivity {
  id: string
  ticketId: string
  actor: UserRef
  action: TicketActivityAction
  previousValue: string | null
  newValue: string | null
  createdAt: string
}

/** GET /tickets response: one page plus per-status totals for the same filters. */
export interface TicketListResponse extends ApiPage<TicketSummary> {
  counts: Record<TicketStatus, number>
}

export interface SavedReply {
  id: string
  title: string
  body: string
  /** "team" replies are created by admins and shared with every agent. */
  scope: 'personal' | 'team'
  owner: UserRef
  createdAt: string
}

/** A metric for the selected period and the period before it (for the trend arrow). */
export interface PeriodValue {
  current: number | null
  previous: number | null
}

export interface AgentStatsRow {
  agent: UserRef
  online: boolean
  openAssigned: number
  resolved: number
  avgFirstResponseMs: number | null
  csat: number | null
  csatCount: number
}

export interface DailyCount {
  /** YYYY-MM-DD in the requested time zone. */
  day: string
  created: number
  resolved: number
}

/** Everything the admin dashboard and reports show, computed from stored timestamps. */
export interface AdminStats {
  range: { days: number; from: string; to: string; tz: string }
  /** Current ticket counts by status (not limited to the period). */
  byStatus: Record<TicketStatus, number>
  created: PeriodValue
  resolved: PeriodValue
  avgFirstResponseMs: PeriodValue
  avgResolutionMs: PeriodValue
  /** % of tickets due in the period whose first reply met the deadline. */
  slaMetPct: PeriodValue
  csat: { average: number | null; count: number }
  trend: DailyCount[]
  /** Tickets created in the period, by category. */
  byCategory: Record<TicketCategory, number>
  agents: AgentStatsRow[]
  team: { agentsOnline: number; totalAgents: number }
}

/** An agent's own numbers (GET /stats/me). */
export interface MyStats {
  range: { days: number; from: string; to: string; tz: string }
  openAssigned: number
  resolved: PeriodValue
  avgFirstResponseMs: PeriodValue
  slaMetPct: PeriodValue
  csat: { average: number | null; count: number }
  byCategory: Record<TicketCategory, number>
}

export interface UserListItem extends PublicUser {
  /** Customers: tickets raised. Agents: tickets assigned. */
  totalTickets: number
  openTickets: number
  lastActivityAt: string | null
}

export type AuditAction = 'user.deactivated' | 'user.activated' | 'agent.created'

export interface AuditEntry {
  id: string
  actor: UserRef
  action: AuditAction
  target: UserRef | null
  createdAt: string
}

/** Recent ticket activity across all tickets (admin feed). */
export interface ActivityFeedItem extends TicketActivity {
  ticketNumber: string
  ticketSubject: string
}

export interface TriageSuggestion {
  category: TicketCategory
  priority: TicketPriority
  /** One short sentence the customer can read. */
  reason: string
}
