import mongoose from 'mongoose'
import type { Logger } from '../lib/logger'

/**
 * Connects Mongoose and returns a function that closes the connection.
 * MONGODB_URI=memory (development only, enforced in env.ts) starts a
 * throwaway in-memory MongoDB so the app runs without an Atlas cluster.
 */
export async function connectDatabase(uri: string, logger: Logger): Promise<() => Promise<void>> {
  let stopMemoryServer: (() => Promise<unknown>) | undefined

  if (uri === 'memory') {
    // Dynamic import: mongodb-memory-server is a devDependency and is never
    // loaded in production.
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const memory = await MongoMemoryServer.create()
    uri = memory.getUri('livedesk')
    stopMemoryServer = () => memory.stop()
    logger.warn('Using an in-memory MongoDB. Data will be lost when the server stops.')
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 })
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected')

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'))

  return async () => {
    await mongoose.disconnect()
    await stopMemoryServer?.()
  }
}

export function databaseStatus(): 'connected' | 'connecting' | 'disconnected' {
  switch (mongoose.connection.readyState) {
    case mongoose.ConnectionStates.connected:
      return 'connected'
    case mongoose.ConnectionStates.connecting:
      return 'connecting'
    default:
      return 'disconnected'
  }
}
