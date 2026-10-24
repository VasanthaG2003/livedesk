import { Types } from 'mongoose'
import type { SavedReply, SavedReplyInput } from '@livedesk/shared'
import { forbidden, notFound } from '../lib/http-error'
import { SavedReplyModel } from '../models/saved-reply.model'
import type { AuthUser } from '../types/auth'
import { toUserRef } from './serializers'

/*
 * Staff only (enforced by the route).
 * - Agents see team replies + their own personal ones, and manage only their own.
 * - Admins create team replies and can delete any reply.
 */

type Populated = {
  _id: Types.ObjectId
  title: string
  body: string
  scope: 'personal' | 'team'
  ownerId: { _id: Types.ObjectId; name: string; role: 'customer' | 'agent' | 'admin' } | null
  createdAt: Date
}

const toSavedReply = (r: Populated): SavedReply => ({
  id: r._id.toString(),
  title: r.title,
  body: r.body,
  scope: r.scope,
  owner: toUserRef(r.ownerId),
  createdAt: r.createdAt.toISOString(),
})

export async function listSavedReplies(actor: AuthUser) {
  const rows = await SavedReplyModel.find({ $or: [{ scope: 'team' }, { ownerId: actor.id }] })
    .sort({ scope: -1, title: 1 })
    .limit(200)
    .populate({ path: 'ownerId', select: 'name role' })
    .lean()
  return rows.map((r) => toSavedReply(r as unknown as Populated))
}

export async function createSavedReply(actor: AuthUser, input: SavedReplyInput) {
  const doc = await SavedReplyModel.create({
    ...input,
    scope: actor.role === 'admin' ? 'team' : 'personal',
    ownerId: actor.id,
  })
  await doc.populate({ path: 'ownerId', select: 'name role' })
  return toSavedReply(doc.toObject() as unknown as Populated)
}

export async function deleteSavedReply(actor: AuthUser, id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound('Saved reply not found')
  const reply = await SavedReplyModel.findById(id)
  // Another agent's personal reply doesn't "exist" for you.
  if (
    !reply ||
    (reply.scope === 'personal' && !reply.ownerId.equals(actor.id) && actor.role !== 'admin')
  ) {
    throw notFound('Saved reply not found')
  }
  if (actor.role !== 'admin' && !reply.ownerId.equals(actor.id)) {
    throw forbidden('Only an admin can delete team replies')
  }
  await reply.deleteOne()
}
