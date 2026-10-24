import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Plus, Search } from 'lucide-react'
import { CATEGORY_LABELS, TICKET_CATEGORIES, type TicketCategory } from '@livedesk/shared'
import { Card } from '@/components/ui/Card'
import { buttonClasses } from '@/components/ui/button-classes'
import { Input, Select } from '@/components/ui/Field'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { useTickets } from '@/features/tickets/api'
import { CustomerTicketTable } from '@/features/tickets/components/CustomerTicketTable'
import { StatusTabs } from '@/features/tickets/components/StatusTabs'
import type { StatusFilter } from '@/features/tickets/status-filter'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const PAGE_SIZE = 10

export function MyTicketsPage() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<TicketCategory | ''>('')
  const [page, setPage] = useState(1)
  const q = params.get('q') ?? ''
  const debouncedQ = useDebouncedValue(q)

  const tickets = useTickets({
    page,
    pageSize: PAGE_SIZE,
    q: debouncedQ || undefined,
    category: category || undefined,
    status: status === 'all' ? undefined : status,
  })
  const counts = tickets.data
    ? {
        all: Object.values(tickets.data.counts).reduce((a, b) => a + b, 0),
        ...tickets.data.counts,
      }
    : { all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 }
  const filtering = !!(debouncedQ || category || status !== 'all')

  return (
    <>
      <PageHeader
        title="My Tickets"
        description="Track the status of your support requests."
        actions={
          <Link to="/app/new-ticket" className={buttonClasses('primary')}>
            <Plus className="size-4" aria-hidden /> New Ticket
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search your tickets"
            placeholder="Search by subject or ID"
            className="pl-9"
            value={q}
            onChange={(e) => {
              setPage(1)
              setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
            }}
          />
        </div>
        <Select
          aria-label="Filter by category"
          className="sm:w-48"
          value={category}
          onChange={(e) => {
            setPage(1)
            setCategory(e.target.value as TicketCategory | '')
          }}
        >
          <option value="">All categories</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>
      <StatusTabs
        value={status}
        onChange={(s) => {
          setPage(1)
          setStatus(s)
        }}
        counts={counts}
      />
      <Card className="mt-4">
        {tickets.isPending ? (
          <SkeletonRows rows={5} label="Loading your tickets" />
        ) : tickets.isError ? (
          <ErrorState
            message={tickets.error.message}
            onRetry={() => void tickets.refetch()}
            retrying={tickets.isFetching}
          />
        ) : tickets.data.data.length === 0 ? (
          filtering ? (
            <EmptyState
              title="No matching tickets"
              description="Try a different search or filter."
            />
          ) : (
            <EmptyState
              title="No tickets yet"
              description="Raise a ticket and you can follow its progress here."
              action={
                <Link to="/app/new-ticket" className={buttonClasses('primary', 'sm')}>
                  <Plus className="size-4" aria-hidden /> Create a ticket
                </Link>
              }
            />
          )
        ) : (
          <>
            <CustomerTicketTable
              tickets={tickets.data.data}
              ticketHref={(t) => `/app/tickets/${t.id}`}
            />
            <Pagination meta={tickets.data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
