import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@livedesk/shared'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { FormError } from '@/components/ui/FormError'
import { homeFor, useLogin, useMe } from '@/features/auth/api'
import { DemoAccounts } from '@/features/auth/DemoAccounts'
import { afterSignIn } from '@/features/auth/redirect'
import { applyServerErrors } from '@/lib/form-errors'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const me = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (me.data) return <Navigate to={homeFor(me.data.role)} replace />

  const onSubmit = handleSubmit((values) => {
    setFormError('')
    login.mutate(values, {
      onSuccess: (user) => navigate(afterSignIn(user.role, params.get('next')), { replace: true }),
      onError: (err) => setFormError(applyServerErrors(err, setError, ['email', 'password'])),
    })
  })

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your LiveDesk account.">
      <form noValidate className="space-y-4" onSubmit={onSubmit}>
        <FormError message={formError} />
        <Field label="Email" error={errors.email?.message}>
          {(a11y) => <Input {...a11y} type="email" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        New here?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
      <DemoAccounts
        onPick={(email, password) => {
          setValue('email', email, { shouldValidate: true })
          setValue('password', password, { shouldValidate: true })
        }}
      />
    </AuthLayout>
  )
}
