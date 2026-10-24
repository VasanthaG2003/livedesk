import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import { TREND_COLORS } from './chartColors'

export interface TrendPoint {
  /** YYYY-MM-DD */
  day: string
  created: number
  resolved: number
}

const series = [
  { key: 'created', label: 'Created' },
  { key: 'resolved', label: 'Resolved' },
] as const

const tick = { fill: '#8590a5', fontSize: 11 }

export function TicketTrendsChart({ data }: { data: TrendPoint[] }) {
  // "2026-10-23" is a calendar day, not an instant: parse it as local midnight.
  const rows = data.map((d) => ({ ...d, label: format(new Date(`${d.day}T00:00:00`), 'MMM d') }))
  return (
    <figure>
      <figcaption className="sr-only">Tickets created and resolved per day</figcaption>
      <ul className="mb-3 flex flex-wrap justify-end gap-4 text-xs text-ink-500" aria-hidden>
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: TREND_COLORS[s.key] }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="#eef1f6" />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} dy={6} />
            <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: '#d5dbe7' }}
              contentStyle={{ borderRadius: 8, borderColor: '#e7ebf3', fontSize: 12 }}
              labelStyle={{ color: '#141b2d', fontWeight: 600 }}
              itemStyle={{ color: '#2f384c', padding: 0 }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={TREND_COLORS[s.key]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Screen-reader table view of the same numbers. */}
      <table className="sr-only">
        <caption>Daily ticket counts</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <th scope="row">{r.label}</th>
              <td>{r.created}</td>
              <td>{r.resolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
