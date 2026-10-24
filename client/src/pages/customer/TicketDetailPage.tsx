import { useParams } from 'react-router'
import { TicketPage } from '@/features/tickets/components/TicketPage'

export function CustomerTicketDetailPage() {
  const { ticketId = '' } = useParams()
  return (
    <TicketPage key={ticketId} ticketId={ticketId} backHref="/app/tickets" backLabel="My Tickets" />
  )
}
