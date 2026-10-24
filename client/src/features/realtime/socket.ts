import { createClient, type Client } from 'graphql-ws'
import { gql } from '@/lib/api'
import { M } from '@/lib/operations'

/**
 * Subscriptions run over graphql-ws on the same /graphql path. In development
 * that's the Vite dev server (proxied to the API); in production it's the API
 * host from VITE_GRAPHQL_WS_URL, because Vercel can't proxy WebSockets.
 */
function wsUrl() {
  const configured: string | undefined = import.meta.env.VITE_GRAPHQL_WS_URL
  if (configured) return configured
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/graphql`
}

export type LiveConnectionEvents = {
  onConnecting: () => void
  onConnected: (reconnected: boolean) => void
  onClosed: () => void
}

export function createLiveClient(events: LiveConnectionEvents): Client {
  let everConnected = false
  return createClient({
    url: wsUrl(),
    // Connects on the first subscription and closes when the last one ends.
    lazy: true,
    // Before every (re)connection, fetch a fresh 60-second token over the
    // authenticated HTTP API and send it in connectionParams.
    connectionParams: async () => ({
      token: (await gql<{ subscriptionToken: string }>(M.subscriptionToken)).subscriptionToken,
    }),
    // Keep trying with backoff (network blips, server restarts, laptop sleep).
    retryAttempts: Infinity,
    shouldRetry: () => true,
    on: {
      connecting: () => events.onConnecting(),
      connected: () => {
        events.onConnected(everConnected)
        everConnected = true
      },
      closed: () => events.onClosed(),
    },
  })
}
