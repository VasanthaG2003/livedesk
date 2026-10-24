import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Lock } from 'lucide-react'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type ReplyInput,
  type TicketActivity,
  type TicketDetail,
  type TicketMessage,
  type UserRef,
} from '@livedesk/shared'
import { Card, CardHeader } from '@/components/ui/Card'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { dateTime } from '@/lib/format'
import { SlaBadge } from './SlaBadge'
import { Stars } from './RatingCard'
import { ActivityTimeline } from './ActivityTimeline'
import { Conversation } from './Conversation'
import { ReplyComposer } from './ReplyComposer'

interface TicketDetailViewProps {
  ticket: TicketDetail
  messages: TicketMessage[]
  activity: TicketActivity[]
  currentUserId: string
  backHref: string
  backLabel: string
  onReply: (input: ReplyInput) => Promise<boolean>
  messagesLoading?: boolean
  /** Status / priority / assignment controls — only rendered for staff. */
  staffControls?: ReactNode
  badge?: ReactNode
  /** Scroll to the chat and focus the message box. */
  focusChat?: boolean
  side: 'customer' | 'staff'
  viewers?: UserRef[]
  typing?: UserRef[]
  onTyping?: (typing: boolean) => void
  /** Rendered next to Send (saved replies, AI draft…). */
  composerTools?: (insert: (text: string) => void) => ReactNode
  /** Full-width card under the title (e.g. the customer's rating prompt). */
  banner?: ReactNode
}

export function TicketDetailView({
  ticket,
  messages,
  activity,
  currentUserId,
  backHref,
  backLabel,
  onReply,
  staffControls,
  badge,
  focusChat = false,
  messagesLoading = false,
  side,
  viewers = [],
  typing = [],
  onTyping,
  composerTools,
  banner,
}: TicketDetailViewProps) {
  const closed = ticket.status === 'closed'
  const chatRef = useRef<HTMLDivElement>(null)

  // Arriving from "Chat with us": bring the chat into view.
  useEffect(() => {
    if (focusChat) chatRef.current?.scrollIntoView({ block: 'start' })
  }, [focusChat])

  return (
    <div className="space-y-5">
      <Link
        to={backHref}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> {backLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink-500">#{ticket.ticketNumber}</p>
          <h1 className="mt-0.5 text-xl font-semibold text-ink-900">{ticket.subject}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badge}
          {side === 'staff' && <SlaBadge ticket={ticket} showMet />}
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </div>

      {closed && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700"
        >
          <Lock className="size-4 shrink-0" aria-hidden />
          This ticket is closed and can no longer be replied to.
        </div>
      )}

      {banner}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Description" />
            <p className="px-5 pt-2 pb-5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-700">
              {ticket.description}
            </p>
          </Card>

          <Card ref={chatRef} id="chat" className="scroll-mt-20">
            <CardHeader
              title="Chat"
              description={`${messages.length} messages · live`}
              action={
                viewers.length > 0 ? (
                  <span className="flex items-center gap-2 text-xs text-ink-500">
                    <span className="flex -space-x-1.5">
                      {viewers.slice(0, 3).map((v) => (
                        <Avatar key={v.id} name={v.name} size="xs" className="ring-2 ring-white" />
                      ))}
                    </span>
                    <span>
                      <span className="sr-only">Viewing now: </span>
                      {viewers.map((v) => v.name.split(' ')[0]).join(', ')} viewing
                    </span>
                  </span>
                ) : undefined
              }
            />
            <div className="px-5 pt-4 pb-5">
              {messagesLoading ? (
                <SkeletonRows rows={2} label="Loading messages" />
              ) : (
                <Conversation
                  messages={messages}
                  currentUserId={currentUserId}
                  side={side}
                  otherSideReadAt={side === 'customer' ? ticket.staffReadAt : ticket.customerReadAt}
                  typing={typing}
                />
              )}
            </div>
            {!closed && (
              <div className="border-t border-line px-5 py-4">
                <ReplyComposer
                  onSubmit={onReply}
                  autoFocus={focusChat}
                  allowInternal={side === 'staff'}
                  onTyping={onTyping}
                  tools={composerTools}
                />
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          {staffControls}
          <Card>
            <CardHeader title="Details" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-5 pt-3 pb-5 text-[13px]">
              <dt className="text-ink-500">Customer</dt>
              <dd className="flex items-center gap-2 font-medium text-ink-900">
                <Avatar name={ticket.customer.name} size="xs" decorative />
                {ticket.customer.name}
              </dd>
              <dt className="text-ink-500">Assignee</dt>
              <dd className="font-medium text-ink-900">
                {ticket.assignedAgent?.name ?? 'Unassigned'}
              </dd>
              <dt className="text-ink-500">Category</dt>
              <dd className="text-ink-900">{CATEGORY_LABELS[ticket.category]}</dd>
              <dt className="text-ink-500">Priority</dt>
              <dd className="text-ink-900">{PRIORITY_LABELS[ticket.priority]}</dd>
              {ticket.rating && (
                <>
                  <dt className="text-ink-500">Rating</dt>
                  <dd className="text-ink-900">
                    <Stars score={ticket.rating.score} />
                    {ticket.rating.comment && (
                      <p className="mt-1 text-xs text-ink-500">“{ticket.rating.comment}”</p>
                    )}
                  </dd>
                </>
              )}
              <dt className="text-ink-500">Created</dt>
              <dd className="text-ink-900">{dateTime(ticket.createdAt)}</dd>
              <dt className="text-ink-500">Updated</dt>
              <dd className="text-ink-900">{dateTime(ticket.updatedAt)}</dd>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Activity" />
            <div className="px-5 pt-4 pb-5">
              <ActivityTimeline activity={activity} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
