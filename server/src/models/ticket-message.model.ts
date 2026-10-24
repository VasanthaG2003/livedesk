import { Schema, model, type InferSchemaType } from 'mongoose'
import { LIMITS } from '@livedesk/shared'

const ticketMessageSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: LIMITS.messageMax },
    /** Staff-only note; never returned to or broadcast to customers. */
    internal: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
)

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 })

export type TicketMessageRecord = InferSchemaType<typeof ticketMessageSchema>
export const TicketMessageModel = model('TicketMessage', ticketMessageSchema)
