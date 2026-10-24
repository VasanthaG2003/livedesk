import { useMutation, useQuery } from '@tanstack/react-query'
import type { TriageRequest, TriageSuggestion } from '@livedesk/shared'
import { gql } from '@/lib/api'
import { M, Q } from '@/lib/operations'

/** Whether the server has AI assist configured (buttons are hidden otherwise). */
export function useAiEnabled() {
  const status = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: async () => (await gql<{ aiStatus: { enabled: boolean } }>(Q.aiStatus)).aiStatus,
    staleTime: Infinity,
  })
  return status.data?.enabled === true
}

export function useTriage() {
  return useMutation({
    mutationFn: async (input: TriageRequest) =>
      (await gql<{ triageTicket: TriageSuggestion }>(M.triageTicket, { input })).triageTicket,
  })
}

export function useAiDraft(ticketId: string) {
  return useMutation({
    mutationFn: async () => ({
      draft: (await gql<{ draftReply: string }>(M.draftReply, { ticketId })).draftReply,
    }),
  })
}
