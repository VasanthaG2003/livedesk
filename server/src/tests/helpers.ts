import type { Env } from '../config/env'
import { createLogger } from '../lib/logger'
import { createServer } from '../app'

export const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  MONGODB_URI: 'unused-in-unit-tests',
  CLIENT_ORIGINS: ['http://localhost:5173'],
  TRUST_PROXY: 0,
  JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0000',
  JWT_SOCKET_SECRET: 'test-socket-secret-test-socket-secret-0000',
  AI_MODEL: 'claude-opus-5-5',
  LOG_LEVEL: 'silent',
}

export function buildTestServer(overrides: Partial<Env> = {}) {
  return createServer({ env: { ...testEnv, ...overrides }, logger: createLogger('silent', false) })
}
