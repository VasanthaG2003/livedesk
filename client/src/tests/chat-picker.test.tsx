import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TicketSummary } from '@livedesk/shared'
import { ChatTicketPicker } from '@/features/tickets/components/ChatTicketPicker'
import { renderWithRouter } from './render'

// jsdom doesn't implement <dialog>.showModal yet.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false
}

const customer = { id: 'c1', name: 'Test Customer', role: 'customer' as const }
const ticket = (id: string, status: TicketSummary['status']): TicketSummary => ({
  id,
  ticketNumber: `TK-${id}`,
  subject: `Subject ${id}`,
  category: 'bug',
  priority: 'low',
  status,
  customer,
  assignedAgent: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  firstResponseDueAt: null,
  firstResponseAt: null,
  lastMessageAt: null,
  lastMessageFrom: null,
  customerReadAt: null,
  staffReadAt: null,
})

describe('ChatTicketPicker', () => {
  it('lists only tickets that can be chatted in and links into their chat', () => {
    renderWithRouter(
      <ChatTicketPicker
        open
        onClose={vi.fn()}
        tickets={[ticket('1', 'open'), ticket('2', 'resolved'), ticket('3', 'closed')]}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Chat with us' })
    const links = within(dialog).getAllByRole('link', { name: /Subject/ })
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/app/tickets/1?chat=1',
      '/app/tickets/2?chat=1',
    ])
    expect(within(dialog).queryByText('Subject 3')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Raise a new ticket/ })).toHaveAttribute(
      'href',
      '/app/new-ticket',
    )
  })

  it('tells the customer to raise a ticket first when none are active', () => {
    renderWithRouter(<ChatTicketPicker open onClose={vi.fn()} tickets={[ticket('3', 'closed')]} />)
    expect(screen.getByRole('heading', { name: 'No active tickets' })).toBeInTheDocument()
  })
})
