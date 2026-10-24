import { useEffect, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import type { NavItem, ShellTone, ShellUser } from './types'

interface AppShellProps {
  tone: ShellTone
  nav: NavItem[]
  user: ShellUser
  settingsPath: string
  searchPlaceholder: string
  onSearch: (query: string) => void
  onLogout: () => void
  headerActions?: ReactNode
}

export function AppShell({
  headerActions,
  searchPlaceholder,
  onSearch,
  ...sidebarProps
}: AppShellProps) {
  const { pathname } = useLocation()
  // The drawer remembers the path it was opened on, so navigating anywhere
  // closes it without an extra effect.
  const [navOpenedAt, setNavOpenedAt] = useState<string | null>(null)
  const navOpen = navOpenedAt === pathname
  const setNavOpen = (open: boolean) => setNavOpenedAt(open ? pathname : null)

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpenedAt(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden lg:block">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div className="absolute inset-0 bg-navy-950/40" onClick={() => setNavOpen(false)} />
          <div className="relative h-full w-64 shadow-pop">
            <Sidebar {...sidebarProps} onClose={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <Header
          user={sidebarProps.user}
          settingsPath={sidebarProps.settingsPath}
          onLogout={sidebarProps.onLogout}
          searchPlaceholder={searchPlaceholder}
          onSearch={onSearch}
          onOpenNav={() => setNavOpen(true)}
          actions={headerActions}
        />
        <main id="main" className="px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
