import { useState, type FormEvent, type ReactNode } from 'react'
import { Menu, Search } from 'lucide-react'
import type { ShellUser } from './types'
import { UserMenu } from './UserMenu'

interface HeaderProps {
  user: ShellUser
  settingsPath: string
  searchPlaceholder: string
  onSearch: (query: string) => void
  onLogout: () => void
  onOpenNav: () => void
  /** Extra items on the right: connection indicator, notification bell. */
  actions?: ReactNode
}

export function Header({
  user,
  settingsPath,
  searchPlaceholder,
  onSearch,
  onLogout,
  onOpenNav,
  actions,
}: HeaderProps) {
  const [query, setQuery] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSearch(query.trim())
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        className="-ml-1 rounded-md p-2 text-ink-500 hover:bg-canvas lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <form role="search" onSubmit={submit} className="relative w-full max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <label htmlFor="global-search" className="sr-only">
          {searchPlaceholder}
        </label>
        <input
          id="global-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-lg border border-line bg-canvas/60 pr-3 pl-9 text-[13px] placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand-500/15"
        />
      </form>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        {actions}
        <UserMenu user={user} settingsPath={settingsPath} onLogout={onLogout} placement="header" />
      </div>
    </header>
  )
}
