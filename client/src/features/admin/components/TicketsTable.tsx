import { Link } from 'react-router'
import { isUnread, type TicketSummary } from '@livedesk/shared'
import { UnreadDot } from '@/components/ui/UnreadDot'
import { SlaBadge } from '@/features/tickets/components/SlaBadge'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { timeAgoShort } from '@/lib/format'

interface TicketsTableProps {
  tickets: TicketSummary[]
  ticketHref: (ticket: TicketSummary) => string
  showAssignee?: boolean
}

/** Dense staff-facing ticket table (admin dashboard, admin/agent ticket lists). */
export function TicketsTable({ tickets, ticketHref, showAssignee = false }: TicketsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-xs text-ink-500">
            <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">
              ID
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Subject
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Customer
            </th>
            {showAssignee && (
              <th scope="col" className="px-3 py-2.5 font-medium">
                Assignee
              </th>
            )}
            <th scope="col" className="px-3 py-2.5 font-medium">
              Priority
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Status
            </th>
            <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tickets.map((t) => (
            <tr key={t.id} className="hover:bg-canvas/70">
              <td className="py-3 pr-3 pl-5 font-medium whitespace-nowrap text-ink-700">
                <span className="flex items-center gap-1.5">
                  {isUnread(t, 'staff') && <UnreadDot />}#{t.ticketNumber}
                </span>
              </td>
              <td className="max-w-[220px] truncate px-3 py-3">
                <Link
                  to={ticketHref(t)}
                  className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
                >
                  {t.subject}
                </Link>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-ink-700">{t.customer.name}</td>
              {showAssignee && (
                <td className="px-3 py-3 whitespace-nowrap">
                  {t.assignedAgent ? (
                    <span className="flex items-center gap-2 text-ink-700">
                      <Avatar name={t.assignedAgent.name} size="xs" decorative />
                      {t.assignedAgent.name}
                    </span>
                  ) : (
                    <span className="text-ink-400">Unassigned</span>
                  )}
                </td>
              )}
              <td className="px-3 py-3">
                <PriorityBadge priority={t.priority} />
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={t.status} />
                  <SlaBadge ticket={t} />
                </div>
              </td>
              <td className="py-3 pr-5 pl-3 whitespace-nowrap text-ink-500">
                <time dateTime={t.updatedAt}>{timeAgoShort(t.updatedAt)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
