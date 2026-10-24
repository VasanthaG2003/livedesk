import { Link } from 'react-router'
import { buttonClasses } from '@/components/ui/button-classes'
import { LogoMark } from '@/components/ui/Logo'

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <LogoMark className="size-10" />
      <p className="mt-6 text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink-900">Page not found</h1>
      <p className="mt-2 text-sm text-ink-500">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/" className={buttonClasses('primary', 'md', 'mt-6')}>
        Go home
      </Link>
    </main>
  )
}
