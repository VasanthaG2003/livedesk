import type { ReactNode } from 'react'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@livedesk/shared'
import { cn } from '@/lib/cn'
import { categoryStyles, statusStyles } from './badge-styles'

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { badge, icon: Icon } = statusStyles[status]
  return (
    <Badge className={badge}>
      <Icon className="size-3" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const priorityStyles: Record<TicketPriority, string> = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-sky-50 text-sky-700',
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge className={priorityStyles[priority]}>
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}

export function CategoryBadge({ category }: { category: TicketCategory }) {
  return (
    <Badge className={categoryStyles[category]}>
      <span className="sr-only">Category: </span>
      {CATEGORY_LABELS[category]}
    </Badge>
  )
}
