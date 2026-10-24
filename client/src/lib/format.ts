import { format, formatDistanceToNowStrict } from 'date-fns'

/** "2 hours ago" */
export function timeAgo(iso: string) {
  return `${formatDistanceToNowStrict(new Date(iso))} ago`
}

/** "2h ago" — compact form used on Kanban cards and dense tables. */
export function timeAgoShort(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** "Oct 23, 2026, 3:45 PM" */
export function dateTime(iso: string) {
  return format(new Date(iso), 'MMM d, yyyy, h:mm a')
}

/** "1h 24m" */
export function duration(ms: number) {
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
