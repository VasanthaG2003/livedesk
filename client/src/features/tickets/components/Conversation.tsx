import { useEffect, useRef } from 'react'
import { CheckCheck, Lock } from 'lucide-react'
import { ROLE_LABELS, type TicketMessage, type UserRef } from '@livedesk/shared'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { dateTime, timeAgo } from '@/lib/format'

interface ConversationProps {
  messages: TicketMessage[]
  currentUserId: string
  /** Which side the viewer is on, for "Seen" receipts. */
  side: 'customer' | 'staff'
  /** When the other side last read the chat. */
  otherSideReadAt: string | null
  typing: UserRef[]
}

const sideOf = (m: TicketMessage) => (m.author.role === 'customer' ? 'customer' : 'staff')

/**
 * Chat thread: your messages on the right, others on the left, internal notes
 * in amber. Scrolls to the newest message when one arrives.
 */
export function Conversation({
  messages,
  currentUserId,
  side,
  otherSideReadAt,
  typing,
}: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastId = messages.at(-1)?.id

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId, typing.length])

  // "Seen" goes under my side's latest public message, if the other side has read past it.
  const lastMine = [...messages].reverse().find((m) => !m.internal && sideOf(m) === side)
  const seenId =
    lastMine && otherSideReadAt && otherSideReadAt >= lastMine.createdAt ? lastMine.id : null

  return (
    <div ref={scrollRef} className="max-h-[480px] overflow-y-auto pr-1">
      {messages.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">
          No messages yet. Start the conversation below.
        </p>
      ) : (
        <ol className="space-y-4" aria-label="Chat messages">
          {messages.map((m) => {
            const mine = m.author.id === currentUserId
            const staff = m.author.role !== 'customer'
            return (
              <li key={m.id} className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
                <Avatar name={m.author.name} size="sm" decorative />
                <div className={cn('flex max-w-[80%] min-w-0 flex-col', mine && 'items-end')}>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-semibold text-ink-900">
                      {mine ? 'You' : m.author.name}
                    </span>
                    {staff && !mine && (
                      <span className="rounded bg-brand-50 px-1.5 text-[11px] font-medium text-brand-700">
                        {ROLE_LABELS[m.author.role]}
                      </span>
                    )}
                    <time
                      dateTime={m.createdAt}
                      title={dateTime(m.createdAt)}
                      className="text-ink-400"
                    >
                      {timeAgo(m.createdAt)}
                    </time>
                  </p>
                  {m.internal ? (
                    <div className="mt-1 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-amber-950">
                      <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-wide text-amber-700 uppercase">
                        <Lock className="size-3" aria-hidden /> Internal note · not visible to
                        customer
                      </span>
                      {m.body}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'mt-1 rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap',
                        mine
                          ? 'rounded-tr-sm bg-brand-600 text-white'
                          : staff
                            ? 'rounded-tl-sm bg-brand-50 text-ink-700'
                            : 'rounded-tl-sm bg-canvas text-ink-700',
                      )}
                    >
                      {m.body}
                    </div>
                  )}
                  {m.id === seenId && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
                      <CheckCheck className="size-3.5 text-brand-600" aria-hidden /> Seen
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {typing.length > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-500" aria-live="polite">
          <span className="flex gap-0.5" aria-hidden>
            <span className="size-1.5 animate-bounce rounded-full bg-ink-400 [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-ink-400 [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-ink-400" />
          </span>
          {typing.map((u) => u.name.split(' ')[0]).join(', ')} {typing.length > 1 ? 'are' : 'is'}{' '}
          typing…
        </p>
      )}
    </div>
  )
}
