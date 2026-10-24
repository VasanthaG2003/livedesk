import { Schema, model } from 'mongoose'

/** Atomic sequences (e.g. ticket numbers). */
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
})

export const CounterModel = model('Counter', counterSchema)

/** Returns 1, 2, 3, … per name. Safe under concurrent requests because $inc is atomic. */
export async function nextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  return counter.seq
}
