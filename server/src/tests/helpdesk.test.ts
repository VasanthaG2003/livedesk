import { describe, expect, it } from 'vitest'
import { useTestDatabase } from './db'
import { customerWithTicket, gql, ok, signedIn, validTicket } from './fixtures'
import { ops } from './ops'

useTestDatabase()

async function resolvedTicket() {
  const { customer, ticket } = await customerWithTicket()
  const admin = await signedIn('admin')
  await ok(admin.agent, ops.updateTicket, { id: ticket.id, input: { status: 'resolved' } })
  return { customer, admin, id: ticket.id }
}

describe('first-response SLA', () => {
  it('sets a due date from the priority and moves it if the priority changes before a reply', async () => {
    const customer = await signedIn('customer')
    const t = (
      await ok(customer.agent, ops.createTicket, { input: { ...validTicket, priority: 'high' } })
    ).createTicket
    expect((Date.parse(t.firstResponseDueAt) - Date.parse(t.createdAt)) / 60_000).toBeCloseTo(60, 0)
    const admin = await signedIn('admin')
    const low = (await ok(admin.agent, ops.updateTicket, { id: t.id, input: { priority: 'low' } }))
      .updateTicket
    expect((Date.parse(low.firstResponseDueAt) - Date.parse(t.createdAt)) / 60_000).toBeCloseTo(
      24 * 60,
      0,
    )
  })

  it('internal notes do not count as a first response', async () => {
    const { ticket } = await customerWithTicket()
    const agent = await signedIn('agent')
    const note = (
      await ok(agent.agent, ops.sendMessage, {
        ticketId: ticket.id,
        input: { body: 'checking logs', internal: true },
      })
    ).sendMessage
    expect(note.ticket).toMatchObject({
      firstResponseAt: null,
      status: 'open',
      assignedAgent: null,
    })
  })

  it('customers cannot post internal notes, and never see them', async () => {
    const { customer, ticket } = await customerWithTicket()
    expect(
      (
        await gql(customer.agent, ops.sendMessage, {
          ticketId: ticket.id,
          input: { body: 'sneaky', internal: true },
        })
      ).code,
    ).toBe('FORBIDDEN')
    const agent = await signedIn('agent')
    await ok(agent.agent, ops.sendMessage, {
      ticketId: ticket.id,
      input: { body: 'staff only', internal: true },
    })
    expect((await ok(customer.agent, ops.messages, { ticketId: ticket.id })).messages).toHaveLength(
      0,
    )
    expect((await ok(agent.agent, ops.messages, { ticketId: ticket.id })).messages).toHaveLength(1)
  })
})

describe('customer ratings', () => {
  it('lets the customer rate a resolved ticket exactly once', async () => {
    const { customer, id } = await resolvedTicket()
    const res = (
      await ok(customer.agent, ops.rate, {
        ticketId: id,
        input: { score: 5, comment: 'Great help' },
      })
    ).rateTicket
    expect(res.rating).toMatchObject({ score: 5, comment: 'Great help' })
    expect((await gql(customer.agent, ops.rate, { ticketId: id, input: { score: 1 } })).code).toBe(
      'ALREADY_RATED',
    )
    const activity = (await ok(customer.agent, ops.activity, { ticketId: id })).activity
    expect(activity.at(-1)).toMatchObject({ action: 'rated', newValue: '5' })
  })

  it('rejects ratings on open tickets, from staff, from other customers, and out of range', async () => {
    const { customer, ticket } = await customerWithTicket()
    expect(
      (await gql(customer.agent, ops.rate, { ticketId: ticket.id, input: { score: 4 } })).code,
    ).toBe('NOT_RESOLVED')
    const { admin, id } = await resolvedTicket()
    expect((await gql(admin.agent, ops.rate, { ticketId: id, input: { score: 5 } })).code).toBe(
      'FORBIDDEN',
    )
    const stranger = await signedIn('customer')
    expect((await gql(stranger.agent, ops.rate, { ticketId: id, input: { score: 5 } })).code).toBe(
      'NOT_FOUND',
    )
    const { customer: owner, id: id2 } = await resolvedTicket()
    expect((await gql(owner.agent, ops.rate, { ticketId: id2, input: { score: 6 } })).code).toBe(
      'BAD_USER_INPUT',
    )
  })
})

describe('saved replies', () => {
  it('agents get team replies plus their own; personal replies stay private', async () => {
    const admin = await signedIn('admin')
    const ankit = await signedIn('agent')
    const kavya = await signedIn('agent')
    const team = (
      await ok(admin.agent, ops.createSavedReply, {
        input: { title: 'Greeting', body: 'Hi {{customer.firstName}}' },
      })
    ).createSavedReply
    expect(team.scope).toBe('team')
    const mine = (
      await ok(ankit.agent, ops.createSavedReply, {
        input: { title: 'My sign-off', body: 'Cheers, Ankit' },
      })
    ).createSavedReply
    expect(mine.scope).toBe('personal')

    const titles = async (a: typeof ankit) =>
      (await ok(a.agent, ops.savedReplies)).savedReplies
        .map((r: { title: string }) => r.title)
        .sort()
    expect(await titles(ankit)).toEqual(['Greeting', 'My sign-off'])
    expect(await titles(kavya)).toEqual(['Greeting'])

    expect((await gql(kavya.agent, ops.deleteSavedReply, { id: mine.id })).code).toBe('NOT_FOUND')
    expect((await gql(ankit.agent, ops.deleteSavedReply, { id: team.id })).code).toBe('FORBIDDEN')
    await ok(ankit.agent, ops.deleteSavedReply, { id: mine.id })
  })

  it('customers cannot see saved replies', async () => {
    const customer = await signedIn('customer')
    expect((await gql(customer.agent, ops.savedReplies)).code).toBe('FORBIDDEN')
  })
})
