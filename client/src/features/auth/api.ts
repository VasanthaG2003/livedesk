import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ChangePasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  Role,
} from '@livedesk/shared'
import { gql } from '@/lib/api'
import { M, Q } from '@/lib/operations'

export const ME_KEY = ['me'] as const

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => (await gql<{ me: PublicUser | null }>(Q.me)).me,
    staleTime: 5 * 60_000,
  })
}

export const homeFor = (role: Role) =>
  role === 'customer' ? '/app' : role === 'agent' ? '/agent' : '/admin'

function useSignIn(kind: 'login' | 'register') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput | RegisterInput) => {
      const data = await gql<Record<typeof kind, PublicUser>>(
        M[kind],
        { input },
        { noRefresh: true },
      )
      return data[kind]
    },
    onSuccess: (user) => {
      // Start from a clean cache so no previous user's data is ever shown.
      qc.clear()
      qc.setQueryData(ME_KEY, user)
    },
  })
}

export const useLogin = () => useSignIn('login')
export const useRegister = () => useSignIn('register')

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => gql(M.logout, undefined, { noRefresh: true }),
    onSettled: () => {
      qc.clear()
      qc.setQueryData(ME_KEY, null)
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => gql(M.changePassword, { input }),
  })
}

/** The signed-in user. Only use inside routes wrapped in <RequireRole>. */
export function useCurrentUser(): PublicUser {
  const { data } = useMe()
  if (!data) throw new Error('useCurrentUser must be used inside <RequireRole>')
  return data
}
