import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateTicketPage } from '@/pages/customer/CreateTicketPage'
import { data, gqlError, mockGraphQL, renderWithRouter, sentOperations } from './render'

afterEach(() => vi.restoreAllMocks())

const aiOff = { AiStatus: () => data({ aiStatus: { enabled: false } }) }

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText('Subject'), 'Website not loading')
  await userEvent.selectOptions(screen.getByLabelText('Category'), 'bug')
  await userEvent.type(screen.getByLabelText('Description'), 'The home page shows a blank screen.')
}

describe('CreateTicketPage', () => {
  it('shows field errors from the shared schema and links them to the inputs', async () => {
    const spy = mockGraphQL(aiOff)
    renderWithRouter(<CreateTicketPage />)
    await userEvent.type(screen.getByLabelText('Subject'), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Submit ticket' }))

    const subject = screen.getByLabelText('Subject')
    expect(await screen.findByText('Subject must be at least 5 characters')).toBeInTheDocument()
    expect(subject).toHaveAttribute('aria-invalid', 'true')
    expect(subject).toHaveAccessibleDescription('Subject must be at least 5 characters')
    expect(screen.getByLabelText('Category')).toHaveAccessibleDescription('Choose a category')
    expect(sentOperations(spy).map((o) => o.name)).not.toContain('CreateTicket')
  })

  it('sends the CreateTicket mutation and opens the new ticket chat', async () => {
    const spy = mockGraphQL({
      ...aiOff,
      CreateTicket: () =>
        data({
          createTicket: {
            id: 'abc123',
            ticketNumber: 'TK-1009',
            status: 'open',
            updatedAt: new Date().toISOString(),
          },
        }),
    })
    const { router } = renderWithRouter(<CreateTicketPage />, '/app/new-ticket', [
      { path: '/app/tickets/:id', element: <p>Ticket page</p> },
    ])
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Submit ticket' }))

    expect(await screen.findByText('Ticket page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app/tickets/abc123')
    expect(router.state.location.search).toBe('?chat=1')
    expect(sentOperations(spy).find((o) => o.name === 'CreateTicket')?.variables).toEqual({
      input: {
        subject: 'Website not loading',
        category: 'bug',
        priority: 'medium',
        description: 'The home page shows a blank screen.',
      },
    })
  })

  it('shows a clear message when the server cannot be reached, and keeps what was typed', async () => {
    mockGraphQL({ ...aiOff, CreateTicket: () => Promise.reject(new TypeError('Failed to fetch')) })
    renderWithRouter(<CreateTicketPage />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Submit ticket' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")
    expect(screen.getByLabelText('Subject')).toHaveValue('Website not loading')
    expect(screen.getByRole('button', { name: 'Submit ticket' })).toBeEnabled()
  })

  it('puts server-side field errors on the matching input', async () => {
    mockGraphQL({
      ...aiOff,
      CreateTicket: () =>
        gqlError('BAD_USER_INPUT', 'Some fields are invalid', {
          status: 400,
          fields: { subject: 'Subject is too vague' },
        }),
    })
    renderWithRouter(<CreateTicketPage />)
    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Submit ticket' }))
    expect(await screen.findByText('Subject is too vague')).toBeInTheDocument()
  })
})
