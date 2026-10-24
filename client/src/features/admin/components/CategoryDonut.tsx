import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORY_LABELS, TICKET_CATEGORIES, type TicketCategory } from '@livedesk/shared'
import { CATEGORY_COLORS } from './chartColors'

export function CategoryDonut({ counts }: { counts: Record<TicketCategory, number> }) {
  const total = TICKET_CATEGORIES.reduce((sum, c) => sum + counts[c], 0)
  const data = TICKET_CATEGORIES.filter((c) => counts[c] > 0).map((c) => ({
    name: CATEGORY_LABELS[c],
    value: counts[c],
    fill: CATEGORY_COLORS[c],
  }))
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-40 shrink-0" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e7ebf3', fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-ink-900">{total}</span>
          <span className="text-xs text-ink-500">Total</span>
        </div>
      </div>
      {/* The legend doubles as the accessible data list. */}
      <ul
        className="w-full space-y-2.5 text-[13px]"
        aria-label={`Tickets by category, ${total} total`}
      >
        {TICKET_CATEGORIES.filter((c) => counts[c] > 0).map((c) => (
          <li key={c} className="flex items-center gap-2.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: CATEGORY_COLORS[c] }}
              aria-hidden
            />
            <span className="flex-1 text-ink-700">{CATEGORY_LABELS[c]}</span>
            <span className="font-medium text-ink-900 tabular-nums">{pct(counts[c])}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
