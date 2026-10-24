import { Schema, model } from 'mongoose'

export const AUDIT_ACTIONS = ['user.deactivated', 'user.activated', 'agent.created'] as const

/** Append-only record of administrative actions. */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditLogSchema.index({ createdAt: -1 })

export const AuditLogModel = model('AuditLog', auditLogSchema)
