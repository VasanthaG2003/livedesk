import { useEffect, useId, useRef, useState } from 'react'
import { MessageSquareText, Users } from 'lucide-react'
import type { TicketSummary, UserRef } from '@livedesk/shared'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useSavedReplies } from '../api'
import { fillTemplate } from '../saved-reply-template'

interface SavedReplyPickerProps {
  ticket: TicketSummary
  me: UserRef
  onInsert: (text: string) => void
}

/** "Saved replies" button in the staff composer: search, click to insert (placeholders filled in). */
export function SavedReplyPicker({ ticket, me, onInsert }: SavedReplyPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const replies = useSavedReplies(open)
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

  const needle = q.trim().toLowerCase()
  const visible = (replies.data ?? []).filter(
    (r) =>
      !needle || r.title.toLowerCase().includes(needle) || r.body.toLowerCase().includes(needle),
  )

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        icon={<MessageSquareText className="size-4" aria-hidden />}
      >
        Saved replies
      </Button>
      {open && (
        <div
          id={panelId}
          className="absolute bottom-full left-0 z-30 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white p-2 shadow-pop"
        >
          <Input
            autoFocus
            type="search"
            aria-label="Search saved replies"
            placeholder="Search saved replies"
            className="h-9 text-[13px]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="mt-2 max-h-64 overflow-y-auto">
            {replies.isPending ? (
              <li className="px-2 py-3 text-xs text-ink-500">Loading…</li>
            ) : replies.isError ? (
              <li className="px-2 py-3 text-xs text-red-600">{replies.error.message}</li>
            ) : visible.length === 0 ? (
              <li className="px-2 py-3 text-xs text-ink-500">
                No saved replies{needle ? ' match' : ' yet. Add some in Settings'}.
              </li>
            ) : (
              visible.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onInsert(fillTemplate(r.body, ticket, me))
                      setOpen(false)
                    }}
                    className="w-full rounded-lg px-2 py-2 text-left hover:bg-canvas"
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                      {r.title}
                      {r.scope === 'team' && (
                        <Users className="size-3 text-ink-400" aria-label="Team reply" />
                      )}
                    </span>
                    <span className="line-clamp-2 text-xs text-ink-500">{r.body}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
