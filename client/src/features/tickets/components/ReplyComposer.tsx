import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Send } from 'lucide-react'
import { LIMITS, replySchema, type ReplyInput } from '@livedesk/shared'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { cn } from '@/lib/cn'

interface ReplyComposerProps {
  /** Resolves true when the message was sent; the box is only cleared then. */
  onSubmit: (input: ReplyInput) => Promise<boolean>
  /** Focus the box on mount, e.g. when arriving from "Chat with us". */
  autoFocus?: boolean
  /** Staff get a Reply / Internal note switch. */
  allowInternal?: boolean
  /** Called with true while typing a public reply, false when stopped. */
  onTyping?: (typing: boolean) => void
  /** Extra tools next to Send (e.g. saved replies, AI draft). Receives a text inserter. */
  tools?: (insert: (text: string) => void) => ReactNode
}

const STOP_TYPING_AFTER_MS = 3000

export function ReplyComposer({
  onSubmit,
  autoFocus = false,
  allowInternal = false,
  onTyping,
  tools,
}: ReplyComposerProps) {
  const [internal, setInternal] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isTyping = useRef(false)
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ReplyInput>({ resolver: zodResolver(replySchema), defaultValues: { body: '' } })

  const length = useWatch({ control, name: 'body' }).length

  function stopTyping() {
    clearTimeout(typingTimer.current)
    if (isTyping.current) {
      isTyping.current = false
      onTyping?.(false)
    }
  }

  function noteTyping() {
    // Internal notes are private; never tell the customer someone is typing one.
    if (!onTyping || internal) return
    if (!isTyping.current) {
      isTyping.current = true
      onTyping(true)
    }
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(stopTyping, STOP_TYPING_AFTER_MS)
  }

  // handleSubmit is created inside the event so nothing here runs during render.
  const submit = (e?: FormEvent) =>
    handleSubmit(async (values) => {
      stopTyping()
      if (await onSubmit({ body: values.body, ...(internal && { internal: true }) })) reset()
    })(e)

  const field = register('body')
  const insert = (text: string) => {
    const current = getValues('body')
    setValue('body', current ? `${current}\n${text}` : text, { shouldValidate: true })
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {allowInternal && (
        <div
          role="radiogroup"
          aria-label="Message type"
          className="inline-flex rounded-lg bg-canvas p-1 text-xs font-medium"
        >
          {[
            { value: false, label: 'Reply to customer' },
            { value: true, label: 'Internal note' },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={internal === opt.value}
              onClick={() => {
                stopTyping()
                setInternal(opt.value)
              }}
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1.5 transition-colors',
                internal === opt.value
                  ? opt.value
                    ? 'bg-amber-100 text-amber-900 shadow-sm'
                    : 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-500 hover:text-ink-900',
              )}
            >
              {opt.value && <Lock className="size-3" aria-hidden />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <Field
        label={internal ? 'Internal note (only staff can see this)' : 'Message'}
        error={errors.body?.message}
        hint={`Ctrl/⌘ + Enter to send · ${length} / ${LIMITS.messageMax}`}
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            {...field}
            onChange={(e) => {
              void field.onChange(e)
              noteTyping()
            }}
            onBlur={(e) => {
              void field.onBlur(e)
              stopTyping()
            }}
            rows={3}
            autoFocus={autoFocus}
            placeholder={internal ? 'Add a note for your team…' : 'Type a message…'}
            className={cn(
              internal &&
                'border-amber-300 bg-amber-50/60 focus:border-amber-500 focus:ring-amber-500/15',
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSubmitting) {
                e.preventDefault()
                void submit()
              }
            }}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">{tools?.(insert)}</div>
        <Button
          type="submit"
          loading={isSubmitting}
          className={cn(internal && 'bg-amber-600 hover:bg-amber-700')}
          icon={
            internal ? (
              <Lock className="size-4" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )
          }
        >
          {internal ? 'Add note' : 'Send'}
        </Button>
      </div>
    </form>
  )
}
