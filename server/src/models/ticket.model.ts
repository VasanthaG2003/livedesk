import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { LIMITS, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '@livedesk/shared'

const ticketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true },
    subject: { type: String, required: true, trim: true, maxlength: LIMITS.subjectMax },
    description: { type: String, required: true, trim: true, maxlength: LIMITS.descriptionMax },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    priority: { type: String, enum: TICKET_PRIORITIES, required: true },
    status: { type: String, enum: TICKET_STATUSES, required: true, default: 'open' },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    // SLA: createdAt + FIRST_RESPONSE_SLA_MINUTES[priority], recomputed if the
    // priority changes before the first staff reply.
    firstResponseDueAt: { type: Date, default: null },
    // Last public chat message, for unread markers and "seen" receipts.
    lastMessageAt: { type: Date, default: null },
    lastMessageFrom: { type: String, enum: ['customer', 'staff'], default: null },
    customerReadAt: { type: Date, default: null },
    staffReadAt: { type: Date, default: null },
    rating: {
      type: new Schema(
        {
          score: { type: Number, required: true, min: 1, max: 5 },
          comment: { type: String, trim: true, maxlength: 1000, default: null },
          ratedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  {
    timestamps: true,
    // Two staff saving the same ticket at once: the second save fails with a
    // VersionError instead of silently overwriting the first.
    optimisticConcurrency: true,
  },
)

ticketSchema.index({ ticketNumber: 1 }, { unique: true })
ticketSchema.index({ customerId: 1, updatedAt: -1 })
ticketSchema.index({ status: 1, updatedAt: -1 })
ticketSchema.index({ assignedAgentId: 1, status: 1 })
ticketSchema.index({ createdAt: -1 })
ticketSchema.index({ firstResponseAt: 1, firstResponseDueAt: 1, status: 1 })

export type Ticket = InferSchemaType<typeof ticketSchema>
export type TicketDoc = HydratedDocument<Ticket>
export const TicketModel = model('Ticket', ticketSchema)
