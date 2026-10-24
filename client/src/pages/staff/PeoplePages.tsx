import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Search, UserPlus } from 'lucide-react'
import {
  createAgentSchema,
  type CreateAgentInput,
  type Role,
  type UserListItem,
} from '@livedesk/shared'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { FormError } from '@/components/ui/FormError'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { useCreateAgent, useSetUserActive, useUsers } from '@/features/admin/api'
import { PeopleTable } from '@/features/admin/components/PeopleTable'
import { useCurrentUser } from '@/features/auth/api'
import { useRealtime } from '@/features/realtime/RealtimeContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { applyServerErrors } from '@/lib/form-errors'

interface PeopleListProps {
  role: Role
  scope: 'admin' | 'staff'
  ticketsLabel: string
  canManage: boolean
  showPresence?: boolean
}

function PeopleList({
  role,
  scope,
  ticketsLabel,
  canManage,
  showPresence = false,
}: PeopleListProps) {
  const me = useCurrentUser()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQ = useDebouncedValue(q)
  const users = useUsers({ role, scope, q: debouncedQ || undefined, page })
  const setActive = useSetUserActive()
  const { onlineAgentIds } = useRealtime()
  const [target, setTarget] = useState<UserListItem | null>(null)

  return (
    <>
      <div className="relative mb-4 w-full sm:max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search by name or email"
          placeholder="Search by name or email"
          className="pl-9"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
      </div>
      <Card>
        {users.isPending ? (
          <SkeletonRows rows={5} />
        ) : users.isError ? (
          <ErrorState
            message={users.error.message}
            onRetry={() => void users.refetch()}
            retrying={users.isFetching}
          />
        ) : users.data.data.length === 0 ? (
          <EmptyState title={debouncedQ ? 'Nobody matches that search' : 'No one here yet'} />
        ) : (
          <>
            <PeopleTable
              rows={users.data.data}
              ticketsLabel={ticketsLabel}
              onlineIds={showPresence ? new Set(onlineAgentIds) : undefined}
              renderActions={
                canManage
                  ? (row) =>
                      row.id === me.id ? null : (
                        <Button variant="ghost" size="sm" onClick={() => setTarget(row)}>
                          {row.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      )
                  : undefined
              }
            />
            <Pagination meta={users.data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>
      <ConfirmDialog
        open={target !== null}
        title={target?.isActive ? `Deactivate ${target.name}?` : `Reactivate ${target?.name}?`}
        description={
          target?.isActive
            ? 'They will be signed out on every device immediately and will not be able to sign in. Their tickets are kept.'
            : 'They will be able to sign in again.'
        }
        confirmLabel={target?.isActive ? 'Deactivate' : 'Reactivate'}
        destructive={target?.isActive}
        loading={setActive.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() =>
          target &&
          setActive.mutate(
            { id: target.id, isActive: !target.isActive },
            {
              onSuccess: (u) => {
                toast.success(`${u.name} ${u.isActive ? 'reactivated' : 'deactivated'}`)
                setTarget(null)
              },
              onError: (err) => toast.error(err.message),
            },
          )
        }
      />
    </>
  )
}

/** Customers who use support. Agents get a read-only view; admins can deactivate accounts. */
export function CustomersPage({ canManage }: { canManage: boolean }) {
  return (
    <>
      <PageHeader title="Customers" description="People who have contacted support." />
      <PeopleList
        role="customer"
        scope={canManage ? 'admin' : 'staff'}
        ticketsLabel="Tickets"
        canManage={canManage}
      />
    </>
  )
}

export function AgentsPage() {
  const [adding, setAdding] = useState(false)
  return (
    <>
      <PageHeader
        title="Agents"
        description="Your support team, their current workload and who's online."
        actions={
          <Button
            onClick={() => setAdding(true)}
            icon={<UserPlus className="size-4" aria-hidden />}
          >
            Add agent
          </Button>
        }
      />
      <PeopleList role="agent" scope="admin" ticketsLabel="Assigned" canManage showPresence />
      <AddAgentDialog open={adding} onClose={() => setAdding(false)} />
    </>
  )
}

function AddAgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAgent()
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateAgentInput>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const close = () => {
    reset()
    setFormError('')
    onClose()
  }

  const onSubmit = handleSubmit((values) => {
    setFormError('')
    create.mutate(values, {
      onSuccess: (agent) => {
        toast.success(
          `${agent.name} can now sign in as an agent. Share the password with them securely.`,
        )
        close()
      },
      onError: (err) =>
        setFormError(applyServerErrors(err, setError, ['name', 'email', 'password'])),
    })
  })

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add an agent"
      description="They can change this password after signing in."
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={formError} />
        <Field label="Full name" error={errors.name?.message}>
          {(a11y) => <Input {...a11y} autoComplete="off" {...register('name')} />}
        </Field>
        <Field label="Work email" error={errors.email?.message}>
          {(a11y) => <Input {...a11y} type="email" autoComplete="off" {...register('email')} />}
        </Field>
        <Field
          label="Initial password"
          error={errors.password?.message}
          hint="At least 8 characters."
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create agent
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
