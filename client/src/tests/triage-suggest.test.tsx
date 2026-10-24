import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateTicketPage } from '@/pages/customer/CreateTicketPage'
import { data, mockGraphQL, renderWithRouter } from './render'

afterEach(() => vi.restoreAllMocks())

const api = (enabled: boolean) =>
  mockGraphQL({
    AiStatus: () => data({ aiStatus: { enabled } }),
    TriageTicket: () =>
      data({
        triageTicket: {
          category: 'billing',
          priority: 'high',
          reason: 'Looks like a duplicate charge.',
        },
      }),
  })

describe('AI category/priority suggestion', () => {
  it('is hidden when AI is not configured', async () => {
    const spy = api(false)
    renderWithRouter(<CreateTicketPage />)
    await vi.waitFor(() => expect(spy).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Suggest with AI' })).not.toBeInTheDocument()
  })

  it('suggests, and only changes the form when the customer clicks Apply', async () => {
    api(true)
    renderWithRouter(<CreateTicketPage />)
    const suggest = await screen.findByRole('button', { name: 'Suggest with AI' })
    expect(suggest).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Subject'), 'Charged twice')
    await userEvent.type(screen.getByLabelText('Description'), 'Two identical charges on my card.')
    await userEvent.click(suggest)

    expect(await screen.findByText(/Looks like a duplicate charge/)).toBeInTheDocument()
    expect(screen.getByLabelText('Category')).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByLabelText('Category')).toHaveValue('billing')
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked()
  })
})
