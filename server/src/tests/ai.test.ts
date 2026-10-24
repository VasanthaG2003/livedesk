import { afterEach, describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { configureAi, type AiClient } from '../services/ai.service'
import { useTestDatabase } from './db'
import { customerWithTicket, gql, ok, signedIn } from './fixtures'
import { testEnv } from './helpers'
import { ops } from './ops'

useTestDatabase()

/** A fake Claude client: records requests, returns canned responses. No network, no cost. */
function fakeClient(responses: { parse?: unknown; create?: unknown; error?: Error }) {
  const parse = vi.fn(async (_params: unknown) => {
    if (responses.error) throw responses.error
    return responses.parse
  })
  const create = vi.fn(async (_params: unknown) => {
    if (responses.error) throw responses.error
    return responses.create
  })
  configureAi(testEnv, { beta: { messages: { parse, create } } } as unknown as AiClient)
  return { parse, create }
}

afterEach(() => configureAi(testEnv, null))

const triageInput = {
  subject: 'Charged twice for October',
  description: 'I see two identical charges on my card.',
}

describe('AI assist', () => {
  it('is off without an API key, and says so clearly', async () => {
    configureAi(testEnv, null)
    const customer = await signedIn('customer')
    expect((await ok(customer.agent, ops.aiStatus)).aiStatus).toEqual({ enabled: false })
    expect((await gql(customer.agent, ops.triage, { input: triageInput })).code).toBe('AI_DISABLED')
  })

  it('triage returns a validated suggestion and sends the ticket as delimited data, with fallbacks on', async () => {
    const { parse } = fakeClient({
      parse: {
        stop_reason: 'end_turn',
        parsed_output: {
          category: 'billing',
          priority: 'high',
          reason: 'Looks like a duplicate charge.',
        },
      },
    })
    const customer = await signedIn('customer')
    expect((await ok(customer.agent, ops.triage, { input: triageInput })).triageTicket).toEqual({
      category: 'billing',
      priority: 'high',
      reason: 'Looks like a duplicate charge.',
    })
    const params = parse.mock.calls[0]![0] as Record<string, unknown> & {
      messages: { content: string }[]
    }
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    })
    expect(params.messages[0]!.content).toContain('<ticket>')
  })

  it('reports a refusal as declined, and rate limits as busy', async () => {
    fakeClient({ parse: { stop_reason: 'refusal', parsed_output: null } })
    const customer = await signedIn('customer')
    expect((await gql(customer.agent, ops.triage, { input: triageInput })).code).toBe('AI_DECLINED')
    fakeClient({
      error: new Anthropic.RateLimitError(429, undefined, 'rate limited', new Headers()),
    })
    expect((await gql(customer.agent, ops.triage, { input: triageInput })).code).toBe('AI_BUSY')
  })

  it('drafts a reply for staff with conversation context, including internal notes as context', async () => {
    const { create } = fakeClient({
      create: {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hi Vasantha, sorry about that…' }],
      },
    })
    const { customer, ticket } = await customerWithTicket()
    await ok(customer.agent, ops.sendMessage, {
      ticketId: ticket.id,
      input: { body: 'Any update?' },
    })
    const agent = await signedIn('agent', 'Ankit Sharma')
    await ok(agent.agent, ops.sendMessage, {
      ticketId: ticket.id,
      input: { body: 'logs show a CDN error', internal: true },
    })

    expect((await ok(agent.agent, ops.draftReply, { ticketId: ticket.id })).draftReply).toBe(
      'Hi Vasantha, sorry about that…',
    )
    const prompt = (create.mock.calls[0]![0] as { messages: { content: string }[] }).messages[0]!
      .content
    expect(prompt).toContain('Any update?')
    expect(prompt).toContain('INTERNAL NOTE by Ankit Sharma')
  })

  it('drafts are staff-only and respect assignment', async () => {
    fakeClient({ create: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'draft' }] } })
    const { customer, ticket } = await customerWithTicket()
    expect((await gql(customer.agent, ops.draftReply, { ticketId: ticket.id })).code).toBe(
      'FORBIDDEN',
    )
    const owner = await signedIn('agent')
    await ok(owner.agent, ops.sendMessage, { ticketId: ticket.id, input: { body: 'mine now' } })
    const other = await signedIn('agent')
    expect((await gql(other.agent, ops.draftReply, { ticketId: ticket.id })).code).toBe(
      'NOT_ASSIGNED',
    )
  })
})
