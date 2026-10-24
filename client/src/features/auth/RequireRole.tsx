import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '@livedesk/shared'
import { ErrorState } from '@/components/ui/States'
import { LogoMark } from '@/components/ui/Logo'
import { homeFor, useMe } from './api'

export function FullPageLoader() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center">
      <LogoMark className="size-10 animate-pulse" />
    </div>
  )
}

/**
 * Route guard. This only decides what the UI shows — every API endpoint checks
 * the role and ownership again on the server.
 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) return <FullPageLoader />
  if (me.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState onRetry={() => void me.refetch()} retrying={me.isFetching} />
      </div>
    )
  }
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (me.data.role !== role) return <Navigate to={homeFor(me.data.role)} replace />
  return children
}

/** "/" — send signed-in users to their dashboard, everyone else to login. */
export function HomeRedirect() {
  const me = useMe()
  if (me.isPending) return <FullPageLoader />
  return <Navigate to={me.data ? homeFor(me.data.role) : '/login'} replace />
}
