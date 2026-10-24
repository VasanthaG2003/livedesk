import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import WebSocket from 'ws'
import { createClient, type Client } from 'graphql-ws'
import { resetRealtime } from '../realtime'
import { useTestDatabase } from './db'
import { app, customerWithTicket, gql, httpServer, ok, signedIn } from './fixtures'
import { ops } from './ops'

useTestDatabase()

let url: string
const clients: Client[] = []

beforeAll(async () => {
  await new Promise<void>((r) => httpServer.listen(0, r))
  url = `ws://127.0.0.1:${(httpServer.address() as AddressInfo).port}/graphql`
})
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.dispose()))
  resetRealtime()
})
afterAll(() => new Promise<void>((r) => httpServer.close(() => r())))

/** A WebSocket class that sends a given Origin header, like a browser would. */
const withOrigin = (origin: string) =>
  class extends WebSocket {
    constructor(address: string, protocols?: string | string[]) {
      super(address, protocols, { headers: { origin } })
    }
  }

/** Opens a graphql-ws connection; resolves when acknowledged, rejects with the close code. */
function connect(token: unknown, origin = 'http://localhost:5173'): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = createClient({
      url,
      webSocketImpl: withOrigin(origin),
      connectionParams: { token },
      lazy: false,
      retryAttempts: 0,
      onNonLazyError: () => {},
    })
    clients.push(client)
    client.on('connected', () => resolve(client))
    client.on('closed', (event) => reject(new Error(`closed ${(event as { code: number }).code}`)))
  })
}

async function live(role: 'customer' | 'agent' | 'admin', name?: string) {
  const user = await signedIn(role, name)
  const token = (await ok(user.agent, ops.subscriptionToken)).subscriptionToken
  return { ...user, client: await connect(token) }
}

type Event = Record<string, any>

/** Subscribes and collects events; `next()` waits for the next one, `none()` asserts silence. */
function subscribe(client: Client, query: string, variables?: Record<string, unknown>) {
  const queue: Event[] = []
  const waiters: ((e: Event) => void)[] = []
  let error: unknown = null
  const errorWaiters: ((e: unknown) => void)[] = []
  client.subscribe<Event>(
    { query, variables },
    {
      next: (value) => {
        if (value.errors) {
          error = value.errors
          errorWaiters.splice(0).forEach((w) => w(error))
          return
        }
        const w = waiters.shift()
        if (w) w(value.data!)
        else queue.push(value.data!)
      },
      error: (err) => {
        error = err
        errorWaiters.splice(0).forEach((w) => w(err))
      },
      complete: () => {},
    },
  )
  return {
    next(ms = 2000): Promise<Event> {
      const queued = queue.shift()
      if (queued) return Promise.resolve(queued)
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`no event within ${ms}ms`)), ms)
        waiters.push((e) => {
          clearTimeout(t)
          resolve(e)
        })
      })
    },
    /** Waits for an event matching `pick`, skipping others. */
    async until(pick: (e: Event) => boolean, ms = 2000) {
      const deadline = Date.now() + ms
      for (;;) {
        const e = await this.next(Math.max(1, deadline - Date.now()))
        if (pick(e)) return e
      }
    },
    async none(ms = 400) {
      await new Promise((r) => setTimeout(r, ms))
      return queue.length === 0
    },
    failed(ms = 2000): Promise<unknown> {
      if (error) return Promise.resolve(error)
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('subscription did not fail')), ms)
        errorWaiters.push((e) => {
          clearTimeout(t)
          resolve(e)
        })
      })
    },
  }
}

const TICKET_EVENTS = `subscription { ticketEvents { type from to ticket { id subject customerReadAt } message { body internal } } }`
const NOTIFICATIONS = `subscription { notifications { kind title } }`
const ROOM = `subscription($ticketId: ID!) { ticketRoom(ticketId: $ticketId) { type typing user { name } viewers { name } } }`
const PRESENCE = `subscription { agentPresence }`
// Lets a subscription register on the server before we trigger an event.
const settle = () => new Promise((r) => setTimeout(r, 150))

describe('connection authentication (connectionParams)', () => {
  it('rejects no token, garbage, and an access token used as a socket token', async () => {
    await expect(connect(undefined)).rejects.toThrow('closed 4403')
    await expect(connect('not-a-jwt')).rejects.toThrow('closed 4403')
    const { agent } = await signedIn('customer')
    const login = await gql(agent, ops.refresh)
    const access = [login.headers['set-cookie']]
      .flat()
      .find((c) => String(c).startsWith('ld_access='))!
    await expect(connect(String(access).split(';')[0]!.split('=')[1])).rejects.toThrow(
      'closed 4403',
    )
  })

  it('rejects a foreign Origin even with a valid token', async () => {
    const user = await signedIn('customer')
    const token = (await ok(user.agent, ops.subscriptionToken)).subscriptionToken
    await expect(connect(token, 'https://evil.example')).rejects.toThrow('closed 4403')
  })

  it('socket tokens require a signed-in user', async () => {
    expect((await gql(request(app), ops.subscriptionToken)).code).toBe('UNAUTHENTICATED')
  })
})

