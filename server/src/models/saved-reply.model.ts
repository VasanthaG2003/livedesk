import { Schema, model, type InferSchemaType } from 'mongoose'
import { LIMITS } from '@livedesk/shared'

const savedReplySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: LIMITS.messageMax },
    // "team" replies are created by admins and visible to every staff member.
    scope: { type: String, enum: ['personal', 'team'], required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

savedReplySchema.index({ scope: 1, title: 1 })
savedReplySchema.index({ ownerId: 1, title: 1 })

export type SavedReplyRecord = InferSchemaType<typeof savedReplySchema>
export const SavedReplyModel = model('SavedReply', savedReplySchema)
