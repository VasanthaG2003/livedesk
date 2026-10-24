import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { TicketModel } from '../models/ticket.model'
import { useTestDatabase } from './db'
import { app, customerWithTicket, gql, ok, signedIn, validTicket } from './fixtures'
import { ops } from './ops'

useTestDatabase()

describe('creating tickets', () => {
  it('requires sign-in', async () => {
    expect((await gql(request(app), ops.createTicket, { input: validTicket })).code).toBe(
      'UNAUTHENTICATED',
    )
  })

  it('creates an open ticket owned by the caller with sequential numbers', async () => {
    const { agent, id } = await signedIn('customer')
    const a = (await ok(agent, ops.createTicket, { input: validTicket })).createTicket
    const b = (await ok(agent, ops.createTicket, { input: validTicket })).createTicket
    expect(a).toMatchObject({ status: 'open', ticketNumber: 'TK-1001', assignedAgent: null })
    expect(a.customer.id).toBe(id)
    expect(b.ticketNumber).toBe('TK-1002')
    const activity = (await ok(agent, ops.activity, { ticketId: a.id })).activity
    expect(activity.map((x: { action: string }) => x.action)).toEqual(['created'])
  })

  it('rejects invalid input, and the schema has no way to set status or owner', async () => {
    const { agent } = await signedIn('customer')
    const bad = await gql(agent, ops.createTicket, { input: { ...validTicket, subject: 'Hi' } })
    expect(bad.code).toBe('BAD_USER_INPUT')
    expect(bad.errors![0]!.extensions!.fields).toHaveProperty('subject')

    const badEnum = await gql(agent, ops.createTicket, {
      input: { ...validTicket, category: 'nope' },
    })
    expect(badEnum.errors?.[0]?.message).toMatch(/TicketCategory/)

    const smuggled = await gql(agent, ops.createTicket, {
      input: { ...validTicket, status: 'closed', customerId: '64b000000000000000000000' },
    })
    expect(smuggled.errors?.length).toBeGreaterThan(0)
    expect(await TicketModel.countDocuments()).toBe(0)
  })

  it('agents and admins cannot create customer tickets', async () => {
    const { agent } = await signedIn('agent')
    expect((await gql(agent, ops.createTicket, { input: validTicket })).code).toBe('FORBIDDEN')
  })
})

describe('customer isolation', () => {
  it("a customer cannot see or write to another customer's ticket", async () => {
    const { ticket } = await customerWithTicket()
    const { agent: other } = await signedIn('customer')

    expect((await gql(other, ops.ticket, { id: ticket.id })).code).toBe('NOT_FOUND')
    expect((await gql(other, ops.messages, { ticketId: ticket.id })).code).toBe('NOT_FOUND')
    expect((await gql(other, ops.activity, { ticketId: ticket.id })).code).toBe('NOT_FOUND')
    expect(
      (await gql(other, ops.sendMessage, { ticketId: ticket.id, input: { body: 'hi' } })).code,
    ).toBe('NOT_FOUND')

    const list = (await ok(other, ops.tickets)).tickets
    expect(list.data).toHaveLength(0)
    expect(list.meta.total).toBe(0)
  })

  it('a malformed id is NOT_FOUND, not a server error', async () => {
    const { agent } = await signedIn('customer')
    expect((await gql(agent, ops.ticket, { id: 'not-an-id' })).code).toBe('NOT_FOUND')
  })

  it('customers cannot change status or assignment', async () => {
    const { customer, ticket } = await customerWithTicket()
    expect(
      (await gql(customer.agent, ops.updateTicket, { id: ticket.id, input: { status: 'closed' } }))
        .code,
    ).toBe('FORBIDDEN')
  })

  it("filters on another customer's id are ignored for customers", async () => {
    const { customer: a } = await customerWithTicket()
    const { customer: b } = await customerWithTicket()
    const list = (await ok(a.agent, ops.tickets, { filter: { customerId: b.id } })).tickets
    expect(list.data.every((t: { customer: { id: string } }) => t.customer.id === a.id)).toBe(true)
  })
})

