import { describe, expect, it } from 'vitest'
import type { TicketSummary } from '@livedesk/shared'
import { fillTemplate } from '@/features/tickets/saved-reply-template'

const ticket = {
  ticketNumber: 'TK-1009',
  customer: { id: 'c', name: 'Vasantha G', role: 'customer' },
} as TicketSummary

describe('fillTemplate', () => {
  it('fills known placeholders and leaves unknown ones untouched', () => {
    expect(
      fillTemplate(
        'Hi {{customer.firstName}}, {{ agent.firstName }} here about {{ticket.number}}. {{unknown}}',
        ticket,
        { id: 'a', name: 'Ankit Sharma', role: 'agent' },
      ),
    ).toBe('Hi Vasantha, Ankit here about TK-1009. {{unknown}}')
  })
})
