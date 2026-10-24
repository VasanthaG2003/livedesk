import { cn } from '@/lib/cn'

export type ConnectionState = 'connected' | 'connecting' | 'disconnected'

const styles: Record<ConnectionState, { dot: string; text: string; label: string }> = {
  connected: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Live' },
  connecting: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-700', label: 'Reconnecting' },
  disconnected: { dot: 'bg-red-500', text: 'text-red-600', label: 'Offline' },
}

/** Shows whether real-time updates are flowing. */
export function ConnectionIndicator({ state }: { state: ConnectionState }) {
  const s = styles[state]
  return (
    <span role="status" className={cn('flex items-center gap-1.5 text-xs font-medium', s.text)}>
      <span className={cn('size-2 rounded-full', s.dot)} aria-hidden />
      {s.label}
      <span className="sr-only"> — real-time connection {state}</span>
    </span>
  )
}
