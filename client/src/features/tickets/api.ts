import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateTicketInput,
  ListTicketsQuery,
  RateTicketInput,
  ReplyInput,
  SavedReply,
  SavedReplyInput,
  TicketActivity,
  TicketDetail,
  TicketListResponse,
  TicketMessage,
  TicketStatus,
  TicketSummary,
  UpdateTicketInput,
  UserRef,
} from '@livedesk/shared'
import { gql } from '@/lib/api'
import { M, Q } from '@/lib/operations'

export type TicketListParams = Partial<ListTicketsQuery>

export const ticketKeys = {
  lists: ['tickets'] as const,
  list: (params: TicketListParams) => ['tickets', params] as const,
  detail: (id: string) => ['ticket', id] as const,
  messages: (id: string) => ['ticket', id, 'messages'] as const,
  activity: (id: string) => ['ticket', id, 'activity'] as const,
  agents: ['agents'] as const,
}

/** List params → GraphQL variables (filters go in `filter`, empty values dropped). */
function listVariables({ page, pageSize, ...filter }: TicketListParams) {
  const cleaned = Object.fromEntries(
    Object.entries(filter).filter(([, v]) => v !== undefined && v !== ''),
  )
  return { filter: cleaned, page, pageSize }
}

export function useTickets(params: TicketListParams) {
  return useQuery({
    queryKey: ticketKeys.list(params),
    queryFn: async ({ signal }) =>
      (await gql<{ tickets: TicketListResponse }>(Q.tickets, listVariables(params), { signal }))
        .tickets,
    // Keep showing the previous page while the next one loads (no flicker).
    placeholderData: keepPreviousData,
  })
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: async ({ signal }) =>
      (await gql<{ ticket: TicketDetail }>(Q.ticket, { id }, { signal })).ticket,
  })
}

export function useMessages(id: string) {
  return useQuery({
    queryKey: ticketKeys.messages(id),
    queryFn: async ({ signal }) =>
      (await gql<{ messages: TicketMessage[] }>(Q.messages, { ticketId: id }, { signal })).messages,
  })
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ticketKeys.activity(id),
    queryFn: async ({ signal }) =>
      (await gql<{ activity: TicketActivity[] }>(Q.activity, { ticketId: id }, { signal }))
        .activity,
  })
}

/** Marks the chat read for my side (drives unread dots and "Seen" receipts). */
export function useMarkRead(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await gql<{ markRead: TicketSummary }>(M.markRead, { ticketId: id })).markRead,
    onSuccess: (summary) => {
      qc.setQueryData<TicketDetail>(ticketKeys.detail(id), (old) =>
        old ? { ...old, ...summary } : old,
      )
      void qc.invalidateQueries({ queryKey: ticketKeys.lists })
    },
  })
}

export function useAgents(enabled = true) {
  return useQuery({
    queryKey: ticketKeys.agents,
    queryFn: async () => (await gql<{ agents: UserRef[] }>(Q.agents)).agents,
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTicketInput) =>
      (await gql<{ createTicket: TicketDetail }>(M.createTicket, { input })).createTicket,
    onSuccess: (ticket) => {
      qc.setQueryData(ticketKeys.detail(ticket.id), ticket)
      void qc.invalidateQueries({ queryKey: ticketKeys.lists })
    },
  })
}

export function useSendMessage(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReplyInput) =>
      (
        await gql<{ sendMessage: { message: TicketMessage; ticket: TicketDetail } }>(
          M.sendMessage,
          {
            ticketId: id,
            input,
          },
        )
      ).sendMessage,
    onSuccess: ({ message, ticket }) => {
      // Show the saved message right away (deduped: the subscription may deliver it too).
      qc.setQueryData<TicketMessage[]>(ticketKeys.messages(id), (old = []) =>
        old.some((m) => m.id === message.id) ? old : [...old, message],
      )
      qc.setQueryData(ticketKeys.detail(id), ticket)
      void qc.invalidateQueries({ queryKey: ticketKeys.activity(id) })
      void qc.invalidateQueries({ queryKey: ticketKeys.lists })
    },
  })
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateTicketInput) =>
      (await gql<{ updateTicket: TicketDetail }>(M.updateTicket, { id, input })).updateTicket,
    onSuccess: (ticket) => {
      qc.setQueryData(ticketKeys.detail(id), ticket)
      void qc.invalidateQueries({ queryKey: ticketKeys.activity(id) })
      void qc.invalidateQueries({ queryKey: ticketKeys.lists })
    },
    // Whatever went wrong (e.g. someone else changed it first), reload the truth.
    onError: () => void qc.invalidateQueries({ queryKey: ticketKeys.detail(id) }),
  })
}

/**
 * Moves a ticket to another status (Kanban drag-and-drop). The board updates
 * immediately; if the server refuses, the previous lists are put back.
 */
export function useMoveTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticket, to }: { ticket: TicketSummary; to: TicketStatus }) =>
      (
        await gql<{ updateTicket: TicketDetail }>(M.updateTicket, {
          id: ticket.id,
          input: { status: to, expectedUpdatedAt: ticket.updatedAt },
        })
      ).updateTicket,
    onMutate: async ({ ticket, to }) => {
      // Stop in-flight refetches from overwriting the optimistic state.
      await qc.cancelQueries({ queryKey: ticketKeys.lists })
      const snapshot = qc.getQueriesData<TicketListResponse>({ queryKey: ticketKeys.lists })
      qc.setQueriesData<TicketListResponse>({ queryKey: ticketKeys.lists }, (old) =>
        old
          ? { ...old, data: old.data.map((t) => (t.id === ticket.id ? { ...t, status: to } : t)) }
          : old,
      )
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) qc.setQueryData(key, data)
    },
    onSettled: (_data, _err, { ticket }) => {
      void qc.invalidateQueries({ queryKey: ticketKeys.lists })
      void qc.invalidateQueries({ queryKey: ticketKeys.detail(ticket.id) })
    },
  })
}

export function useRateTicket(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RateTicketInput) =>
      (await gql<{ rateTicket: TicketDetail }>(M.rateTicket, { ticketId: id, input })).rateTicket,
    onSuccess: (ticket) => {
      qc.setQueryData(ticketKeys.detail(id), ticket)
      void qc.invalidateQueries({ queryKey: ticketKeys.activity(id) })
    },
  })
}

const savedRepliesKey = ['saved-replies'] as const

export function useSavedReplies(enabled = true) {
  return useQuery({
    queryKey: savedRepliesKey,
    queryFn: async () => (await gql<{ savedReplies: SavedReply[] }>(Q.savedReplies)).savedReplies,
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCreateSavedReply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SavedReplyInput) =>
      (await gql<{ createSavedReply: SavedReply }>(M.createSavedReply, { input })).createSavedReply,
    onSuccess: () => void qc.invalidateQueries({ queryKey: savedRepliesKey }),
  })
}

export function useDeleteSavedReply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => gql(M.deleteSavedReply, { id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: savedRepliesKey }),
  })
}
