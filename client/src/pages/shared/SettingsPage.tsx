import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { ROLE_LABELS, changePasswordSchema, type ChangePasswordInput } from '@livedesk/shared'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { FormError } from '@/components/ui/FormError'
import { Avatar } from '@/components/ui/Avatar'
import { PageHeader } from '@/components/layout/PageHeader'
import { useChangePassword, useCurrentUser, useLogout } from '@/features/auth/api'
import { SavedRepliesSettings } from '@/features/tickets/components/SavedRepliesSettings'
import { applyServerErrors } from '@/lib/form-errors'

export function SettingsPage() {
  const user = useCurrentUser()
  const changePassword = useChangePassword()
  const logout = useLogout()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError('')
    changePassword.mutate(values, {
      onSuccess: () => {
        reset()
        toast.success('Password updated. Other devices have been signed out.')
      },
      onError: (err) =>
        setFormError(applyServerErrors(err, setError, ['currentPassword', 'newPassword'])),
    })
  })

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile and password." />
      <div className="grid max-w-5xl gap-6">
        <Card>
          <CardHeader title="Profile" />
          <div className="flex flex-wrap items-center gap-4 p-5">
            <Avatar name={user.name} size="lg" decorative />
            <dl className="grid flex-1 gap-x-8 gap-y-1 text-[13px] sm:grid-cols-3">
              <div>
                <dt className="text-ink-500">Name</dt>
                <dd className="font-medium text-ink-900">{user.name}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Email</dt>
                <dd className="font-medium break-all text-ink-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Role</dt>
                <dd className="font-medium text-ink-900">{ROLE_LABELS[user.role]}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Change password" description="You'll stay signed in on this device." />
          <form noValidate className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={onSubmit}>
            {formError && (
              <div className="sm:col-span-2">
                <FormError message={formError} />
              </div>
            )}
            <Field label="Current password" error={errors.currentPassword?.message}>
              {(a11y) => (
                <Input
                  {...a11y}
                  type="password"
                  autoComplete="current-password"
                  {...register('currentPassword')}
                />
              )}
            </Field>
            <Field
              label="New password"
              error={errors.newPassword?.message}
              hint="At least 8 characters."
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="password"
                  autoComplete="new-password"
                  {...register('newPassword')}
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={changePassword.isPending}>
                Update password
              </Button>
            </div>
          </form>
        </Card>

        {user.role !== 'customer' && <SavedRepliesSettings me={user} />}

        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">Sign out</h2>
            <p className="text-xs text-ink-500">End your session on this device.</p>
          </div>
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            loading={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
            }
            icon={<LogOut className="size-4" aria-hidden />}
          >
            Log out
          </Button>
        </Card>
      </div>
    </>
  )
}
