import { useState } from 'react'
import { TICKET_CATEGORIES } from '@livedesk/shared'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { changePct, useMyStats, type RangeDays } from '@/features/admin/api'
import { CategoryDonut } from '@/features/admin/components/CategoryDonut'
import { RangeSelect } from '@/features/admin/components/RangeSelect'
import { StatCard } from '@/features/admin/components/StatCard'
import { duration } from '@/lib/format'

export function AgentReportsPage() {
  const [days, setDays] = useState<RangeDays>(30)
  const stats = useMyStats(days)
  const s = stats.data
  const period = `vs previous ${days} days`

  return (
    <>
      <PageHeader
        title="My reports"
        description="Your own numbers, from the tickets assigned to you."
        actions={<RangeSelect value={days} onChange={setDays} />}
      />
      {stats.isError ? (
        <Card>
          <ErrorState message={stats.error.message} onRetry={() => void stats.refetch()} />
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
                <StatCard label="Open & assigned to me" value={String(s.openAssigned)} />
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
                <StatCard
                  label={`My rating (${s.csat.count})`}
                  value={s.csat.average === null ? '—' : `${s.csat.average} / 5`}
                />
              </>
            )}
          </div>
          <Card className="mt-6 max-w-xl">
            <CardHeader
              title="My tickets by category"
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
        </>
      )}
    </>
  )
}
