/**
 * Minimal GraphQL client over fetch. TanStack Query does the caching; this
 * only sends operations to /graphql (same origin: Vite proxies it in
 * development, Vercel rewrites it in production, so cookies are first-party).
 */

/** Any failed operation. `status` is the HTTP-style status from the server (0 = unreachable). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const isApiError = (err: unknown, code?: string): err is ApiError =>
  err instanceof ApiError && (code === undefined || err.code === code)

export const GRAPHQL_URL = '/graphql'

interface GraphQLErrorBody {
  message: string
  extensions?: { code?: string; status?: number; fields?: Record<string, string> }
}

const SESSION_CODES = new Set(['UNAUTHENTICATED', 'TOKEN_EXPIRED'])

async function post(
  query: string,
  variables: Record<string, unknown> | undefined,
  signal?: AbortSignal,
) {
  try {
    return await fetch(GRAPHQL_URL, {
      method: 'POST',
      signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      "Can't reach the server. Check your connection and try again.",
    )
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as {
    data?: T
    errors?: GraphQLErrorBody[]
  } | null
  const error = body?.errors?.[0]
  if (error) {
    const ext = error.extensions ?? {}
    throw new ApiError(
      ext.status ?? (res.ok ? 400 : res.status),
      ext.code ?? 'GRAPHQL_ERROR',
      error.message,
      ext.fields,
    )
  }
  if (!res.ok || !body?.data) {
    throw new ApiError(res.status, 'HTTP_ERROR', `Request failed (${res.status})`)
  }
  return body.data
}

const REFRESH = `mutation RefreshSession { refreshSession { id } }`
let refreshing: Promise<boolean> | null = null

/**
 * Renews the session with the refresh cookie. Concurrent callers share one
 * request. REFRESH_RACED means another tab refreshed a moment ago and the
 * browser already has the new cookie, so we simply try once more.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await parse(await post(REFRESH, undefined))
        return true
      } catch (err) {
        if (!isApiError(err, 'REFRESH_RACED')) return false
      }
    }
    return false
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

interface Options {
  signal?: AbortSignal
  /** Don't try to renew the session on UNAUTHENTICATED (sign-in operations themselves). */
  noRefresh?: boolean
}

/** Runs a GraphQL operation and returns its `data`. Throws ApiError on any error. */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  options: Options = {},
): Promise<T> {
  try {
    return await parse<T>(await post(query, variables, options.signal))
  } catch (err) {
    // The access cookie lasts 15 minutes; renew it once and retry.
    if (
      !options.noRefresh &&
      err instanceof ApiError &&
      SESSION_CODES.has(err.code) &&
      (await refreshSession())
    ) {
      return parse<T>(await post(query, variables, options.signal))
    }
    throw err
  }
}
