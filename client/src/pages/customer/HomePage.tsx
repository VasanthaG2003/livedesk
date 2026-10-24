import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Headset, MessageCircle, Plus, SquarePen, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buttonClasses } from '@/components/ui/button-classes'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { SupportHero } from '@/components/illustrations/SupportHero'
import { useCurrentUser } from '@/features/auth/api'
import { useTickets } from '@/features/tickets/api'
import { ChatTicketPicker } from '@/features/tickets/components/ChatTicketPicker'
import { CustomerTicketTable } from '@/features/tickets/components/CustomerTicketTable'
import { StatusTabs } from '@/features/tickets/components/StatusTabs'
import type { StatusFilter } from '@/features/tickets/status-filter'

const quickActions = [
  {
    to: '/app/new-ticket',
    icon: SquarePen,
    title: 'Create New Ticket',
    text: 'Get help with an issue',
  },
  { to: '/app/tickets', icon: Ticket, title: 'View My Tickets', text: 'Check your ticket history' },
  // `to: null` opens the "Chat with us" ticket picker instead of navigating.
  { to: null, icon: MessageCircle, title: 'Contact Support', text: 'Chat with us about a ticket' },
]

const actionRow =
  'group -mx-2 flex w-full items-center gap-3.5 rounded-lg p-2 text-left hover:bg-canvas'

const HOME_LIMIT = 8

export function CustomerHomePage() {
  const user = useCurrentUser()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [chatOpen, setChatOpen] = useState(false)
  // The most recent 50 tickets feed the table and the chat picker; the tab
  // counts come from the server and cover every ticket.
  const tickets = useTickets({ pageSize: 50 })
  const all = tickets.data?.data ?? []
  const visible = (status === 'all' ? all : all.filter((t) => t.status === status)).slice(
    0,
    HOME_LIMIT,
  )
  const counts = tickets.data
    ? { all: tickets.data.meta.total, ...tickets.data.counts }
    : { all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-7">
        <section className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-r from-white via-brand-50/60 to-accent-100/70 p-6 sm:p-7">
          <div className="relative z-10 max-w-md">
            <h1 className="text-xl font-semibold text-ink-900">
              Hi {user.name.split(' ')[0]} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-2 text-[13.5px] text-ink-500">
              We're here to help. Create a support ticket or track your existing requests.
            </p>
            <Link to="/app/new-ticket" className={buttonClasses('primary', 'md', 'mt-5')}>
              <Plus className="size-4" aria-hidden /> Create New Ticket
            </Link>
          </div>
          <SupportHero className="absolute right-4 bottom-0 hidden h-[150px] md:block lg:right-10" />
        </section>

        <section aria-labelledby="my-tickets-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="my-tickets-heading" className="text-base font-semibold text-ink-900">
              My Tickets
            </h2>
            {all.length > 0 && (
              <Link
                to="/app/tickets"
                className="text-[13px] font-medium text-brand-700 hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          <StatusTabs value={status} onChange={setStatus} counts={counts} />
          <Card className="mt-4">
            {tickets.isPending ? (
              <SkeletonRows rows={4} label="Loading your tickets" />
            ) : tickets.isError ? (
              <ErrorState
                message={tickets.error.message}
                onRetry={() => void tickets.refetch()}
                retrying={tickets.isFetching}
              />
            ) : all.length === 0 ? (
              <EmptyState
                title="No tickets yet"
                description="When you raise a ticket, you can track it and chat with our team here."
                action={
                  <Link to="/app/new-ticket" className={buttonClasses('primary', 'sm')}>
                    <Plus className="size-4" aria-hidden /> Create your first ticket
                  </Link>
                }
              />
            ) : visible.length === 0 ? (
              <EmptyState
                title="No tickets here"
                description="Tickets with this status will show up here."
              />
            ) : (
              <CustomerTicketTable tickets={visible} ticketHref={(t) => `/app/tickets/${t.id}`} />
            )}
          </Card>
        </section>
      </div>

      <aside className="space-y-6">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">Quick Actions</h2>
          <ul className="mt-3 space-y-1">
            {quickActions.map(({ to, icon: Icon, title, text }) => {
              const content = (
                <>
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[13px] font-medium text-ink-900">{title}</span>
                    <span className="block text-xs text-ink-500">{text}</span>
                  </span>
                  <ChevronRight
                    className="size-4 text-ink-400 group-hover:text-ink-700"
                    aria-hidden
                  />
                </>
              )
              return (
                <li key={title}>
                  {to ? (
                    <Link to={to} className={actionRow}>
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setChatOpen(true)} className={actionRow}>
                      {content}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">Need immediate help?</h2>
          <div className="mt-4 flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Headset className="size-7" aria-hidden />
            </span>
            <p className="text-[13px] text-ink-500">
              Our support team is available
              <br />
              <span className="text-ink-700">Mon – Fri, 9am – 6pm</span>
            </p>
          </div>
          <Button variant="outline" className="mt-5 w-full" onClick={() => setChatOpen(true)}>
            Chat with us
          </Button>
        </Card>
      </aside>

      <ChatTicketPicker open={chatOpen} onClose={() => setChatOpen(false)} tickets={all} />
    </div>
  )
}
