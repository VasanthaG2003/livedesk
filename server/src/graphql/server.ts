import type { Server as HttpServer } from 'node:http'
import type { Express } from 'express'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@as-integrations/express5'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { useServer } from 'graphql-ws/use/ws'
import { WebSocketServer } from 'ws'
import type { Env } from '../config/env'
import type { Logger } from '../lib/logger'
import { agentConnected, agentDisconnected, trackSocket } from '../realtime'
import { verifySocketToken } from '../services/auth.service'
import type { AuthUser } from '../types/auth'
import { httpContext, loadActiveUser, type GqlContext } from './context'
import { createFormatError } from './errors'
import { adminResolvers } from './resolvers/admin'
import { aiResolvers } from './resolvers/ai'
import { authResolvers } from './resolvers/auth'
import { subscriptionResolvers } from './resolvers/subscriptions'
import { ticketResolvers } from './resolvers/tickets'
import { typeDefs } from './schema'

export const GRAPHQL_PATH = '/graphql'

export const schema = makeExecutableSchema<GqlContext>({
  typeDefs,
  resolvers: {
    Query: {
      ...authResolvers.Query,
      ...ticketResolvers.Query,
      ...adminResolvers.Query,
      ...aiResolvers.Query,
    },
    Mutation: {
      ...authResolvers.Mutation,
      ...ticketResolvers.Mutation,
      ...adminResolvers.Mutation,
      ...aiResolvers.Mutation,
    },
    ...subscriptionResolvers,
  },
})

type WsExtra = {
  user?: AuthUser
}

/**
 * Serves the one schema on both transports, at the same path:
 *  - HTTP  POST /graphql   queries and mutations (Apollo Server 5 on Express 5),
 *    authenticated by the HttpOnly session cookie;
 *  - WS    /graphql        subscriptions (graphql-ws), authenticated by a
 *    60-second token the browser sends in connectionParams.
 * Returns a function that closes the WebSocket server.
 */
export async function attachGraphQL({
  app,
  httpServer,
  env,
  logger,
}: {
  app: Express
  httpServer: HttpServer
  env: Env
  logger: Logger
}) {
  const formatError = createFormatError(logger)
  const wsServer = new WebSocketServer({ server: httpServer, path: GRAPHQL_PATH })

  const wsCleanup = useServer<Record<string, unknown>, WsExtra>(
    {
      schema,
      async onConnect(ctx) {
        // Browsers always send Origin on WebSocket upgrades; refuse foreign sites.
        const origin = ctx.extra.request.headers.origin
        if (origin && !env.CLIENT_ORIGINS.includes(origin)) return false
        const token = ctx.connectionParams?.token
        if (typeof token !== 'string') return false
        try {
          const user = await loadActiveUser(await verifySocketToken(token, env.JWT_SOCKET_SECRET))
          if (!user) return false
          ctx.extra.user = user
          trackSocket(user.id, ctx.extra.socket)
          if (user.role === 'agent') agentConnected(user.id)
          return true
        } catch {
          return false // closes with 4403 Forbidden
        }
      },
      onDisconnect(ctx) {
        if (ctx.extra.user?.role === 'agent') agentDisconnected(ctx.extra.user.id)
      },
      context: (ctx): GqlContext => ({
        env,
        user: ctx.extra.user ?? null,
        authError: null,
        ip: ctx.extra.request.socket.remoteAddress ?? 'unknown',
      }),
      // Same error shape as over HTTP: { message, extensions: { code, fields? } }.
      // Resolver errors arrive as results with `errors` (onNext); protocol-level
      // ones go through onError.
      onNext: (_ctx, _id, _payload, _args, result) =>
        'errors' in result && result.errors
          ? { ...result, errors: result.errors.map((e) => formatError(e.toJSON(), e)) }
          : undefined,
      onError: (_ctx, _id, _payload, errors) => errors.map((e) => formatError(e.toJSON(), e)),
    },
    wsServer,
  )

  const apollo = new ApolloServer<GqlContext>({
    schema,
    formatError,
    introspection: env.NODE_ENV !== 'production',
    // Apollo's CSRF prevention (on by default) rejects simple cross-site
    // requests; combined with SameSite cookies and the Origin check.
    csrfPrevention: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageDisabled(),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsCleanup.dispose()
            },
          }
        },
      },
    ],
  })
  await apollo.start()

  app.use(
    GRAPHQL_PATH,
    expressMiddleware(apollo, { context: ({ req, res }) => httpContext(env, req, res) }),
  )

  return async () => {
    await apollo.stop()
  }
}
