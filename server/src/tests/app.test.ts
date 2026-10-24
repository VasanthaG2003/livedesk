import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { buildTestServer } from './helpers'

const { app } = await buildTestServer()

describe('health', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ok')
  })

  it('GET /health/ready returns 503 when the database is not connected', async () => {
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(503)
    expect(res.body.data).toEqual({ status: 'not_ready', db: 'disconnected' })
  })
})

describe('transport-level protection', () => {
  it('unknown paths return a JSON 404', async () => {
    const res = await request(app).get('/api/v1/tickets')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('malformed JSON returns 400 without a stack trace', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send('{"query":')
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(js|ts)/)
  })

  it('blocks "simple" cross-site requests (Apollo CSRF prevention)', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Content-Type', 'text/plain')
      .send('{"query":"{ me { id } }"}')
    expect(res.status).toBe(400)
  })

  it('rejects mutations from a foreign Origin', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Origin', 'https://evil.example')
      .send({ query: 'mutation { logout }' })
    expect(res.status).toBe(403)
  })

  it('sets helmet headers and hides X-Powered-By', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('grants CORS only to listed origins', async () => {
    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5173')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')
    const denied = await request(app).get('/health').set('Origin', 'https://evil.example')
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })
})
