/**
 * Creates the first administrator. There is deliberately no HTTP endpoint for
 * this, so nobody can make themselves an admin through the API.
 *
 *   ADMIN_NAME="Priya Nair" ADMIN_EMAIL=priya@company.com ADMIN_PASSWORD='…' \
 *     npm run create-admin -w @livedesk/server
 */
import { connectDatabase } from '../config/db'
import { loadEnv } from '../config/env'
import { createLogger } from '../lib/logger'
import { UserModel } from '../models/user.model'
import { hashPassword } from '../services/auth.service'
import { registerSchema } from '@livedesk/shared'

const env = loadEnv()
const logger = createLogger('info', true)

const parsed = registerSchema.safeParse({
  name: process.env.ADMIN_NAME,
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
})
if (!parsed.success) {
  for (const issue of parsed.error.issues)
    logger.error(`ADMIN_${String(issue.path[0]).toUpperCase()}: ${issue.message}`)
  process.exit(1)
}

const close = await connectDatabase(env.MONGODB_URI, logger)
try {
  if (await UserModel.exists({ email: parsed.data.email })) {
    logger.error('A user with that email already exists')
    process.exitCode = 1
  } else {
    await UserModel.create({
      name: parsed.data.name,
      email: parsed.data.email,
      role: 'admin',
      passwordHash: await hashPassword(parsed.data.password),
    })
    logger.info(`Admin ${parsed.data.email} created`)
  }
} finally {
  await close()
}
