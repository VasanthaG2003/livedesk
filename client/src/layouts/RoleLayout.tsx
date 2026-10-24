import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { Role } from '@livedesk/shared'
import { AppShell } from '@/components/layout/AppShell'
import { ConnectionIndicator } from '@/components/layout/ConnectionIndicator'
import { NotificationBell } from '@/features/realtime/NotificationBell'
import { useRealtime } from '@/features/realtime/RealtimeContext'
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider'
import type { NavItem } from '@/components/layout/types'
import { useCurrentUser, useLogout } from '@/features/auth/api'
import { RequireRole } from '@/features/auth/RequireRole'
import { adminNav, agentNav, customerNav } from './navigation'

const config: Record<
  Role,
  { base: string; nav: NavItem[]; tone: 'light' | 'dark'; search: string }
> = {
  customer: { base: '/app', nav: customerNav, tone: 'light', search: 'Search tickets...' },
  agent: { base: '/agent', nav: agentNav, tone: 'dark', search: 'Search tickets...' },
  admin: { base: '/admin', nav: adminNav, tone: 'dark', search: 'Search...' },
}

function RoleShell({ role }: { role: Role }) {
  const user = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const { base, nav, tone, search } = config[role]

  return (
    <AppShell
      tone={tone}
      nav={nav}
      user={user}
      settingsPath={`${base}/settings`}
      searchPlaceholder={search}
      onSearch={(q) => navigate(`${base}/tickets?q=${encodeURIComponent(q)}`)}
      onLogout={() =>
        logout.mutate(undefined, {
          onSettled: () => {
            toast.success('Signed out')
            navigate('/login', { replace: true })
          },
        })
      }
      headerActions={<LiveHeaderActions base={base} />}
    />
  )
}

function LiveHeaderActions({ base }: { base: string }) {
  const { connection } = useRealtime()
  return (
    <>
      <ConnectionIndicator state={connection} />
      <NotificationBell ticketPath={(id) => `${base}/tickets/${id}`} />
    </>
  )
}

export function CustomerLayout() {
  return (
    <RequireRole role="customer">
      <RealtimeProvider role="customer">
        <RoleShell role="customer" />
      </RealtimeProvider>
    </RequireRole>
  )
}

export function AgentLayout() {
  return (
    <RequireRole role="agent">
      <RealtimeProvider role="agent">
        <RoleShell role="agent" />
      </RealtimeProvider>
    </RequireRole>
  )
}

export function AdminLayout() {
  return (
    <RequireRole role="admin">
      <RealtimeProvider role="admin">
        <RoleShell role="admin" />
      </RealtimeProvider>
    </RequireRole>
  )
}
