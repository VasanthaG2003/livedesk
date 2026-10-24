import { Schema, model, type InferSchemaType } from 'mongoose'

export const ACTIVITY_ACTIONS = [
  'created',
  'status_changed',
  'priority_changed',
  'assigned',
  'unassigned',
  'replied',
  'rated',
] as const

const ticketActivitySchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    previousValue: { type: String, default: null },
    newValue: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

ticketActivitySchema.index({ ticketId: 1, createdAt: 1 })
ticketActivitySchema.index({ createdAt: -1 })

export type TicketActivityRecord = InferSchemaType<typeof ticketActivitySchema>
export const TicketActivityModel = model('TicketActivity', ticketActivitySchema)
