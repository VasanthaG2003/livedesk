import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'
import { ME_KEY } from '@/features/auth/api'

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => {
      // The session ended (expired, logged out elsewhere, account deactivated):
      // clearing the user sends the route guard back to the login page.
      if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(ME_KEY, null)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Retry network blips and 5xx, never 4xx (they won't fix themselves).
      retry: (count, err) =>
        count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
    },
  },
})
