import { useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  isUnread,
  STATUS_LABELS,
  TICKET_STATUSES,
  type TicketStatus,
  type TicketSummary,
} from '@livedesk/shared'
import { CategoryBadge, PriorityBadge } from '@/components/ui/Badge'
import { statusStyles } from '@/components/ui/badge-styles'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { timeAgoShort } from '@/lib/format'
import { UnreadDot } from '@/components/ui/UnreadDot'
import { SlaBadge } from './SlaBadge'

const columnTone: Record<TicketStatus, { column: string; header: string; count: string }> = {
  open: {
    column: 'bg-red-50/40 border-red-100',
    header: 'bg-red-50 text-red-600',
    count: 'bg-red-100 text-red-700',
  },
  in_progress: {
    column: 'bg-amber-50/40 border-amber-100',
    header: 'bg-amber-50 text-amber-700',
    count: 'bg-amber-100 text-amber-800',
  },
  resolved: {
    column: 'bg-emerald-50/40 border-emerald-100',
    header: 'bg-emerald-50 text-emerald-700',
    count: 'bg-emerald-100 text-emerald-800',
  },
  closed: {
    column: 'bg-slate-50 border-slate-200',
    header: 'bg-slate-100 text-slate-600',
    count: 'bg-slate-200 text-slate-700',
  },
}

interface KanbanBoardProps {
  tickets: TicketSummary[]
  ticketHref: (ticket: TicketSummary) => string
  /** When given, cards can be dragged (or moved with the keyboard) between columns. */
  onMove?: (ticket: TicketSummary, to: TicketStatus) => void
  /** Whether a ticket may be dropped in a column (valid transition + permission). */
  canMove?: (ticket: TicketSummary, to: TicketStatus) => boolean
}

const label = (t: TicketSummary | undefined) => (t ? `Ticket ${t.ticketNumber}` : 'Ticket')

