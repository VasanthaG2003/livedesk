import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll } from 'vitest'

/**
 * Each test file gets its own throwaway in-memory MongoDB, wiped after every
 * test. Tests can never touch a real database.
 */
export function useTestDatabase() {
  let server: MongoMemoryServer

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    await mongoose.connect(server.getUri('livedesk-test'))
    await mongoose.connection.syncIndexes()
  })

  afterEach(async () => {
    const { collections } = mongoose.connection
    await Promise.all(Object.values(collections).map((c) => c.deleteMany({})))
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await server.stop()
  })
}
