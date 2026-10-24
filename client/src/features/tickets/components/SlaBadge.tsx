import type { TicketSummary } from '@livedesk/shared'
import { AlarmClock, CircleCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/cn'
import { slaState } from '../sla'

const tone = {
  due: 'bg-slate-100 text-slate-600',
  soon: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-600 text-white',
  met: 'bg-emerald-50 text-emerald-700',
}

/** Staff-facing first-response deadline. Pass showMet to also show "First reply in …". */
export function SlaBadge({
  ticket,
  showMet = false,
  className,
}: {
  ticket: TicketSummary
  showMet?: boolean
  className?: string
}) {
  const now = useNow()
  const state = slaState(ticket, now)
  if (state.kind === 'none' || (state.kind === 'met' && !showMet)) return null
  const Icon = state.kind === 'met' ? CircleCheck : AlarmClock
  return (
    <Badge className={cn(tone[state.kind], className)}>
      <Icon className="size-3" aria-hidden />
      {state.label}
    </Badge>
  )
}