export function KanbanBoard({
  tickets,
  ticketHref,
  onMove,
  canMove = () => false,
}: KanbanBoardProps) {
  const [active, setActive] = useState<TicketSummary | null>(null)
  // A drop ends with a click on whatever is under the pointer; swallow it so
  // dropping a card doesn't also open the ticket.
  const justDragged = useRef(false)
  const sensors = useSensors(
    // A small distance threshold keeps normal clicks on the card working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const byId = (id: unknown) => tickets.find((t) => t.id === id)
  const statusOf = (id: unknown) => STATUS_LABELS[id as TicketStatus] ?? 'this column'

  const columns = (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      onClickCapture={(e) => {
        if (justDragged.current) {
          e.preventDefault()
          e.stopPropagation()
          justDragged.current = false
        }
      }}
    >
      {TICKET_STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tickets={tickets.filter((t) => t.status === status)}
          ticketHref={ticketHref}
          draggable={!!onMove}
          canMove={canMove}
          dragging={active}
        />
      ))}
    </div>
  )

  if (!onMove) return columns

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active: a }) => setActive(byId(a.id) ?? null)}
      onDragCancel={() => setActive(null)}
      onDragEnd={({ active: a, over }) => {
        setActive(null)
        justDragged.current = true
        setTimeout(() => (justDragged.current = false), 0)
        const ticket = byId(a.id)
        const to = over?.id as TicketStatus | undefined
        if (ticket && to && to !== ticket.status && canMove(ticket, to)) onMove(ticket, to)
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To move a ticket, press space or enter to pick it up, use the arrow keys to choose a column, then press space or enter to drop it. Press escape to cancel.',
        },
        announcements: {
          onDragStart: ({ active: a }) => `Picked up ${label(byId(a.id))}.`,
          onDragOver: ({ active: a, over }) =>
            over
              ? `${label(byId(a.id))} is over ${statusOf(over.id)}.`
              : `${label(byId(a.id))} is not over a column.`,
          onDragEnd: ({ active: a, over }) =>
            over
              ? `${label(byId(a.id))} dropped on ${statusOf(over.id)}.`
              : `${label(byId(a.id))} dropped.`,
          onDragCancel: ({ active: a }) => `Moving ${label(byId(a.id))} was cancelled.`,
        },
      }}
    >
      {columns}
      <DragOverlay>
        {active ? (
          <div className="rotate-2 cursor-grabbing">
            <KanbanCard ticket={active} href={ticketHref(active)} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface KanbanColumnProps {
  status: TicketStatus
  tickets: TicketSummary[]
  ticketHref: (ticket: TicketSummary) => string
  draggable: boolean
  canMove: (ticket: TicketSummary, to: TicketStatus) => boolean
  dragging: TicketSummary | null
}

function KanbanColumn({
  status,
  tickets,
  ticketHref,
  draggable,
  canMove,
  dragging,
}: KanbanColumnProps) {
  const allowed = !!dragging && dragging.status !== status && canMove(dragging, status)
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !draggable || !allowed })
  const tone = columnTone[status]
  const Icon = statusStyles[status].icon
  const headingId = `column-${status}`
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        'flex min-h-64 flex-col rounded-xl border p-2.5 transition',
        tone.column,
        dragging &&
          dragging.status !== status &&
          (allowed ? 'ring-2 ring-brand-300' : 'opacity-50'),
        isOver && allowed && 'ring-brand-500 ring-offset-2',
      )}
    >
      <h2
        id={headingId}
        className={cn(
          'mb-2.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold',
          tone.header,
        )}
      >
        <Icon className="size-4" aria-hidden />
        {STATUS_LABELS[status]}
        <span className={cn('rounded-full px-1.5 text-[11px] leading-5', tone.count)}>
          {tickets.length}
          <span className="sr-only"> tickets</span>
        </span>
      </h2>
      {tickets.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-ink-400">No tickets</p>
      ) : (
        <ul className="space-y-2.5">
          {tickets.map((t) => (
            <li key={t.id}>
              {draggable ? (
                <DraggableCard ticket={t} href={ticketHref(t)} />
              ) : (
                <KanbanCard ticket={t} href={ticketHref(t)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DraggableCard({ ticket, href }: { ticket: TicketSummary; href: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable ticket"
      aria-label={`${label(ticket)}: ${ticket.subject}`}
      className={cn(
        'cursor-grab rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500',
        isDragging && 'opacity-40',
      )}
    >
      <KanbanCard ticket={ticket} href={href} />
    </div>
  )
}

export function KanbanCard({ ticket, href }: { ticket: TicketSummary; href: string }) {
  return (
    <article className="relative rounded-lg border border-line bg-white p-3.5 shadow-card transition-shadow hover:shadow-pop">
      <div className="flex items-center justify-between gap-2 text-xs text-ink-500">
        <span className="flex items-center gap-1.5 font-medium">
          {isUnread(ticket, 'staff') && <UnreadDot />}#{ticket.ticketNumber}
        </span>
        <time dateTime={ticket.updatedAt}>{timeAgoShort(ticket.updatedAt)}</time>
      </div>
      <h3 className="mt-1 text-[13px] leading-snug font-medium text-ink-900">
        <Link
          to={href}
          className="after:absolute after:inset-0 after:rounded-lg focus:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand-500"
        >
          {ticket.subject}
        </Link>
      </h3>
      <p className="mt-1 truncate text-xs text-ink-500">{ticket.customer.name}</p>
      <SlaBadge ticket={ticket} className="mt-2" />
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <PriorityBadge priority={ticket.priority} />
          <CategoryBadge category={ticket.category} />
        </div>
        {ticket.assignedAgent ? (
          <Avatar name={ticket.assignedAgent.name} size="xs" />
        ) : (
          <span className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[10px] text-ink-400">
            Unassigned
          </span>
        )}
      </div>
    </article>
  )
}
