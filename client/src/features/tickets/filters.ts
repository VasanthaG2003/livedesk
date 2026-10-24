import type { TicketCategory, TicketPriority, TicketStatus } from '@livedesk/shared'
import type { TicketListParams } from './api'

export interface TicketFilters {
  q: string
  category: TicketCategory | ''
  priority: TicketPriority | ''
  status: TicketStatus | ''
  /** Agent id, "me", "unassigned" or "" for everyone. */
  assignee: string
}

export const emptyFilters: TicketFilters = {
  q: '',
  category: '',
  priority: '',
  status: '',
  assignee: '',
}

/** Filter-bar state → API query params (empty values dropped). */
export function toListParams(f: TicketFilters): TicketListParams {
  return {
    q: f.q.trim() || undefined,
    category: f.category || undefined,
    priority: f.priority || undefined,
    status: f.status || undefined,
    assignee: (f.assignee || undefined) as TicketListParams['assignee'],
  }
}
