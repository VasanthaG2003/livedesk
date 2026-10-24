import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Bell, CircleDot, MessageCircle, Ticket, UserCheck } from 'lucide-react'
import type { NotificationKind } from '@livedesk/shared'
import { timeAgoShort } from '@/lib/format'
import { useRealtime } from './RealtimeContext'

const icons: Record<NotificationKind, typeof Bell> = {
  created: Ticket,
  message: MessageCircle,
  assigned: UserCheck,
  status: CircleDot,
}

/** Live notifications for this session (they aren't stored on the server). */
export function NotificationBell({ ticketPath }: { ticketPath: (ticketId: string) => string }) {
  const { notifications, unreadNotifications, markNotificationsSeen } = useRealtime()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          unreadNotifications ? `Notifications, ${unreadNotifications} new` : 'Notifications'
        }
        onClick={() => {
          setOpen((o) => !o)
          markNotificationsSeen()
        }}
        className="relative rounded-md p-2 text-ink-500 hover:bg-canvas hover:text-ink-700"
      >
        <Bell className="size-5" aria-hidden />
        {unreadNotifications > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-pop"
        >
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink-900">
            Notifications
          </p>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">You're all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {notifications.map((n) => {
                const Icon = icons[n.kind]
                return (
                  <li key={n.id}>
                    <Link
                      to={ticketPath(n.ticketId)}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 hover:bg-canvas"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink-900">
                          {n.title}
                        </span>
                        <span className="block truncate text-xs text-ink-500">{n.body}</span>
                        <time dateTime={n.createdAt} className="text-[11px] text-ink-400">
                          {timeAgoShort(n.createdAt)}
                        </time>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
