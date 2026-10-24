import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { isUnread, type TicketSummary } from '@livedesk/shared'
import { UnreadDot } from '@/components/ui/UnreadDot'
import { CategoryBadge, StatusBadge } from '@/components/ui/Badge'
import { timeAgo } from '@/lib/format'
import { CategoryIcon } from './CategoryIcon'

interface CustomerTicketTableProps {
  tickets: TicketSummary[]
  /** Builds the link to a ticket's detail page. */
  ticketHref: (ticket: TicketSummary) => string
}

export function CustomerTicketTable({ tickets, ticketHref }: CustomerTicketTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left sm:min-w-[640px]">
        <thead>
          <tr className="border-b border-line text-xs font-medium text-ink-500">
            <th scope="col" className="py-3 pr-4 pl-5 font-medium">
              ID / Subject
            </th>
            <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
              Category
            </th>
            <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
              Status
            </th>
            <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
              Last Updated
            </th>
            <th scope="col" className="w-12 py-3 pr-5">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {tickets.map((t) => (
            <tr key={t.id} className="group relative transition-colors hover:bg-canvas/70">
              <td className="py-3.5 pr-4 pl-5">
                <div className="flex items-center gap-3.5">
                  <CategoryIcon category={t.category} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                      {isUnread(t, 'customer') && <UnreadDot />}#{t.ticketNumber}
                      {isUnread(t, 'customer') && <span className="text-brand-700">New reply</span>}
                    </p>
                    {/* The stretched link makes the whole row clickable while
                        keeping a single, properly labelled link per row. */}
                    <Link
                      to={ticketHref(t)}
                      className="block truncate text-[13.5px] font-medium text-ink-900 after:absolute after:inset-0 focus:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-500"
                    >
                      {t.subject}
                    </Link>
                    {/* On phones the extra columns are hidden; show the essentials here. */}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-500 sm:hidden">
                      <StatusBadge status={t.status} />
                      <time dateTime={t.updatedAt}>{timeAgo(t.updatedAt)}</time>
                    </div>
                  </div>
                </div>
              </td>
              <td className="hidden px-4 py-3.5 sm:table-cell">
                <CategoryBadge category={t.category} />
              </td>
              <td className="hidden px-4 py-3.5 sm:table-cell">
                <StatusBadge status={t.status} />
              </td>
              <td className="hidden px-4 py-3.5 text-[13px] text-ink-500 sm:table-cell">
                <time dateTime={t.updatedAt}>{timeAgo(t.updatedAt)}</time>
              </td>
              <td className="py-3.5 pr-5 text-ink-400 group-hover:text-ink-700">
                <ChevronRight className="size-4" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
