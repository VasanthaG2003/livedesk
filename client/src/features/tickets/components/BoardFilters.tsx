import { Search } from 'lucide-react'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type UserRef,
} from '@livedesk/shared'
import { Input, Select } from '@/components/ui/Field'
import type { TicketFilters } from '../filters'

interface BoardFiltersProps {
  value: TicketFilters
  onChange: (value: TicketFilters) => void
  agents: UserRef[]
  /** The Kanban board already groups by status, so it hides this filter. */
  showStatus?: boolean
}

export function BoardFilters({ value, onChange, agents, showStatus = false }: BoardFiltersProps) {
  const set = <K extends keyof TicketFilters>(key: K, v: TicketFilters[K]) =>
    onChange({ ...value, [key]: v })
  return (
    <div className="flex flex-wrap gap-2.5">
      <div className="relative w-full sm:w-64">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search tickets"
          placeholder="Search subject, ID, customer"
          className="h-9 pl-9 text-[13px]"
          value={value.q}
          onChange={(e) => set('q', e.target.value)}
        />
      </div>
      {showStatus && (
        <Select
          aria-label="Status"
          className="h-9 w-auto text-[13px]"
          value={value.status}
          onChange={(e) => set('status', e.target.value as TicketStatus | '')}
        >
          <option value="">All Statuses</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      )}
      <Select
        aria-label="Category"
        className="h-9 w-auto text-[13px]"
        value={value.category}
        onChange={(e) => set('category', e.target.value as TicketCategory | '')}
      >
        <option value="">All Categories</option>
        {TICKET_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Priority"
        className="h-9 w-auto text-[13px]"
        value={value.priority}
        onChange={(e) => set('priority', e.target.value as TicketPriority | '')}
      >
        <option value="">All Priorities</option>
        {TICKET_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Assignee"
        className="h-9 w-auto text-[13px]"
        value={value.assignee}
        onChange={(e) => set('assignee', e.target.value)}
      >
        <option value="">All Assignees</option>
        <option value="me">Assigned to me</option>
        <option value="unassigned">Unassigned</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
    </div>
  )
}
