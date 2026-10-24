import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { LIMITS, ROLES } from '@livedesk/shared'

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: LIMITS.nameMax },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // select: false — the hash is never loaded unless a query asks for it explicitly.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'customer' },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
)

userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ role: 1, name: 1 })

export type User = InferSchemaType<typeof userSchema>
export type UserDoc = HydratedDocument<User>
export const UserModel = model('User', userSchema)
