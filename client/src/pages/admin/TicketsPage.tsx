import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { TicketsTable } from '@/features/admin/components/TicketsTable'
import { useAgents, useTickets } from '@/features/tickets/api'
import { BoardFilters } from '@/features/tickets/components/BoardFilters'
import { emptyFilters, toListParams } from '@/features/tickets/filters'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const PAGE_SIZE = 15

export function AdminTicketsPage() {
  const [params] = useSearchParams()
  const [filters, setFilters] = useState({ ...emptyFilters, q: params.get('q') ?? '' })
  const [page, setPage] = useState(1)
  const debounced = useDebouncedValue(filters)
  const agents = useAgents()
  const tickets = useTickets({ ...toListParams(debounced), page, pageSize: PAGE_SIZE })

  return (
    <>
      <PageHeader title="Tickets" description="Search, filter and manage every ticket." />
      <div className="mb-4">
        <BoardFilters
          value={filters}
          onChange={(f) => {
            setFilters(f)
            setPage(1)
          }}
          agents={agents.data ?? []}
          showStatus
        />
      </div>
      <Card>
        {tickets.isPending ? (
          <SkeletonRows rows={6} label="Loading tickets" />
        ) : tickets.isError ? (
          <ErrorState
            message={tickets.error.message}
            onRetry={() => void tickets.refetch()}
            retrying={tickets.isFetching}
          />
        ) : tickets.data.data.length === 0 ? (
          <EmptyState title="No tickets match these filters" />
        ) : (
          <>
            <TicketsTable
              tickets={tickets.data.data}
              ticketHref={(t) => `/admin/tickets/${t.id}`}
              showAssignee
            />
            <Pagination meta={tickets.data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