describe('chat messages', () => {
  it("an agent's first reply takes the ticket, moves it to In Progress and records first response", async () => {
    const { customer, ticket } = await customerWithTicket()
    const staff = await signedIn('agent', 'Ankit Sharma')
    const res = (
      await ok(staff.agent, ops.sendMessage, {
        ticketId: ticket.id,
        input: { body: 'Looking into it' },
      })
    ).sendMessage
    expect(res.message).toMatchObject({
      body: 'Looking into it',
      author: { name: 'Ankit Sharma', role: 'agent' },
    })
    expect(res.ticket).toMatchObject({ status: 'in_progress', assignedAgent: { id: staff.id } })
    expect(res.ticket.firstResponseAt).not.toBeNull()

    const thread = (await ok(customer.agent, ops.messages, { ticketId: ticket.id })).messages
    expect(thread.map((m: { body: string }) => m.body)).toEqual(['Looking into it'])
  })

  it('another agent cannot reply to a ticket assigned to someone else; an admin can', async () => {
    const { ticket } = await customerWithTicket()
    const first = await signedIn('agent')
    await ok(first.agent, ops.sendMessage, { ticketId: ticket.id, input: { body: 'Mine' } })
    const second = await signedIn('agent')
    expect(
      (await gql(second.agent, ops.sendMessage, { ticketId: ticket.id, input: { body: 'Me too' } }))
        .code,
    ).toBe('NOT_ASSIGNED')
    const admin = await signedIn('admin')
    await ok(admin.agent, ops.sendMessage, { ticketId: ticket.id, input: { body: 'Admin here' } })
  })

  it('a customer reply reopens a resolved ticket', async () => {
    const { customer, ticket } = await customerWithTicket()
    const admin = await signedIn('admin')
    await ok(admin.agent, ops.updateTicket, { id: ticket.id, input: { status: 'resolved' } })
    const res = (
      await ok(customer.agent, ops.sendMessage, {
        ticketId: ticket.id,
        input: { body: 'It broke again' },
      })
    ).sendMessage
    expect(res.ticket.status).toBe('open')
    expect(res.ticket.resolvedAt).toBeNull()
  })

  it('nobody can write in a closed ticket', async () => {
    const { customer, ticket } = await customerWithTicket()
    const admin = await signedIn('admin')
    await ok(admin.agent, ops.updateTicket, { id: ticket.id, input: { status: 'closed' } })
    expect(
      (
        await gql(customer.agent, ops.sendMessage, {
          ticketId: ticket.id,
          input: { body: 'Hello?' },
        })
      ).code,
    ).toBe('TICKET_CLOSED')
    expect(
      (await gql(admin.agent, ops.updateTicket, { id: ticket.id, input: { status: 'open' } })).code,
    ).toBe('TICKET_CLOSED')
  })

  it('rejects empty and oversized messages', async () => {
    const { customer, ticket } = await customerWithTicket()
    expect(
      (await gql(customer.agent, ops.sendMessage, { ticketId: ticket.id, input: { body: '   ' } }))
        .code,
    ).toBe('BAD_USER_INPUT')
    expect(
      (
        await gql(customer.agent, ops.sendMessage, {
          ticketId: ticket.id,
          input: { body: 'x'.repeat(5001) },
        })
      ).code,
    ).toBe('BAD_USER_INPUT')
  })
})

