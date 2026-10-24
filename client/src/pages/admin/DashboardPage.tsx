import { useState } from 'react'
import { Link } from 'react-router'
import { ChartColumn, Settings, Ticket, UserCog, UserPlus } from 'lucide-react'
import { TICKET_CATEGORIES } from '@livedesk/shared'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { changePct, useAdminStats, type RangeDays } from '@/features/admin/api'
import { CategoryDonut } from '@/features/admin/components/CategoryDonut'
import { RangeSelect } from '@/features/admin/components/RangeSelect'
import { StatCard } from '@/features/admin/components/StatCard'
import { TicketTrendsChart } from '@/features/admin/components/TicketTrendsChart'
import { TicketsTable } from '@/features/admin/components/TicketsTable'
import { useRealtime } from '@/features/realtime/RealtimeContext'
import { useTickets } from '@/features/tickets/api'
import { duration } from '@/lib/format'

const quickActions = [
  { to: '/admin/tickets', label: 'Manage tickets', icon: Ticket },
  { to: '/admin/customers', label: 'Manage users', icon: UserCog },
  { to: '/admin/agents', label: 'Add an agent', icon: UserPlus },
  { to: '/admin/reports', label: 'View reports', icon: ChartColumn },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminDashboardPage() {
  const [days, setDays] = useState<RangeDays>(7)
  const stats = useAdminStats(days)
  const recent = useTickets({ pageSize: 5 })
  const { onlineAgentIds } = useRealtime()
  const s = stats.data
  const period = `vs previous ${days} days`

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Live numbers, calculated from your ticket data."
        actions={<RangeSelect value={days} onChange={setDays} />}
      />

      {stats.isError ? (
        <Card>
          <ErrorState
            message={stats.error.message}
            onRetry={() => void stats.refetch()}
            retrying={stats.isFetching}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {!s ? (
              Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[98px] rounded-xl" />
              ))
            ) : (
              <>
                <StatCard
                  label={`Tickets created (${days}d)`}
                  value={String(s.created.current ?? 0)}
                  changePct={changePct(s.created)}
                  period={period}
                />
                <StatCard
                  label="Open right now"
                  value={String(s.byStatus.open + s.byStatus.in_progress)}
                />
                <StatCard
                  label={`Resolved (${days}d)`}
                  value={String(s.resolved.current ?? 0)}
                  changePct={changePct(s.resolved)}
                  period={period}
                />
                <StatCard
                  label="Avg. first response"
                  value={
                    s.avgFirstResponseMs.current === null
                      ? '—'
                      : duration(s.avgFirstResponseMs.current)
                  }
                  changePct={changePct(s.avgFirstResponseMs)}
                  lowerIsBetter
                  period={period}
                />
              </>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <Card className="min-w-0">
              <CardHeader
                title="Ticket trends"
                description={`Created vs resolved, last ${days} days`}
              />
              <div className="px-5 pt-1 pb-4">
                {s ? <TicketTrendsChart data={s.trend} /> : <Skeleton className="h-64" />}
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Tickets by category"
                description={`Created in the last ${days} days`}
              />
              <div className="p-5">
                {!s ? (
                  <Skeleton className="h-40" />
                ) : TICKET_CATEGORIES.every((c) => s.byCategory[c] === 0) ? (
                  <EmptyState title="No tickets in this period" />
                ) : (
                  <CategoryDonut counts={s.byCategory} />
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="min-w-0">
          <CardHeader
            title="Recent tickets"
            action={
              <Link
                to="/admin/tickets"
                className="text-[13px] font-medium text-brand-700 hover:underline"
              >
                View all
              </Link>
            }
          />
          <div className="mt-3">
            {recent.isPending ? (
              <SkeletonRows rows={4} />
            ) : recent.isError ? (
              <ErrorState message={recent.error.message} onRetry={() => void recent.refetch()} />
            ) : recent.data.data.length === 0 ? (
              <EmptyState title="No tickets yet" />
            ) : (
              <TicketsTable
                tickets={recent.data.data}
                ticketHref={(t) => `/admin/tickets/${t.id}`}
              />
            )}
          </div>
        </Card>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink-900">Quick actions</h2>
            <ul className="mt-3 space-y-0.5">
              {quickActions.map(({ to, label, icon: Icon }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink-700 hover:bg-canvas hover:text-brand-700"
                  >
                    <Icon className="size-4 text-brand-600" aria-hidden /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink-900">Team status</h2>
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden /> Live
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-[13px]">
              {[
                ['Agents online', onlineAgentIds.length],
                ['Active agents', s?.team.totalAgents ?? '–'],
                ['Open tickets', s ? s.byStatus.open + s.byStatus.in_progress : '–'],
                [
                  'First replies on time',
                  s?.slaMetPct.current === null || !s ? '—' : `${s.slaMetPct.current}%`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-ink-500">{label}</dt>
                  <dd className="font-medium text-ink-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
