import { vi } from 'vitest'
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'

/**
 * Renders `ui` at `path` inside a fresh router + query client. Extra routes let
 * tests assert where the user was sent.
 */
export function renderWithRouter(
  ui: ReactElement,
  path = '/',
  extraRoutes: { path: string; element: ReactElement }[] = [],
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([...extraRoutes, { path: '*', element: ui }], {
    initialEntries: [path],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, queryClient }
}

/** A fetch Response with a JSON body. */
export const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * Fakes the GraphQL endpoint: answers each operation by its name with a fresh
 * Response (a body can only be read once). Unhandled operations fail the test.
 */
export function mockGraphQL(
  handlers: Record<string, (variables: Record<string, unknown>) => Response | Promise<Response>>,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      query: string
      variables?: Record<string, unknown>
    }
    const name = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? ''
    const handler = handlers[name]
    if (!handler) throw new Error(`unexpected operation ${name}`)
    return handler(body.variables ?? {})
  })
}

/** Names of the GraphQL operations sent so far, with their variables. */
export function sentOperations(spy: ReturnType<typeof mockGraphQL>) {
  return spy.mock.calls.map(([, init]) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      query: string
      variables?: Record<string, unknown>
    }
    return { name: /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1], variables: body.variables }
  })
}

export const data = (payload: unknown) => jsonResponse(200, { data: payload })
export const gqlError = (code: string, message: string, extra: Record<string, unknown> = {}) =>
  jsonResponse(200, { data: null, errors: [{ message, extensions: { code, ...extra } }] })
