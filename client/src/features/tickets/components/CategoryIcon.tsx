import { Bug, CircleHelp, Gauge, ReceiptText, Star, UserRound, type LucideIcon } from 'lucide-react'
import type { TicketCategory } from '@livedesk/shared'
import { cn } from '@/lib/cn'

const icons: Record<TicketCategory, { icon: LucideIcon; className: string }> = {
  bug: { icon: Bug, className: 'bg-red-50 text-red-500' },
  billing: { icon: ReceiptText, className: 'bg-blue-50 text-blue-600' },
  account: { icon: UserRound, className: 'bg-sky-50 text-sky-600' },
  feature: { icon: Star, className: 'bg-amber-50 text-amber-500' },
  performance: { icon: Gauge, className: 'bg-orange-50 text-orange-500' },
  other: { icon: CircleHelp, className: 'bg-slate-100 text-slate-500' },
}

export function CategoryIcon({
  category,
  className,
}: {
  category: TicketCategory
  className?: string
}) {
  const { icon: Icon, className: tone } = icons[category]
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full',
        tone,
        className,
      )}
      aria-hidden
    >
      <Icon className="size-[18px]" />
    </span>
  )
}
