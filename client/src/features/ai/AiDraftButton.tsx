import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useAiDraft, useAiEnabled } from './api'

/** Staff composer tool: drafts a reply with Claude and puts it in the box for review. */
export function AiDraftButton({
  ticketId,
  onInsert,
}: {
  ticketId: string
  onInsert: (text: string) => void
}) {
  const enabled = useAiEnabled()
  const draft = useAiDraft(ticketId)
  if (!enabled) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={draft.isPending}
      icon={<Sparkles className="size-4 text-accent-500" aria-hidden />}
      onClick={() =>
        draft.mutate(undefined, {
          onSuccess: ({ draft: text }) => {
            onInsert(text)
            toast.success('AI draft added. Review and edit it before sending.')
          },
          onError: (err) => toast.error(err.message),
        })
      }
    >
      {draft.isPending ? 'Drafting…' : 'Draft with AI'}
    </Button>
  )
}
