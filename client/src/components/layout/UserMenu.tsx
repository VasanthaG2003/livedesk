import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { ROLE_LABELS } from '@livedesk/shared'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import type { ShellTone, ShellUser } from './types'

interface UserMenuProps {
  user: ShellUser
  settingsPath: string
  onLogout: () => void
  /** "header" = compact pill in the top bar; "sidebar" = card at the bottom of the sidebar. */
  placement: 'header' | 'sidebar'
  tone?: ShellTone
}

export function UserMenu({
  user,
  settingsPath,
  onLogout,
  placement,
  tone = 'light',
}: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const dark = tone === 'dark'
  const isSidebar = placement === 'sidebar'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg text-left transition-colors',
          isSidebar ? 'p-2' : 'py-1 pr-1 pl-1',
          dark ? 'hover:bg-white/5' : 'hover:bg-ink-900/[0.04]',
        )}
      >
        <Avatar name={user.name} size={isSidebar ? 'md' : 'sm'} decorative />
        <span className={cn('min-w-0 flex-1', !isSidebar && 'hidden sm:block')}>
          <span
            className={cn(
              'block truncate text-[13px] font-medium',
              dark ? 'text-white' : 'text-ink-900',
            )}
          >
            {user.name}
          </span>
          {isSidebar && (
            <span className={cn('block text-xs', dark ? 'text-navy-text' : 'text-ink-500')}>
              {ROLE_LABELS[user.role]}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0', dark ? 'text-navy-text' : 'text-ink-400')}
          aria-hidden
        />
        <span className="sr-only">Open account menu</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-30 w-52 rounded-lg border border-line bg-white p-1 shadow-pop',
            isSidebar ? 'bottom-full left-0 mb-2' : 'top-full right-0 mt-2',
          )}
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium text-ink-900">{user.name}</p>
            <p className="text-xs text-ink-500">{ROLE_LABELS[user.role]}</p>
          </div>
          <Link
            role="menuitem"
            to={settingsPath}
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-canvas"
          >
            <Settings className="size-4" aria-hidden /> Settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  )
}
