import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ActivityFeedItem,
  AdminStats,
  ApiPage,
  AuditEntry,
  CreateAgentInput,
  MyStats,
  PeriodValue,
  PublicUser,
  Role,
  UserListItem,
} from '@livedesk/shared'
import { gql } from '@/lib/api'
import { M, Q } from '@/lib/operations'

export type RangeDays = 7 | 30 | 90

/** The browser's time zone, so "per day" charts match the viewer's calendar. */
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

export const adminKeys = {
  stats: (days: RangeDays) => ['admin', 'stats', days] as const,
  myStats: (days: RangeDays) => ['stats', 'me', days] as const,
  users: ['admin', 'users'] as const,
  audit: ['admin', 'audit'] as const,
  activity: ['admin', 'activity'] as const,
}

export function useAdminStats(days: RangeDays) {
  return useQuery({
    queryKey: adminKeys.stats(days),
    queryFn: async ({ signal }) =>
      (await gql<{ adminStats: AdminStats }>(Q.adminStats, { days, tz }, { signal })).adminStats,
    placeholderData: keepPreviousData,
  })
}

export function useMyStats(days: RangeDays) {
  return useQuery({
    queryKey: adminKeys.myStats(days),
    queryFn: async ({ signal }) =>
      (await gql<{ myStats: MyStats }>(Q.myStats, { days, tz }, { signal })).myStats,
    placeholderData: keepPreviousData,
  })
}

interface UserListParams {
  role: Role
  q?: string
  page?: number
  /** Agents may only use the read-only customers query. */
  scope: 'admin' | 'staff'
}

export function useUsers({ role, q, page = 1, scope }: UserListParams) {
  return useQuery({
    queryKey: [...adminKeys.users, scope, role, q, page],
    queryFn: async ({ signal }) =>
      scope === 'admin'
        ? (await gql<{ users: ApiPage<UserListItem> }>(Q.users, { role, q, page }, { signal }))
            .users
        : (await gql<{ customers: ApiPage<UserListItem> }>(Q.customers, { q, page }, { signal }))
            .customers,
    placeholderData: keepPreviousData,
  })
}

export function useSetUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await gql<{ setUserActive: PublicUser }>(M.setUserActive, { id, isActive })).setUserActive,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users })
      void qc.invalidateQueries({ queryKey: adminKeys.audit })
    },
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateAgentInput) =>
      (await gql<{ createAgent: PublicUser }>(M.createAgent, { input })).createAgent,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.users })
      void qc.invalidateQueries({ queryKey: adminKeys.audit })
      void qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useAudit() {
  return useQuery({
    queryKey: adminKeys.audit,
    queryFn: async ({ signal }) =>
      (await gql<{ auditLog: AuditEntry[] }>(Q.auditLog, undefined, { signal })).auditLog,
  })
}

export function useActivityFeed() {
  return useQuery({
    queryKey: adminKeys.activity,
    queryFn: async ({ signal }) =>
      (await gql<{ activityFeed: ActivityFeedItem[] }>(Q.activityFeed, undefined, { signal }))
        .activityFeed,
  })
}

/** % change from the previous period, or null when there's nothing to compare with. */
export function changePct({ current, previous }: PeriodValue): number | null {
  if (current === null || previous === null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
