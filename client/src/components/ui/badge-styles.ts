import { CircleCheck, CircleDot, Clock3, Lock } from 'lucide-react'
import type { TicketCategory, TicketStatus } from '@livedesk/shared'

export const statusStyles: Record<TicketStatus, { badge: string; icon: typeof CircleDot }> = {
  open: { badge: 'bg-red-50 text-red-600', icon: CircleDot },
  in_progress: { badge: 'bg-amber-50 text-amber-700', icon: Clock3 },
  resolved: { badge: 'bg-emerald-50 text-emerald-700', icon: CircleCheck },
  closed: { badge: 'bg-slate-100 text-slate-600', icon: Lock },
}

export const categoryStyles: Record<TicketCategory, string> = {
  bug: 'bg-red-50 text-red-600',
  billing: 'bg-blue-50 text-blue-700',
  account: 'bg-teal-50 text-teal-700',
  feature: 'bg-violet-50 text-violet-700',
  performance: 'bg-orange-50 text-orange-700',
  other: 'bg-slate-100 text-slate-600',
}
