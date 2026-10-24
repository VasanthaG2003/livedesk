import { STATUS_LABELS, TICKET_STATUSES } from '@livedesk/shared'
import type { StatusFilter } from '../status-filter'
import { cn } from '@/lib/cn'

interface StatusTabsProps {
  value: StatusFilter
  onChange: (value: StatusFilter) => void
  counts: Record<StatusFilter, number>
}

const options: StatusFilter[] = ['all', ...TICKET_STATUSES]

export function StatusTabs({ value, onChange, counts }: StatusTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by status"
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {options.map((option) => {
        const selected = option === value
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              selected
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            {option === 'all' ? 'All' : STATUS_LABELS[option]} ({counts[option]})
          </button>
        )
      })}
    </div>
  )
}
