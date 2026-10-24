import { createServer as createHttpServer } from 'node:http'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { rateLimit } from 'express-rate-limit'
import { pinoHttp } from 'pino-http'
import type { Env } from './config/env'
import type { Logger } from './lib/logger'
import { attachGraphQL } from './graphql/server'
import { requireTrustedOrigin } from './middleware/origin'
import { errorHandler, notFoundHandler } from './middleware/error-handler'
import { healthRouter } from './routes/health.routes'

interface AppDeps {
  env: Env
  logger: Logger
}

/**
 * Builds the Express app and HTTP server with GraphQL attached, without
 * listening — tests use the app with Supertest and listen on a random port
 * when they need WebSockets.
 */
export async function createServer({ env, logger }: AppDeps) {
  const app = express()
  const httpServer = createHttpServer(app)

  // Behind Render's proxy this makes req.ip the real client IP (rate limiting)
  // and req.secure true for HTTPS requests (Secure cookies).
  app.set('trust proxy', env.TRUST_PROXY)

  app.use(helmet())
  app.use(
    pinoHttp({ logger, autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false } }),
  )
  app.use(
    cors({
      // Only listed browser origins may call the API with credentials.
      // Requests without an Origin header (curl, health checks) aren't browser
      // CORS requests, so they are allowed through to normal auth checks.
      origin: (origin, callback) => callback(null, !origin || env.CLIENT_ORIGINS.includes(origin)),
      credentials: true,
    }),
  )
  app.use(
    '/graphql',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => env.NODE_ENV === 'test',
      handler: (_req, res) => {
        res.status(429).json({
          errors: [
            {
              message: 'Too many requests. Please slow down.',
              extensions: { code: 'RATE_LIMITED' },
            },
          ],
        })
      },
    }),
  )
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use(requireTrustedOrigin(env))

  app.use('/health', healthRouter)
  const stopGraphQL = await attachGraphQL({ app, httpServer, env, logger })

  app.use(notFoundHandler)
  app.use(errorHandler)

  return { app, httpServer, stop: stopGraphQL }
}