describe('withFilter authorisation of pushed events', () => {
  it("one customer never receives another customer's ticket events", async () => {
    const alice = await live('customer')
    const bob = await live('customer')
    const aliceEvents = subscribe(alice.client, TICKET_EVENTS)
    const bobEvents = subscribe(bob.client, TICKET_EVENTS)
    await settle()

    const ticket = (
      await ok(alice.agent, ops.createTicket, {
        input: {
          subject: 'Alice private issue',
          description: 'Only Alice may see this.',
          category: 'bug',
          priority: 'low',
        },
      })
    ).createTicket
    const staff = await signedIn('agent')
    await ok(staff.agent, ops.sendMessage, { ticketId: ticket.id, input: { body: 'Hi Alice' } })

    expect(
      (await aliceEvents.until((e) => e.ticketEvents.type === 'message')).ticketEvents.message.body,
    ).toBe('Hi Alice')
    expect(await bobEvents.none()).toBe(true)
  })

  it('internal notes reach staff but never the customer', async () => {
    const customer = await live('customer')
    const staff = await live('agent')
    const created = (
      await ok(customer.agent, ops.createTicket, {
        input: {
          subject: 'Needs a note',
          description: 'Staff will discuss this.',
          category: 'bug',
          priority: 'low',
        },
      })
    ).createTicket
    const customerEvents = subscribe(customer.client, TICKET_EVENTS)
    const staffEvents = subscribe(staff.client, TICKET_EVENTS)
    await settle()

    await ok(staff.agent, ops.sendMessage, {
      ticketId: created.id,
      input: { body: 'Customer seems upset', internal: true },
    })
    expect(
      (await staffEvents.until((e) => e.ticketEvents.type === 'message')).ticketEvents.message,
    ).toMatchObject({ internal: true })
    expect(await customerEvents.none()).toBe(true)
  })

  it('staff hear about new tickets the moment they are saved', async () => {
    const staff = await live('agent')
    const events = subscribe(staff.client, TICKET_EVENTS)
    const notes = subscribe(staff.client, NOTIFICATIONS)
    await settle()
    await customerWithTicket()
    expect((await events.next()).ticketEvents.type).toBe('created')
    expect((await notes.next()).notifications.kind).toBe('created')
  })

  it('a status change reaches the customer with a notification; a read receipt reaches staff', async () => {
    const customer = await live('customer')
    const admin = await live('admin')
    const created = (
      await ok(customer.agent, ops.createTicket, {
        input: {
          subject: 'Status test',
          description: 'Watch the status move.',
          category: 'bug',
          priority: 'low',
        },
      })
    ).createTicket
    const customerEvents = subscribe(customer.client, TICKET_EVENTS)
    const customerNotes = subscribe(customer.client, NOTIFICATIONS)
    const adminEvents = subscribe(admin.client, TICKET_EVENTS)
    await settle()

    await ok(admin.agent, ops.updateTicket, { id: created.id, input: { status: 'resolved' } })
    expect(
      (await customerEvents.until((e) => e.ticketEvents.type === 'status_changed')).ticketEvents,
    ).toMatchObject({ from: 'open', to: 'resolved' })
    expect((await customerNotes.next()).notifications.title).toContain('Resolved')

    await ok(customer.agent, ops.markRead, { ticketId: created.id })
    const receipt = await adminEvents.until(
      (e) => e.ticketEvents.type === 'updated' && !!e.ticketEvents.ticket.customerReadAt,
    )
    expect(receipt.ticketEvents.ticket.customerReadAt).not.toBeNull()
  })
})

describe('ticket rooms: viewers and typing', () => {
  it("joining someone else's ticket room fails like a missing ticket", async () => {
    const { ticket } = await customerWithTicket()
    const stranger = await live('customer')
    const room = subscribe(stranger.client, ROOM, { ticketId: ticket.id })
    expect(JSON.stringify(await room.failed())).toContain('NOT_FOUND')
  })

  it('announces viewers, and sends typing to others in the room only', async () => {
    const customer = await live('customer', 'Vasantha G')
    const staff = await live('agent', 'Ankit Sharma')
    const created = (
      await ok(customer.agent, ops.createTicket, {
        input: {
          subject: 'Typing test',
          description: 'Who is typing here?',
          category: 'bug',
          priority: 'low',
        },
      })
    ).createTicket

    const customerRoom = subscribe(customer.client, ROOM, { ticketId: created.id })
    expect(
      (await customerRoom.next()).ticketRoom.viewers.map((v: { name: string }) => v.name),
    ).toEqual(['Vasantha G'])
    const staffRoom = subscribe(staff.client, ROOM, { ticketId: created.id })
    await staffRoom.next() // its own initial viewers list
    const joined = await customerRoom.until((e) => e.ticketRoom.type === 'viewers')
    expect(joined.ticketRoom.viewers.map((v: { name: string }) => v.name).sort()).toEqual([
      'Ankit Sharma',
      'Vasantha G',
    ])

    await ok(staff.agent, ops.setTyping, { ticketId: created.id, typing: true })
    const typing = await customerRoom.until((e) => e.ticketRoom.type === 'typing')
    expect(typing.ticketRoom).toMatchObject({ typing: true, user: { name: 'Ankit Sharma' } })
    expect(await staffRoom.none()).toBe(true) // no echo of your own typing

    const outsider = await signedIn('customer')
    expect(
      (await gql(outsider.agent, ops.setTyping, { ticketId: created.id, typing: true })).code,
    ).toBe('NOT_FOUND')
  })
})

describe('presence and access revocation', () => {
  it('staff see which agents are online; customers may not subscribe', async () => {
    const agent = await live('agent')
    const admin = await live('admin')
    const presence = subscribe(admin.client, PRESENCE)
    expect((await presence.next()).agentPresence).toContain(agent.id)

    const customer = await live('customer')
    expect(JSON.stringify(await subscribe(customer.client, PRESENCE).failed())).toContain(
      'FORBIDDEN',
    )
  })

  it('changing the password closes live connections', async () => {
    const user = await live('customer')
    const closed = new Promise<number>((resolve) =>
      user.client.on('closed', (e) => resolve((e as { code: number }).code)),
    )
    await ok(user.agent, ops.changePassword, {
      input: { currentPassword: 'correct-horse-battery', newPassword: 'another-strong-pass' },
    })
    expect(await closed).toBe(4403)
  })
})
