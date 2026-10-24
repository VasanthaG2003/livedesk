import { Link } from 'react-router'
import { ChevronRight, MessageCircle, Plus } from 'lucide-react'
import type { TicketSummary } from '@livedesk/shared'
import { Dialog } from '@/components/ui/Dialog'
import { StatusBadge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/button-classes'
import { EmptyState } from '@/components/ui/States'
import { timeAgo } from '@/lib/format'
import { CategoryIcon } from './CategoryIcon'

interface ChatTicketPickerProps {
  open: boolean
  onClose: () => void
  tickets: TicketSummary[]
}

/**
 * "Chat with us" always happens inside a ticket, so the agent sees the full
 * context and the conversation is saved in the ticket's history. Closed
 * tickets are read-only and aren't offered; a resolved ticket reopens when
 * the customer writes in it.
 */
export function ChatTicketPicker({ open, onClose, tickets }: ChatTicketPickerProps) {
  const chattable = tickets.filter((t) => t.status !== 'closed')

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Chat with us"
      description="Which ticket is this about? Our team replies in the ticket's chat."
      footer={
        <Link to="/app/new-ticket" onClick={onClose} className={buttonClasses('ghost', 'sm')}>
          <Plus className="size-4" aria-hidden /> Issue not listed? Raise a new ticket
        </Link>
      }
    >
      {chattable.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No active tickets"
          description="Raise a ticket first. You can chat with our team inside it."
        />
      ) : (
        <ul className="-mx-2 max-h-80 space-y-1 overflow-y-auto">
          {chattable.map((t) => (
            <li key={t.id}>
              <Link
                to={`/app/tickets/${t.id}?chat=1`}
                onClick={onClose}
                className="group flex items-center gap-3 rounded-lg p-2 hover:bg-canvas"
              >
                <CategoryIcon category={t.category} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-500">#{t.ticketNumber}</span>
                  <span className="block truncate text-[13px] font-medium text-ink-900">
                    {t.subject}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                    <StatusBadge status={t.status} />
                    <time dateTime={t.updatedAt}>{timeAgo(t.updatedAt)}</time>
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-ink-400 group-hover:text-ink-700"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
