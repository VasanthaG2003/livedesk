import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <defs>
        <linearGradient id="ld-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F6BFF" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#ld-logo)" />
      <path
        d="M9 10.5A2.5 2.5 0 0 1 11.5 8h9A2.5 2.5 0 0 1 23 10.5v7a2.5 2.5 0 0 1-2.5 2.5H15l-4.2 3.4c-.5.4-1.3 0-1.3-.6V20A2.5 2.5 0 0 1 9 17.5z"
        fill="#fff"
      />
      <circle cx="13" cy="14" r="1.3" fill="#5A5CFF" />
      <circle cx="16" cy="14" r="1.3" fill="#5A5CFF" />
      <circle cx="19" cy="14" r="1.3" fill="#5A5CFF" />
    </svg>
  )
}

export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span
        className={cn(
          'text-[17px] font-semibold',
          tone === 'light' ? 'text-white' : 'text-ink-900',
        )}
      >
        LiveDesk
      </span>
    </span>
  )
}
