import type { TicketSummary, UserRef } from '@livedesk/shared'

const first = (name: string) => name.split(' ')[0] ?? name

/** Fills {{customer.firstName}}, {{agent.firstName}} and {{ticket.number}}; unknown tags are left as-is. */
export function fillTemplate(body: string, ticket: TicketSummary, agent: UserRef) {
  const values: Record<string, string> = {
    'customer.firstName': first(ticket.customer.name),
    'agent.firstName': first(agent.name),
    'ticket.number': ticket.ticketNumber,
  }
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => values[key] ?? match)
}
