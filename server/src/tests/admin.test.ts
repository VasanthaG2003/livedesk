import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { Types } from 'mongoose'
import { TicketModel } from '../models/ticket.model'
import { useTestDatabase } from './db'
import { PASSWORD, app, gql, ok, signedIn, validTicket } from './fixtures'
import { ops } from './ops'

useTestDatabase()

const HOUR = 3_600_000
const ago = (h: number) => new Date(Date.now() - h * HOUR)

/** Creates a ticket through the API, then sets exact timestamps via the raw driver. */
async function ticketWith(
  customer: Awaited<ReturnType<typeof signedIn>>,
  times: {
    created: number
    firstResponse?: number
    resolved?: number
    dueAfterH?: number
    rating?: number
  },
  extra: Partial<typeof validTicket> = {},
) {
  const t = (await ok(customer.agent, ops.createTicket, { input: { ...validTicket, ...extra } }))
    .createTicket
  const created = ago(times.created)
  await TicketModel.collection.updateOne(
    { _id: new Types.ObjectId(t.id) },
    {
      $set: {
        createdAt: created,
        firstResponseAt: times.firstResponse === undefined ? null : ago(times.firstResponse),
        firstResponseDueAt: new Date(created.getTime() + (times.dueAfterH ?? 1) * HOUR),
        resolvedAt: times.resolved === undefined ? null : ago(times.resolved),
        status: times.resolved === undefined ? 'open' : 'resolved',
        rating: times.rating ? { score: times.rating, comment: null, ratedAt: ago(1) } : null,
      },
    },
  )
  return t.id as string
}

describe('admin stats', () => {
  it('computes metrics from stored timestamps and compares with the previous period', async () => {
    const customer = await signedIn('customer')
    await ticketWith(
      customer,
      { created: 10, firstResponse: 9, resolved: 5, dueAfterH: 4, rating: 5 },
      { category: 'billing' },
    )
    await ticketWith(
      customer,
      { created: 30, firstResponse: 27, dueAfterH: 1 },
      { category: 'bug' },
    )
    await ticketWith(customer, { created: 24 * 9, firstResponse: 24 * 9 - 2, resolved: 24 * 8 })

    const admin = await signedIn('admin')
    const s = (await ok(admin.agent, ops.adminStats, { days: 7, tz: 'Asia/Kolkata' })).adminStats
    expect(s.created).toEqual({ current: 2, previous: 1 })
    expect(s.resolved).toEqual({ current: 1, previous: 1 })
    expect(s.avgFirstResponseMs.current).toBeCloseTo(2 * HOUR, -3)
    expect(s.avgResolutionMs.current).toBeCloseTo(5 * HOUR, -3)
    expect(s.slaMetPct.current).toBe(50)
    expect(s.csat).toEqual({ average: 5, count: 1 })
    expect(s.byCategory).toMatchObject({ billing: 1, bug: 1, account: 0 })
    expect(s.trend).toHaveLength(7)
    expect(s.trend.reduce((n: number, d: { created: number }) => n + d.created, 0)).toBe(2)
    expect(s.range.tz).toBe('Asia/Kolkata')
  })

  it('is admin-only and validates its arguments', async () => {
    const agent = await signedIn('agent')
    const customer = await signedIn('customer')
    const admin = await signedIn('admin')
    expect((await gql(agent.agent, ops.adminStats)).code).toBe('FORBIDDEN')
    expect((await gql(customer.agent, ops.adminStats)).code).toBe('FORBIDDEN')
    expect((await gql(request(app), ops.adminStats)).code).toBe('UNAUTHENTICATED')
    expect((await gql(admin.agent, ops.adminStats, { days: 12 })).code).toBe('BAD_USER_INPUT')
    expect((await gql(admin.agent, ops.adminStats, { tz: 'Not/AZone' })).code).toBe(
      'BAD_USER_INPUT',
    )
  })

  it("an agent's own stats only count their tickets", async () => {
    const customer = await signedIn('customer')
    const me = await signedIn('agent')
    const other = await signedIn('agent')
    const mine = await ticketWith(customer, { created: 5, firstResponse: 4, resolved: 2 })
    const theirs = await ticketWith(customer, { created: 5, firstResponse: 4, resolved: 2 })
    await TicketModel.updateOne({ _id: mine }, { assignedAgentId: me.id })
    await TicketModel.updateOne({ _id: theirs }, { assignedAgentId: other.id })
    expect((await ok(me.agent, ops.myStats, { days: 7 })).myStats.resolved.current).toBe(1)
    const admin = await signedIn('admin')
    expect((await gql(admin.agent, ops.myStats)).code).toBe('FORBIDDEN')
  })
})

describe('user management', () => {
  it('lists users by role with ticket counts; agents can list customers only', async () => {
    const customer = await signedIn('customer', 'Vasantha G')
    await ticketWith(customer, { created: 2 })
    const agent = await signedIn('agent')
    const admin = await signedIn('admin')
    const list = (await ok(admin.agent, ops.users, { role: 'customer', q: 'vasantha' })).users
    expect(list.data).toHaveLength(1)
    expect(list.data[0]).toMatchObject({ name: 'Vasantha G', totalTickets: 1, openTickets: 1 })
    await ok(agent.agent, ops.customers)
    expect((await gql(agent.agent, ops.users, { role: 'admin' })).code).toBe('FORBIDDEN')
  })

  it('deactivating a user signs them out everywhere and is audited; admins cannot deactivate themselves', async () => {
    const victim = await signedIn('customer', 'Rohan S')
    const admin = await signedIn('admin', 'Priya Nair')
    expect(
      (await gql(admin.agent, ops.setUserActive, { id: admin.id, isActive: false })).code,
    ).toBe('BAD_REQUEST')
    await ok(admin.agent, ops.setUserActive, { id: victim.id, isActive: false })

    expect((await ok(victim.agent, ops.me)).me).toBeNull()
    expect((await gql(victim.agent, ops.refresh)).code).toBe('SESSION_EXPIRED')
    expect(
      (await gql(request(app), ops.login, { input: { email: victim.email, password: PASSWORD } }))
        .code,
    ).toBe('ACCOUNT_DISABLED')

    const audit = (await ok(admin.agent, ops.auditLog)).auditLog
    expect(audit[0]).toMatchObject({
      action: 'user.deactivated',
      actor: { name: 'Priya Nair' },
      target: { name: 'Rohan S' },
    })
  })

  it('admins create agent accounts; only admins can', async () => {
    const admin = await signedIn('admin')
    const res = (
      await ok(admin.agent, ops.createAgent, {
        input: { name: 'Neha Joshi', email: 'neha@test.dev', password: 'temporary-pass-1' },
      })
    ).createAgent
    expect(res.role).toBe('agent')
    await ok(request(app), ops.login, {
      input: { email: 'neha@test.dev', password: 'temporary-pass-1' },
    })
    const agent = await signedIn('agent')
    expect(
      (
        await gql(agent.agent, ops.createAgent, {
          input: { name: 'X Y', email: 'x@test.dev', password: 'temporary-pass-1' },
        })
      ).code,
    ).toBe('FORBIDDEN')
  })
})
