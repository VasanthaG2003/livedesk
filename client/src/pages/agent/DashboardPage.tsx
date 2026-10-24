import { Link } from 'react-router'
import { Inbox } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/features/admin/components/StatCard'
import { TicketsTable } from '@/features/admin/components/TicketsTable'
import { useCurrentUser } from '@/features/auth/api'
import { useTickets } from '@/features/tickets/api'
import { KanbanCard } from '@/features/tickets/components/KanbanBoard'

export function AgentDashboardPage() {
  const me = useCurrentUser()
  const mine = useTickets({ assignee: 'me', pageSize: 6 })
  const queue = useTickets({ assignee: 'unassigned', status: 'open', pageSize: 5 })
  const c = mine.data?.counts
  const stat = (n: number | undefined) => (n === undefined ? '–' : String(n))

  return (
    <>
      <PageHeader
        title={`Welcome back, ${me.name.split(' ')[0]}`}
        description="Here's what's on your plate today."
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Assigned to me" value={stat(mine.data?.meta.total)} />
        <StatCard label="Open" value={stat(c?.open)} />
        <StatCard label="In Progress" value={stat(c?.in_progress)} />
        <StatCard label="Resolved" value={stat(c?.resolved)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <CardHeader
            title="Recently updated"
            description="Your assigned tickets"
            action={
              <Link
                to="/agent/tickets"
                className="text-[13px] font-medium text-brand-700 hover:underline"
              >
                View board
              </Link>
            }
          />
          <div className="mt-3">
            {mine.isPending ? (
              <SkeletonRows rows={4} />
            ) : mine.isError ? (
              <ErrorState message={mine.error.message} onRetry={() => void mine.refetch()} />
            ) : mine.data.data.length === 0 ? (
              <EmptyState
                title="Nothing assigned to you"
                description="Pick a ticket from the unassigned queue."
              />
            ) : (
              <TicketsTable tickets={mine.data.data} ticketHref={(t) => `/agent/tickets/${t.id}`} />
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">Unassigned queue</h2>
          <p className="text-xs text-ink-500">Open a ticket and reply, or assign it to yourself.</p>
          <div className="mt-4">
            {queue.isPending ? (
              <SkeletonRows rows={3} />
            ) : queue.isError ? (
              <ErrorState message={queue.error.message} onRetry={() => void queue.refetch()} />
            ) : queue.data.data.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Queue is empty"
                description="New tickets will show up here."
              />
            ) : (
              <ul className="space-y-2.5">
                {queue.data.data.map((t) => (
                  <li key={t.id}>
                    <KanbanCard ticket={t} href={`/agent/tickets/${t.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
