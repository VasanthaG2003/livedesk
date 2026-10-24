import { useState } from 'react'
import { Link } from 'react-router'
import { Card, CardHeader } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  changePct,
  useActivityFeed,
  useAdminStats,
  useAudit,
  type RangeDays,
} from '@/features/admin/api'
import { RangeSelect } from '@/features/admin/components/RangeSelect'
import { StatCard } from '@/features/admin/components/StatCard'
import { Stars } from '@/features/tickets/components/RatingCard'
import { ActivityTimeline } from '@/features/tickets/components/ActivityTimeline'
import { duration, timeAgo } from '@/lib/format'

const auditText = {
  'user.deactivated': 'deactivated',
  'user.activated': 'reactivated',
  'agent.created': 'created agent account for',
}

export function AdminReportsPage() {
  const [days, setDays] = useState<RangeDays>(30)
  const stats = useAdminStats(days)
  const feed = useActivityFeed()
  const audit = useAudit()
  const s = stats.data
  const period = `vs previous ${days} days`
  const ms = (v: number | null | undefined) => (v === null || v === undefined ? '—' : duration(v))

  return (
    <>
      <PageHeader
        title="Reports"
        description="Response times, customer satisfaction, team performance and the audit trail."
        actions={<RangeSelect value={days} onChange={setDays} />}
      />
      {stats.isError ? (
        <Card>
          <ErrorState message={stats.error.message} onRetry={() => void stats.refetch()} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {!s ? (
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[98px] rounded-xl" />
            ))
          ) : (
            <>
              <StatCard
                label="First replies on time"
                value={s.slaMetPct.current === null ? '—' : `${s.slaMetPct.current}%`}
                changePct={changePct(s.slaMetPct)}
                period={period}
              />
              <StatCard
                label="Avg. first response"
                value={ms(s.avgFirstResponseMs.current)}
                changePct={changePct(s.avgFirstResponseMs)}
                lowerIsBetter
                period={period}
              />
              <StatCard
                label="Avg. time to resolve"
                value={ms(s.avgResolutionMs.current)}
                changePct={changePct(s.avgResolutionMs)}
                lowerIsBetter
                period={period}
              />
              <StatCard
                label={`Customer rating (${s.csat.count})`}
                value={s.csat.average === null ? '—' : `${s.csat.average} / 5`}
              />
            </>
          )}
        </div>
      )}

      <Card className="mt-6 min-w-0">
        <CardHeader title="Agent leaderboard" description={`Last ${days} days`} />
        <div className="mt-3 overflow-x-auto">
          {!s ? (
            <SkeletonRows rows={3} />
          ) : s.agents.length === 0 ? (
            <EmptyState title="No active agents" />
          ) : (
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs text-ink-500">
                  <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">
                    Agent
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Resolved
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Open now
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Avg. first response
                  </th>
                  <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...s.agents]
                  .sort((a, b) => b.resolved - a.resolved)
                  .map((a) => (
                    <tr key={a.agent.id}>
                      <td className="py-3 pr-3 pl-5">
                        <span className="flex items-center gap-2.5 font-medium text-ink-900">
                          <span className="relative">
                            <Avatar name={a.agent.name} size="sm" decorative />
                            <span
                              className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-white ${a.online ? 'bg-emerald-500' : 'bg-ink-300'}`}
                              role="img"
                              aria-label={a.online ? 'Online' : 'Offline'}
                            />
                          </span>
                          {a.agent.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{a.resolved}</td>
                      <td className="px-3 py-3 tabular-nums">{a.openAssigned}</td>
                      <td className="px-3 py-3 tabular-nums">{ms(a.avgFirstResponseMs)}</td>
                      <td className="py-3 pr-5 pl-3">
                        {a.csat === null ? (
                          <span className="text-ink-400">No ratings</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Stars score={Math.round(a.csat)} />{' '}
                            <span className="text-xs text-ink-500">
                              {a.csat} ({a.csatCount})
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent ticket activity"
            description="Latest 50 changes across all tickets"
          />
          <div className="max-h-[440px] overflow-y-auto px-5 pt-4 pb-5">
            {feed.isPending ? (
              <SkeletonRows rows={4} />
            ) : feed.isError ? (
              <ErrorState message={feed.error.message} onRetry={() => void feed.refetch()} />
            ) : feed.data.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ActivityTimeline
                activity={feed.data}
                ticketLink={(a) => {
                  const item = feed.data.find((f) => f.id === a.id)
                  return item ? (
                    <Link
                      to={`/admin/tickets/${item.ticketId}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {item.ticketNumber}
                    </Link>
                  ) : null
                }}
              />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Audit log" description="Account changes made by admins" />
          <div className="px-5 pt-3 pb-5">
            {audit.isPending ? (
              <SkeletonRows rows={3} />
            ) : audit.isError ? (
              <ErrorState message={audit.error.message} onRetry={() => void audit.refetch()} />
            ) : audit.data.length === 0 ? (
              <EmptyState
                title="No admin actions yet"
                description="Deactivating users or adding agents shows up here."
              />
            ) : (
              <ul className="divide-y divide-line">
                {audit.data.map((e) => (
                  <li key={e.id} className="py-2.5 text-[13px] text-ink-700">
                    <span className="font-medium text-ink-900">{e.actor.name}</span>{' '}
                    {auditText[e.action]}{' '}
                    <span className="font-medium text-ink-900">
                      {e.target?.name ?? 'a deleted user'}
                    </span>
                    <time dateTime={e.createdAt} className="block text-xs text-ink-400">
                      {timeAgo(e.createdAt)}
                    </time>
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
