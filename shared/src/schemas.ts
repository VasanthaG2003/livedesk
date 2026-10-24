// Request validation schemas. The client uses them for form validation and the
// server re-validates every request with the same schemas, so the rules can't drift.
import { z } from 'zod'
import { LIMITS, ROLES, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from './constants'

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'))

const password = z
  .string()
  .min(LIMITS.passwordMin, `Password must be at least ${LIMITS.passwordMin} characters`)
  .max(LIMITS.passwordMax, `Password must be at most ${LIMITS.passwordMax} characters`)

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(LIMITS.nameMax),
  email,
  password,
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.strictObject({
  email,
  // Don't apply the length policy on login: it would leak the policy and
  // reject users created under an older policy.
  password: z.string().min(1, 'Password is required').max(LIMITS.passwordMax),
})
export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, 'Current password is required').max(LIMITS.passwordMax),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    error: 'New password must be different from the current one',
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const createTicketSchema = z.strictObject({
  subject: z
    .string()
    .trim()
    .min(LIMITS.subjectMin, `Subject must be at least ${LIMITS.subjectMin} characters`)
    .max(LIMITS.subjectMax, `Subject must be at most ${LIMITS.subjectMax} characters`),
  description: z
    .string()
    .trim()
    .min(LIMITS.descriptionMin, `Description must be at least ${LIMITS.descriptionMin} characters`)
    .max(LIMITS.descriptionMax, `Description must be at most ${LIMITS.descriptionMax} characters`),
  category: z.enum(TICKET_CATEGORIES, 'Choose a category'),
  priority: z.enum(TICKET_PRIORITIES, 'Choose a priority'),
})
export type CreateTicketInput = z.infer<typeof createTicketSchema>

export const replySchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(1, 'Reply cannot be empty')
    .max(LIMITS.messageMax, `Reply must be at most ${LIMITS.messageMax} characters`),
  /** Staff-only internal note. The server rejects this from customers. */
  internal: z.boolean().optional(),
})
export type ReplyInput = z.infer<typeof replySchema>

/** MongoDB ObjectId as a 24-character hex string. */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')

/** Staff-only ticket changes. At least one field must be present. */
export const updateTicketSchema = z
  .strictObject({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    /** An agent id to assign, or null to unassign. */
    assignedAgentId: objectIdSchema.nullable().optional(),
    /** The ticket's updatedAt as the client last saw it; a mismatch returns 409. */
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.priority !== undefined || v.assignedAgentId !== undefined,
    { error: 'Nothing to update' },
  )
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

/** Query string for GET /tickets. Everything is optional; pages are bounded. */
export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).default(20),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(TICKET_STATUSES).optional()),
  category: z.preprocess(emptyToUndefined, z.enum(TICKET_CATEGORIES).optional()),
  priority: z.preprocess(emptyToUndefined, z.enum(TICKET_PRIORITIES).optional()),
  /** "me", "unassigned" or an agent id. Staff only. */
  assignee: z.preprocess(
    emptyToUndefined,
    z.union([z.literal('me'), z.literal('unassigned'), objectIdSchema]).optional(),
  ),
  /** Staff only. */
  customerId: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
})
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>

/** Customer rating once a ticket is resolved. */
export const rateTicketSchema = z.strictObject({
  score: z.number().int().min(1, 'Pick 1 to 5 stars').max(5, 'Pick 1 to 5 stars'),
  comment: z.string().trim().max(1000, 'Comment must be at most 1000 characters').optional(),
})
export type RateTicketInput = z.infer<typeof rateTicketSchema>

/**
 * Saved replies (canned responses). Bodies may contain {{customer.firstName}},
 * {{agent.firstName}} and {{ticket.number}}, filled in when inserted.
 */
export const savedReplySchema = z.strictObject({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(80),
  body: z.string().trim().min(1, 'Reply text is required').max(LIMITS.messageMax),
})
export type SavedReplyInput = z.infer<typeof savedReplySchema>

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** GET /admin/stats and /stats/me. Days are grouped in the caller's time zone. */
export const statsQuerySchema = z.object({
  days: z.coerce
    .number()
    .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
    .default(7),
  tz: z.string().max(64).refine(isTimeZone, 'Unknown time zone').default('UTC'),
})
export type StatsQuery = z.infer<typeof statsQuerySchema>

/** GET /admin/users and /customers. */
export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).default(20),
  q: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(100).optional()),
  role: z.enum(ROLES).default('customer'),
})
export type UserListQuery = z.infer<typeof userListQuerySchema>

export const setUserActiveSchema = z.strictObject({ isActive: z.boolean() })

/** Admin creates an agent account and shares the initial password with them. */
export const createAgentSchema = registerSchema
export type CreateAgentInput = z.infer<typeof createAgentSchema>

/** POST /ai/triage — the same limits as a ticket, but both fields may still be short drafts. */
export const triageRequestSchema = z.strictObject({
  subject: z.string().trim().min(3).max(LIMITS.subjectMax),
  description: z.string().trim().min(10).max(LIMITS.descriptionMax),
})
export type TriageRequest = z.infer<typeof triageRequestSchema>
