import { loadEnv } from './config/env'
import { connectDatabase } from './config/db'
import { createLogger } from './lib/logger'
import { createServer } from './app'
import { seedDemoData } from './services/seed'
import { aiEnabled, configureAi } from './services/ai.service'

const env = loadEnv()
const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development')

const closeDatabase = await connectDatabase(env.MONGODB_URI, logger)
// The in-memory database starts empty every time; fill it with demo data.
if (env.MONGODB_URI === 'memory') await seedDemoData(logger)
configureAi(env)
logger.info(aiEnabled() ? `AI assist on (${env.AI_MODEL})` : 'AI assist off (no ANTHROPIC_API_KEY)')

const { httpServer, stop } = await createServer({ env, logger })
httpServer.listen(env.PORT, () => {
  logger.info(`GraphQL on http://localhost:${env.PORT}/graphql (HTTP + WebSocket)`)
})

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'Shutting down')
  // Drains HTTP requests and closes WebSockets, then the database.
  await stop()
  await closeDatabase()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
