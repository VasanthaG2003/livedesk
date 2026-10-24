// Single source of truth for the enum-like values both the API and the UI use.
// Stored values are lowercase snake_case; labels are for display only.

export const ROLES = ['customer', 'agent', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_CATEGORIES = [
  'bug',
  'billing',
  'account',
  'feature',
  'performance',
  'other',
] as const
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  customer: 'Customer',
  agent: 'Agent',
  admin: 'Admin',
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  bug: 'Bug',
  billing: 'Billing',
  account: 'Account',
  feature: 'Feature',
  performance: 'Performance',
  other: 'Other',
}

/**
 * Allowed status changes. Anything not listed is rejected by the API with 409.
 * Closed is terminal: a closed ticket is read-only.
 */
export const STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ['in_progress', 'resolved', 'closed'],
  in_progress: ['open', 'resolved', 'closed'],
  resolved: ['open', 'in_progress', 'closed'],
  closed: [],
}

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

export const LIMITS = {
  nameMax: 80,
  passwordMin: 8,
  passwordMax: 128,
  subjectMin: 5,
  subjectMax: 120,
  descriptionMin: 10,
  descriptionMax: 5000,
  messageMax: 5000,
  pageSizeMax: 100,
} as const

/**
 * First-response targets (SLA) per priority, in minutes. A ticket's
 * firstResponseDueAt is createdAt + this; it is "overdue" if no staff reply by then.
 */
export const FIRST_RESPONSE_SLA_MINUTES: Record<TicketPriority, number> = {
  high: 60,
  medium: 4 * 60,
  low: 24 * 60,
}