describe('staff updates', () => {
  it('an agent can take an unassigned ticket but not reassign it to someone else', async () => {
    const { ticket } = await customerWithTicket()
    const a = await signedIn('agent')
    const b = await signedIn('agent')
    expect(
      (await gql(a.agent, ops.updateTicket, { id: ticket.id, input: { assignedAgentId: b.id } }))
        .code,
    ).toBe('FORBIDDEN')
    const took = (
      await ok(a.agent, ops.updateTicket, { id: ticket.id, input: { assignedAgentId: a.id } })
    ).updateTicket
    expect(took.assignedAgent.id).toBe(a.id)
    expect(
      (await gql(b.agent, ops.updateTicket, { id: ticket.id, input: { assignedAgentId: b.id } }))
        .code,
    ).toBe('NOT_ASSIGNED')
  })

  it('an admin can reassign, but only to an active agent; null unassigns', async () => {
    const { customer, ticket } = await customerWithTicket()
    const admin = await signedIn('admin')
    const agent = await signedIn('agent')
    expect(
      (
        await gql(admin.agent, ops.updateTicket, {
          id: ticket.id,
          input: { assignedAgentId: customer.id },
        })
      ).code,
    ).toBe('BAD_REQUEST')
    const res = (
      await ok(admin.agent, ops.updateTicket, {
        id: ticket.id,
        input: { assignedAgentId: agent.id },
      })
    ).updateTicket
    expect(res.assignedAgent.id).toBe(agent.id)
    const cleared = (
      await ok(admin.agent, ops.updateTicket, { id: ticket.id, input: { assignedAgentId: null } })
    ).updateTicket
    expect(cleared.assignedAgent).toBeNull()
  })

  it('records status and priority changes in the activity log', async () => {
    const { customer, ticket } = await customerWithTicket()
    const admin = await signedIn('admin')
    await ok(admin.agent, ops.updateTicket, {
      id: ticket.id,
      input: { status: 'in_progress', priority: 'low' },
    })
    const actions = (await ok(customer.agent, ops.activity, { ticketId: ticket.id })).activity.map(
      (a: { action: string }) => a.action,
    )
    expect(actions[0]).toBe('created')
    expect(actions.slice(1).sort()).toEqual(['priority_changed', 'status_changed'])
  })

  it('rejects a stale update (someone else changed the ticket first)', async () => {
    const { ticket } = await customerWithTicket()
    const admin = await signedIn('admin')
    await ok(admin.agent, ops.updateTicket, { id: ticket.id, input: { priority: 'low' } })
    const stale = await gql(admin.agent, ops.updateTicket, {
      id: ticket.id,
      input: { status: 'resolved', expectedUpdatedAt: ticket.updatedAt },
    })
    expect(stale.code).toBe('STALE_TICKET')
  })

  it('lists active agents for staff only', async () => {
    const agent = await signedIn('agent', 'Kavya Reddy')
    const customer = await signedIn('customer')
    expect((await ok(agent.agent, ops.agents)).agents).toEqual([
      { id: agent.id, name: 'Kavya Reddy', role: 'agent' },
    ])
    expect((await gql(customer.agent, ops.agents)).code).toBe('FORBIDDEN')
  })
})

describe('listing', () => {
  it('staff can filter by status and search by subject; counts ignore the status filter; page size is capped', async () => {
    await customerWithTicket()
    const { customer } = await customerWithTicket()
    await ok(customer.agent, ops.createTicket, {
      input: { ...validTicket, subject: 'Refund for invoice 42', category: 'billing' },
    })
    const admin = await signedIn('admin')

    const search = (await ok(admin.agent, ops.tickets, { filter: { q: 'refund' } })).tickets
    expect(search.data.map((t: { subject: string }) => t.subject)).toEqual([
      'Refund for invoice 42',
    ])

    const billing = (
      await ok(admin.agent, ops.tickets, { filter: { category: 'billing', status: 'open' } })
    ).tickets
    expect(billing.meta.total).toBe(1)
    expect(billing.counts).toEqual({ open: 1, in_progress: 0, resolved: 0, closed: 0 })

    expect((await gql(admin.agent, ops.tickets, { pageSize: 1000 })).code).toBe('BAD_USER_INPUT')
    const page = (await ok(admin.agent, ops.tickets, { pageSize: 2, page: 2 })).tickets
    expect(page.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 })
  })
})
