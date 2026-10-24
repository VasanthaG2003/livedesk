import { Sparkles } from 'lucide-react'
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  type TicketCategory,
  type TicketPriority,
} from '@livedesk/shared'
import { Button } from '@/components/ui/Button'
import { useAiEnabled, useTriage } from './api'

interface TriageSuggestProps {
  subject: string
  description: string
  onApply: (category: TicketCategory, priority: TicketPriority) => void
}

/** "Suggest category & priority" on the create-ticket form. The customer decides whether to apply it. */
export function TriageSuggest({ subject, description, onApply }: TriageSuggestProps) {
  const enabled = useAiEnabled()
  const triage = useTriage()
  if (!enabled) return null

  const ready = subject.trim().length >= 3 && description.trim().length >= 10
  const s = triage.data

  return (
    <div className="rounded-lg border border-accent-100 bg-accent-100/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
          <Sparkles className="size-4 text-accent-500" aria-hidden />
          Not sure which category or priority to pick?
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={!ready}
          loading={triage.isPending}
          onClick={() => triage.mutate({ subject, description })}
          title={ready ? undefined : 'Write a subject and a short description first'}
        >
          {s ? 'Suggest again' : 'Suggest with AI'}
        </Button>
      </div>
      <div aria-live="polite">
        {triage.isError && <p className="mt-2 text-xs text-red-600">{triage.error.message}</p>}
        {s && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <p className="text-ink-700">
              Suggested: <strong>{CATEGORY_LABELS[s.category]}</strong> ·{' '}
              <strong>{PRIORITY_LABELS[s.priority]}</strong> priority.{' '}
              <span className="text-ink-500">{s.reason}</span>
            </p>
            <Button size="sm" onClick={() => onApply(s.category, s.priority)}>
              Apply
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
