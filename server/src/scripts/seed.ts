/**
 * Seeds an EMPTY development database with demo data:
 *   npm run seed -w @livedesk/server
 * Refuses to run when NODE_ENV=production.
 */
import { connectDatabase } from '../config/db'
import { loadEnv } from '../config/env'
import { createLogger } from '../lib/logger'
import { assertNotProduction, seedDemoData } from '../services/seed'

assertNotProduction()
const env = loadEnv()
const logger = createLogger('info', true)
const close = await connectDatabase(env.MONGODB_URI, logger)
try {
  await seedDemoData(logger)
} finally {
  await close()
}
