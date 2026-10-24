import { Schema, model, type InferSchemaType } from 'mongoose'

export const REVOKE_REASONS = [
  'rotated',
  'logout',
  'reuse_detected',
  'password_changed',
  'account_deactivated',
] as const
export type RevokeReason = (typeof REVOKE_REASONS)[number]

/**
 * One row per issued refresh token. Only a SHA-256 hash of the token is stored,
 * so a database leak doesn't hand out working sessions. Every refresh replaces
 * the token; all tokens from one login share a familyId so that reuse of an old
 * (stolen) token can revoke the whole family.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    /** Only 'rotated' tokens get the concurrent-refresh grace period. */
    revokedReason: { type: String, enum: REVOKE_REASONS, default: null },
  },
  { timestamps: true },
)

sessionSchema.index({ tokenHash: 1 }, { unique: true })
sessionSchema.index({ familyId: 1 })
sessionSchema.index({ userId: 1 })
// MongoDB deletes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type Session = InferSchemaType<typeof sessionSchema>
export const SessionModel = model('Session', sessionSchema)
