import type { ReactNode } from 'react'
import { PRIORITY_LABELS, STATUS_LABELS, type TicketActivity } from '@livedesk/shared'
import { dateTime, timeAgo } from '@/lib/format'

function label(value: string | null) {
  if (!value) return ''
  return (
    STATUS_LABELS[value as keyof typeof STATUS_LABELS] ??
    PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS] ??
    value
  )
}

function describe(a: TicketActivity) {
  switch (a.action) {
    case 'created':
      return 'created the ticket'
    case 'status_changed':
      return `changed status from ${label(a.previousValue)} to ${label(a.newValue)}`
    case 'priority_changed':
      return `changed priority from ${label(a.previousValue)} to ${label(a.newValue)}`
    case 'assigned':
      return a.newValue === a.actor.name
        ? 'took the ticket'
        : `assigned the ticket to ${a.newValue}`
    case 'unassigned':
      return 'removed the assignee'
    case 'replied':
      return 'replied'
    case 'rated':
      return `rated the support ${a.newValue}/5`
  }
}

interface ActivityTimelineProps {
  activity: TicketActivity[]
  /** Optional link to the ticket, for feeds that span many tickets. */
  ticketLink?: (a: TicketActivity) => ReactNode
}

export function ActivityTimeline({ activity, ticketLink }: ActivityTimelineProps) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {activity.map((a) => (
        <li key={a.id} className="relative">
          <span
            className="absolute top-1.5 -left-[24.5px] size-2 rounded-full bg-brand-500 ring-4 ring-white"
            aria-hidden
          />
          <p className="text-[13px] text-ink-700">
            {ticketLink && <>{ticketLink(a)} · </>}
            <span className="font-medium text-ink-900">{a.actor.name}</span> {describe(a)}
          </p>
          <time
            dateTime={a.createdAt}
            title={dateTime(a.createdAt)}
            className="text-xs text-ink-400"
          >
            {timeAgo(a.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  )
}
