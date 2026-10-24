import { cn } from '@/lib/cn'
import type { RangeDays } from '../api'

const options: RangeDays[] = [7, 30, 90]

export function RangeSelect({
  value,
  onChange,
}: {
  value: RangeDays
  onChange: (d: RangeDays) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Time range"
      className="inline-flex rounded-lg border border-line bg-white p-0.5 text-xs font-medium"
    >
      {options.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className={cn(
            'rounded-md px-3 py-1.5 transition-colors',
            value === d ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-900',
          )}
        >
          {d} days
        </button>
      ))}
    </div>
  )
}
