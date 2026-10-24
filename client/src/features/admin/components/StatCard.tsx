import { ArrowDown, ArrowUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface StatCardProps {
  label: string
  value: string
  /**
   * Percent change vs the previous period. null = not enough history (shows "—");
   * undefined = this card doesn't show a trend.
   */
  changePct?: number | null
  /** For metrics like response time, going down is the good direction. */
  lowerIsBetter?: boolean
  period?: string
}

export function StatCard({
  label,
  value,
  changePct,
  lowerIsBetter = false,
  period = 'vs last week',
}: StatCardProps) {
  const up = (changePct ?? 0) >= 0
  const good = lowerIsBetter ? !up : up
  return (
    <Card className="p-5">
      <p className="text-[13px] text-ink-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-[26px] leading-none font-semibold tracking-tight text-ink-900">
          {value}
        </p>
        {changePct === undefined ? null : changePct === null ? (
          <span className="text-xs text-ink-400" title="Not enough history to compare">
            —
          </span>
        ) : (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              good ? 'text-emerald-600' : 'text-red-600',
            )}
            title={period}
          >
            {up ? (
              <ArrowUp className="size-3.5" aria-hidden />
            ) : (
              <ArrowDown className="size-3.5" aria-hidden />
            )}
            {Math.abs(changePct)}%
            <span className="sr-only">
              {' '}
              {up ? 'up' : 'down'} {period}
            </span>
          </span>
        )}
      </div>
    </Card>
  )
}
