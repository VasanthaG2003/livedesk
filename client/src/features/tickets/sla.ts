import type { TicketSummary } from '@livedesk/shared'
import { duration } from '@/lib/format'

export type SlaState =
  | { kind: 'none' }
  | { kind: 'met'; label: string }
  | { kind: 'due' | 'soon' | 'overdue'; label: string }

const SOON_MS = 30 * 60_000

/** First-response SLA status of a ticket at time `now`. */
export function slaState(t: TicketSummary, now: number): SlaState {
  if (!t.firstResponseDueAt) return { kind: 'none' }
  const due = new Date(t.firstResponseDueAt).getTime()
  if (t.firstResponseAt) {
    const took = new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime()
    return { kind: 'met', label: `First reply in ${duration(took)}` }
  }
  // Nobody needs to reply to a ticket that's already finished.
  if (t.status === 'resolved' || t.status === 'closed') return { kind: 'none' }
  const left = due - now
  if (left < 0) return { kind: 'overdue', label: `Overdue ${duration(-left)}` }
  return { kind: left < SOON_MS ? 'soon' : 'due', label: `Reply due in ${duration(left)}` }
}
