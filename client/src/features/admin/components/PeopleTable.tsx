import type { ReactNode } from 'react'
import type { UserListItem } from '@livedesk/shared'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { timeAgoShort } from '@/lib/format'

interface PeopleTableProps {
  rows: UserListItem[]
  /** Column label for the ticket counts (e.g. "Tickets" or "Assigned"). */
  ticketsLabel: string
  /** When given, shows a live online/offline dot (agents). */
  onlineIds?: Set<string>
  renderActions?: (row: UserListItem) => ReactNode
}

export function PeopleTable({ rows, ticketsLabel, onlineIds, renderActions }: PeopleTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-xs text-ink-500">
            <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">
              Name
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              {ticketsLabel}
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Open
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Last activity
            </th>
            {renderActions && (
              <th scope="col" className="py-2.5 pr-5 pl-3">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const online = onlineIds?.has(r.id)
            return (
              <tr key={r.id} className="hover:bg-canvas/70">
                <td className="py-3 pr-3 pl-5">
                  <div className="flex items-center gap-3">
                    <span className="relative">
                      <Avatar name={r.name} size="sm" decorative />
                      {onlineIds && (
                        <span
                          className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-white ${online ? 'bg-emerald-500' : 'bg-ink-300'}`}
                          role="img"
                          aria-label={online ? 'Online' : 'Offline'}
                        />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">{r.name}</p>
                      <p className="truncate text-xs text-ink-500">{r.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {r.isActive ? (
                    <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600">Deactivated</Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-700 tabular-nums">{r.totalTickets}</td>
                <td className="px-3 py-3 text-ink-700 tabular-nums">{r.openTickets}</td>
                <td className="px-3 py-3 text-ink-500">
                  {r.lastActivityAt ? (
                    <time dateTime={r.lastActivityAt}>{timeAgoShort(r.lastActivityAt)}</time>
                  ) : (
                    '—'
                  )}
                </td>
                {renderActions && <td className="py-3 pr-5 pl-3 text-right">{renderActions(r)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
