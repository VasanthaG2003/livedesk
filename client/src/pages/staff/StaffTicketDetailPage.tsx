import { useParams } from 'react-router'
import { TicketPage } from '@/features/tickets/components/TicketPage'

export function StaffTicketDetailPage({ base }: { base: '/agent' | '/admin' }) {
  const { ticketId = '' } = useParams()
  return (
    <TicketPage
      key={ticketId}
      ticketId={ticketId}
      backHref={`${base}/tickets`}
      backLabel="All tickets"
    />
  )
}
