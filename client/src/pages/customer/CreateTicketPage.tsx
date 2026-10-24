import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { CircleCheck, Lightbulb } from 'lucide-react'
import {
  CATEGORY_LABELS,
  LIMITS,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  createTicketSchema,
  type CreateTicketInput,
} from '@livedesk/shared'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { FormError } from '@/components/ui/FormError'
import { PageHeader } from '@/components/layout/PageHeader'
import { TriageSuggest } from '@/features/ai/TriageSuggest'
import { useCreateTicket } from '@/features/tickets/api'
import { applyServerErrors } from '@/lib/form-errors'
import { cn } from '@/lib/cn'

const tips = [
  'Use a short subject that sums up the problem.',
  'Include steps to reproduce, what you expected and what happened.',
  'Mention your device, browser or app version for bugs.',
  "Never share passwords or full card numbers — we'll never ask for them.",
]

export function CreateTicketPage() {
  const navigate = useNavigate()
  const createTicket = useCreateTicket()
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    // category starts empty (the "Choose a category" option) until picked or applied.
    defaultValues: { subject: '', description: '', priority: 'medium', category: '' as never },
  })
  const priority = useWatch({ control, name: 'priority' })
  const subject = useWatch({ control, name: 'subject' })
  const description = useWatch({ control, name: 'description' })
  const descriptionLength = description.length

  const onSubmit = handleSubmit((values) => {
    setFormError('')
    createTicket.mutate(values, {
      onSuccess: (ticket) => {
        toast.success(`Ticket ${ticket.ticketNumber} created. Our team will reply here.`)
        // Land straight in the new ticket's chat.
        navigate(`/app/tickets/${ticket.id}?chat=1`, { replace: true })
      },
      onError: (err) =>
        setFormError(
          applyServerErrors(err, setError, ['subject', 'description', 'category', 'priority']),
        ),
    })
  })

  return (
    <>
      <PageHeader
        title="Create Ticket"
        description="Tell us what's going on and we'll get back to you."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-5 sm:p-6">
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <FormError message={formError} />
            <Field label="Subject" error={errors.subject?.message}>
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('subject')}
                  maxLength={LIMITS.subjectMax}
                  placeholder="e.g. App not loading on mobile"
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" error={errors.category?.message}>
                {(a11y) => (
                  <Select {...a11y} {...register('category')}>
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-ink-700">Priority</legend>
                <div className="grid grid-cols-3 gap-2">
                  {TICKET_PRIORITIES.map((p) => (
                    <label
                      key={p}
                      className={cn(
                        'flex h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                        priority === p
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-line-strong text-ink-700 hover:bg-canvas',
                      )}
                    >
                      <input type="radio" value={p} {...register('priority')} className="sr-only" />
                      {PRIORITY_LABELS[p]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <Field
              label="Description"
              error={errors.description?.message}
              hint={`${descriptionLength} / ${LIMITS.descriptionMax}`}
            >
              {(a11y) => (
                <Textarea
                  {...a11y}
                  {...register('description')}
                  rows={7}
                  maxLength={LIMITS.descriptionMax}
                  placeholder="Describe the issue in as much detail as you can."
                />
              )}
            </Field>

            <TriageSuggest
              subject={subject}
              description={description}
              onApply={(category, priority) => {
                setValue('category', category, { shouldValidate: true })
                setValue('priority', priority, { shouldValidate: true })
              }}
            />

            <div className="flex justify-end">
              <Button type="submit" size="lg" loading={createTicket.isPending}>
                {createTicket.isPending ? 'Submitting…' : 'Submit ticket'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
            <Lightbulb className="size-4 text-amber-500" aria-hidden /> Tips for a faster answer
          </h2>
          <ul className="mt-3 space-y-2.5 text-[13px]">
            {tips.map((tip) => (
              <li key={tip} className="flex gap-2 text-ink-500">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
                {tip}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
