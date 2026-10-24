import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { registerSchema, type RegisterInput } from '@livedesk/shared'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { FormError } from '@/components/ui/FormError'
import { homeFor, useMe, useRegister } from '@/features/auth/api'
import { applyServerErrors } from '@/lib/form-errors'
import { AuthLayout } from './AuthLayout'

export function RegisterPage() {
  const me = useMe()
  const signUp = useRegister()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  if (me.data) return <Navigate to={homeFor(me.data.role)} replace />

  const onSubmit = handleSubmit((values) => {
    setFormError('')
    signUp.mutate(values, {
      onSuccess: (user) => {
        toast.success(`Welcome to LiveDesk, ${user.name.split(' ')[0]}!`)
        navigate('/app', { replace: true })
      },
      onError: (err) => {
        // "Email already registered" belongs on the email field.
        if (err instanceof Error && 'code' in err && err.code === 'EMAIL_TAKEN') {
          setError('email', { message: err.message })
          return
        }
        setFormError(applyServerErrors(err, setError, ['name', 'email', 'password']))
      },
    })
  })

  return (
    <AuthLayout title="Create your account" subtitle="Get help from our support team in minutes.">
      <form noValidate className="space-y-4" onSubmit={onSubmit}>
        <FormError message={formError} />
        <Field label="Full name" error={errors.name?.message}>
          {(a11y) => <Input {...a11y} autoComplete="name" {...register('name')} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(a11y) => <Input {...a11y} type="email" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters.">
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={signUp.isPending}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
