import { NavLink } from 'react-router'
import { X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/cn'
import type { NavItem, ShellTone, ShellUser } from './types'
import { UserMenu } from './UserMenu'

interface SidebarProps {
  tone: ShellTone
  nav: NavItem[]
  user: ShellUser
  settingsPath: string
  onLogout: () => void
  /** Only passed for the mobile drawer. */
  onClose?: () => void
}

export function Sidebar({ tone, nav, user, settingsPath, onLogout, onClose }: SidebarProps) {
  const dark = tone === 'dark'
  return (
    <div
      className={cn(
        'flex h-full w-64 flex-col',
        dark ? 'bg-navy-900 text-navy-text' : 'border-r border-line bg-white text-ink-700',
      )}
    >
      <div className="flex h-16 items-center justify-between px-5">
        <Logo tone={dark ? 'light' : 'dark'} />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className={cn('rounded-md p-1.5', dark ? 'hover:bg-white/10' : 'hover:bg-canvas')}
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                    dark
                      ? isActive
                        ? 'bg-navy-active text-white'
                        : 'hover:bg-white/5 hover:text-white'
                      : isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'hover:bg-canvas hover:text-ink-900',
                  )
                }
              >
                <Icon className="size-[18px] shrink-0" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn('p-3', dark ? 'border-t border-white/10' : 'border-t border-line')}>
        <UserMenu
          user={user}
          settingsPath={settingsPath}
          onLogout={onLogout}
          placement="sidebar"
          tone={tone}
        />
      </div>
    </div>
  )
}
