import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { UserModel } from '../models/user.model'
import { SessionModel } from '../models/session.model'
import { useTestDatabase } from './db'
import { PASSWORD, app, gql, ok, signedIn } from './fixtures'
import { ops } from './ops'

useTestDatabase()

const cookieNames = (headers: Record<string, unknown>) =>
  ([] as string[]).concat((headers['set-cookie'] as string[]) ?? []).map((c) => c.split('=')[0])
const refreshCookie = (agent: ReturnType<typeof request.agent>) =>
  agent.jar.getCookie('ld_refresh', {
    path: '/graphql',
    domain: '127.0.0.1',
    secure: false,
    script: false,
  })?.value

describe('registration', () => {
  it('creates a customer, stores only a hash, and signs them in with HttpOnly cookies', async () => {
    const agent = request.agent(app)
    const res = await gql(agent, ops.register, {
      input: { name: 'Vasantha G', email: 'Vasantha@Example.com', password: 'a-good-password' },
    })
    expect(res.errors).toBeUndefined()
    expect(res.data!.register).toMatchObject({
      name: 'Vasantha G',
      email: 'vasantha@example.com',
      role: 'customer',
    })
    expect(cookieNames(res.headers)).toEqual(expect.arrayContaining(['ld_access', 'ld_refresh']))
    for (const cookie of [res.headers['set-cookie']].flat()) {
      expect(cookie).toMatch(/HttpOnly/i)
      expect(cookie).toMatch(/SameSite=Lax/i)
    }
    const stored = await UserModel.findOne({ email: 'vasantha@example.com' })
      .select('+passwordHash')
      .lean()
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/)

    const me = await ok(agent, ops.me)
    expect(me.me.email).toBe('vasantha@example.com')
  })

  it('the schema rejects a smuggled role field before any resolver runs', async () => {
    const res = await gql(
      request(app),
      ops.register.replace('register(input: $input)', 'register(input: $input)'),
      {
        input: {
          name: 'Mallory',
          email: 'm@example.com',
          password: 'a-good-password',
          role: 'admin',
        },
      },
    )
    expect(res.errors?.[0]?.message).toMatch(/role/)
    expect(await UserModel.countDocuments()).toBe(0)
  })

  it('returns field errors for invalid input', async () => {
    const res = await gql(request(app), ops.register, {
      input: { name: 'V', email: 'nope', password: 'short' },
    })
    expect(res.code).toBe('BAD_USER_INPUT')
    expect(Object.keys(res.errors![0]!.extensions!.fields!)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    )
  })

  it('rejects a duplicate email', async () => {
    const input = { name: 'Vasantha', email: 'dup@example.com', password: 'a-good-password' }
    await ok(request(app), ops.register, { input })
    const res = await gql(request(app), ops.register, { input })
    expect(res.code).toBe('EMAIL_TAKEN')
  })
})

describe('login', () => {
  it('uses the same message for a wrong password and an unknown email', async () => {
    const { email } = await signedIn('customer')
    const wrong = await gql(request(app), ops.login, {
      input: { email, password: 'wrong-password' },
    })
    const unknown = await gql(request(app), ops.login, {
      input: { email: 'ghost@test.dev', password: PASSWORD },
    })
    expect(wrong.code).toBe('INVALID_CREDENTIALS')
    expect(wrong.errors).toEqual(unknown.errors)
  })

  it('blocks a deactivated account, and its existing session stops working at once', async () => {
    const { agent, id, email } = await signedIn('customer')
    await UserModel.updateOne({ _id: id }, { isActive: false })
    expect((await ok(agent, ops.me)).me).toBeNull()
    const res = await gql(request(app), ops.login, { input: { email, password: PASSWORD } })
    expect(res.code).toBe('ACCOUNT_DISABLED')
  })
})

describe('sessions', () => {
  it('me is null when signed out, and protected operations say UNAUTHENTICATED', async () => {
    expect((await ok(request(app), ops.me)).me).toBeNull()
    expect((await gql(request(app), ops.tickets)).code).toBe('UNAUTHENTICATED')
  })

  it('rotates the refresh token, and reusing an old one revokes the whole session family', async () => {
    const { agent } = await signedIn('customer')
    const oldToken = refreshCookie(agent)
    expect(oldToken).toBeTruthy()
    await ok(agent, ops.refresh)

    // Wait past the concurrent-refresh grace window by backdating the revocation.
    await SessionModel.updateMany(
      { revokedAt: { $ne: null } },
      { revokedAt: new Date(Date.now() - 60_000) },
    )

    const replay = await gql(request(app), ops.refresh, undefined, {
      Cookie: `ld_refresh=${oldToken}`,
    })
    expect(replay.code).toBe('SESSION_EXPIRED')
    expect((await gql(agent, ops.refresh)).code).toBe('SESSION_EXPIRED')
    expect(await SessionModel.countDocuments({ revokedAt: null })).toBe(0)
  })

  it('two tabs refreshing with the same token at once: one wins, the other is told to retry', async () => {
    const { agent } = await signedIn('customer')
    const token = refreshCookie(agent)
    const send = () => gql(request(app), ops.refresh, undefined, { Cookie: `ld_refresh=${token}` })
    const codes = (await Promise.all([send(), send()])).map((r) => r.code ?? 'OK').sort()
    expect(codes).toEqual(['OK', 'REFRESH_RACED'])
    expect(await SessionModel.countDocuments({ revokedAt: null })).toBe(1)
  })

  it('logout revokes the session and clears cookies', async () => {
    const { agent } = await signedIn('customer')
    await ok(agent, ops.logout)
    expect(await SessionModel.countDocuments({ revokedAt: null })).toBe(0)
    expect((await ok(agent, ops.me)).me).toBeNull()
  })

  it('change-password checks the current password and signs out other devices', async () => {
    const { agent, email } = await signedIn('customer')
    const other = request.agent(app)
    await ok(other, ops.login, { input: { email, password: PASSWORD } })

    const bad = await gql(agent, ops.changePassword, {
      input: { currentPassword: 'nope', newPassword: 'brand-new-password' },
    })
    expect(bad.errors![0]!.extensions!.fields!.currentPassword).toBeDefined()

    await ok(agent, ops.changePassword, {
      input: { currentPassword: PASSWORD, newPassword: 'brand-new-password' },
    })
    expect((await gql(other, ops.refresh)).code).toBe('SESSION_EXPIRED')
    expect((await ok(agent, ops.me)).me).not.toBeNull()
    await ok(request(app), ops.login, { input: { email, password: 'brand-new-password' } })
  })
})
