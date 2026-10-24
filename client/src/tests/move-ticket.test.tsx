import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TicketListResponse, TicketSummary } from '@livedesk/shared'
import { ticketKeys, useMoveTicket } from '@/features/tickets/api'
import { data, gqlError, mockGraphQL } from './render'

afterEach(() => vi.restoreAllMocks())

const ticket: TicketSummary = {
  id: 't1',
  ticketNumber: 'TK-1001',
  subject: 'Checkout broken',
  category: 'bug',
  priority: 'high',
  status: 'open',
  customer: { id: 'c1', name: 'Vasantha G', role: 'customer' },
  assignedAgent: null,
  createdAt: '2026-10-23T10:00:00.000Z',
  updatedAt: '2026-10-23T10:00:00.000Z',
  firstResponseDueAt: null,
  firstResponseAt: null,
  lastMessageAt: null,
  lastMessageFrom: null,
  customerReadAt: null,
  staffReadAt: null,
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const list: TicketListResponse = {
    data: [ticket],
    meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    counts: { open: 1, in_progress: 0, resolved: 0, closed: 0 },
  }
  const key = ticketKeys.list({ pageSize: 100 })
  qc.setQueryData(key, list)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useMoveTicket(), { wrapper })
  const status = () => qc.getQueryData<TicketListResponse>(key)?.data[0]?.status
  return { result, status }
}

describe('useMoveTicket (Kanban drag-and-drop)', () => {
  it('moves the card immediately, before the server answers', async () => {
    let answer: (r: Response) => void = () => {}
    mockGraphQL({ UpdateTicket: () => new Promise<Response>((r) => (answer = r)) })
    const { result, status } = setup()

    act(() => result.current.mutate({ ticket, to: 'in_progress' }))
    await waitFor(() => expect(status()).toBe('in_progress'))

    answer(data({ updateTicket: { ...ticket, status: 'in_progress' } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('puts the card back when the server refuses the move', async () => {
    mockGraphQL({
      UpdateTicket: () =>
        gqlError('NOT_ASSIGNED', 'This ticket is assigned to another agent', { status: 403 }),
    })
    const { result, status } = setup()

    act(() => result.current.mutate({ ticket, to: 'resolved' }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(status()).toBe('open')
    expect(result.current.error?.message).toBe('This ticket is assigned to another agent')
  })
})
