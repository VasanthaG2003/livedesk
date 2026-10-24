import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Trash2, Users } from 'lucide-react'
import { savedReplySchema, type PublicUser, type SavedReplyInput } from '@livedesk/shared'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { FormError } from '@/components/ui/FormError'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { applyServerErrors } from '@/lib/form-errors'
import { useCreateSavedReply, useDeleteSavedReply, useSavedReplies } from '../api'

export function SavedRepliesSettings({ me }: { me: PublicUser }) {
  const replies = useSavedReplies()
  const create = useCreateSavedReply()
  const remove = useDeleteSavedReply()
  const [formError, setFormError] = useState('')
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SavedReplyInput>({
    resolver: zodResolver(savedReplySchema),
    defaultValues: { title: '', body: '' },
  })
  const isAdmin = me.role === 'admin'

  const onSubmit = handleSubmit((values) => {
    setFormError('')
    create.mutate(values, {
      onSuccess: () => {
        reset()
        toast.success('Saved reply added')
      },
      onError: (err) => setFormError(applyServerErrors(err, setError, ['title', 'body'])),
    })
  })

  return (
    <Card>
      <CardHeader
        title="Saved replies"
        description={
          isAdmin
            ? 'Replies you add here are shared with the whole team.'
            : 'Your personal replies, plus team replies shared by admins.'
        }
      />
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <FormError message={formError} />
          <Field label="Title" error={errors.title?.message}>
            {(a11y) => (
              <Input {...a11y} {...register('title')} placeholder="e.g. Refund processed" />
            )}
          </Field>
          <Field
            label="Reply text"
            error={errors.body?.message}
            hint="Placeholders: {{customer.firstName}}, {{agent.firstName}}, {{ticket.number}}"
          >
            {(a11y) => <Textarea {...a11y} {...register('body')} rows={4} />}
          </Field>
          <Button type="submit" loading={create.isPending}>
            Add {isAdmin ? 'team' : 'personal'} reply
          </Button>
        </form>

        <div>
          {replies.isPending ? (
            <SkeletonRows rows={3} />
          ) : replies.isError ? (
            <ErrorState message={replies.error.message} onRetry={() => void replies.refetch()} />
          ) : replies.data.length === 0 ? (
            <EmptyState
              title="No saved replies yet"
              description="Add one to insert it into chats in a click."
            />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {replies.data.map((r) => {
                const canDelete = isAdmin || r.owner.id === me.id
                return (
                  <li key={r.id} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                        {r.title}
                        {r.scope === 'team' && (
                          <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 text-[11px] text-brand-700">
                            <Users className="size-3" aria-hidden /> Team
                          </span>
                        )}
                      </p>
                      <p className="line-clamp-2 text-xs text-ink-500">{r.body}</p>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleting({ id: r.id, title: r.title })}
                        className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete saved reply ${r.title}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.title}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null)
              toast.success('Saved reply deleted')
            },
            onError: (err) => toast.error(err.message),
          })
        }
      />
    </Card>
  )
}
