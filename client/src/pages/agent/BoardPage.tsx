import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Card } from '@/components/ui/Card'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import {
  STATUS_LABELS,
  canTransition,
  type TicketStatus,
  type TicketSummary,
} from '@livedesk/shared'
import { useCurrentUser } from '@/features/auth/api'
import { useAgents, useMoveTicket, useTickets } from '@/features/tickets/api'
import { BoardFilters } from '@/features/tickets/components/BoardFilters'
import { KanbanBoard } from '@/features/tickets/components/KanbanBoard'
import { emptyFilters, toListParams } from '@/features/tickets/filters'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const BOARD_LIMIT = 100

export function AgentBoardPage() {
  const [params] = useSearchParams()
  const [filters, setFilters] = useState({ ...emptyFilters, q: params.get('q') ?? '' })
  const debounced = useDebouncedValue(filters)
  const agents = useAgents()
  const tickets = useTickets({ ...toListParams(debounced), pageSize: BOARD_LIMIT })
  const me = useCurrentUser()
  const move = useMoveTicket()

  // Mirrors the server rules so invalid columns are greyed out while dragging;
  // the server still has the final say.
  const canMove = (t: TicketSummary, to: TicketStatus) =>
    canTransition(t.status, to) && (!t.assignedAgent || t.assignedAgent.id === me.id)

  const onMove = (ticket: TicketSummary, to: TicketStatus) =>
    move.mutate(
      { ticket, to },
      {
        onSuccess: () => toast.success(`${ticket.ticketNumber} moved to ${STATUS_LABELS[to]}`),
        onError: (err) => toast.error(`Couldn't move ${ticket.ticketNumber}: ${err.message}`),
      },
    )

  return (
    <>
      <PageHeader title="Tickets" description="Manage and resolve customer issues in real time." />
      <div className="mb-5">
        <BoardFilters value={filters} onChange={setFilters} agents={agents.data ?? []} />
      </div>
      {tickets.isPending ? (
        <Card>
          <SkeletonRows rows={6} label="Loading tickets" />
        </Card>
      ) : tickets.isError ? (
        <Card>
          <ErrorState
            message={tickets.error.message}
            onRetry={() => void tickets.refetch()}
            retrying={tickets.isFetching}
          />
        </Card>
      ) : (
        <>
          {tickets.data.meta.total > BOARD_LIMIT && (
            <p className="mb-3 text-xs text-ink-500">
              Showing the {BOARD_LIMIT} most recently updated of {tickets.data.meta.total} tickets.
              Use the filters to narrow down.
            </p>
          )}
          <p className="mb-3 text-xs text-ink-500">
            Drag a card to change its status. Columns you can't drop into are greyed out.
          </p>
          <KanbanBoard
            tickets={tickets.data.data}
            ticketHref={(t) => `/agent/tickets/${t.id}`}
            onMove={onMove}
            canMove={canMove}
          />
        </>
      )}
    </>
  )
}
