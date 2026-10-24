import { Router } from 'express'
import { databaseStatus } from '../config/db'

export const healthRouter = Router()

/**
 * GET /health — liveness. Public. Always 200 while the process is up,
 * so the host doesn't restart the app just because the database blipped.
 */
healthRouter.get('/', (_req, res) => {
  res.json({ data: { status: 'ok', uptimeSeconds: Math.round(process.uptime()) } })
})

/**
 * GET /health/ready — readiness. Public. 503 until MongoDB is connected.
 */
healthRouter.get('/ready', (_req, res) => {
  const db = databaseStatus()
  res
    .status(db === 'connected' ? 200 : 503)
    .json({ data: { status: db === 'connected' ? 'ready' : 'not_ready', db } })
})
