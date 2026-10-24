import request from 'supertest'
import type { Role } from '@livedesk/shared'
import { UserModel } from '../models/user.model'
import { hashPassword } from '../services/auth.service'
import { buildTestServer } from './helpers'
import { ops } from './ops'

export const { app, httpServer } = await buildTestServer()
export const PASSWORD = 'correct-horse-battery'

type Agent = ReturnType<typeof request.agent> | ReturnType<typeof request>

export interface GqlResult<T = Record<string, any>> {
  status: number
  data: T | null
  errors?: { message: string; extensions?: { code?: string; fields?: Record<string, string> } }[]
  /** The first error's code, e.g. "FORBIDDEN". */
  code?: string
  headers: Record<string, string | string[] | undefined>
}

/** Sends one GraphQL operation (with the agent's cookies) and returns the parsed result. */
export async function gql<T = Record<string, any>>(
  agent: Agent,
  query: string,
  variables?: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<GqlResult<T>> {
  let req = (agent as ReturnType<typeof request>)
    .post('/graphql')
    .set('Content-Type', 'application/json')
  for (const [k, v] of Object.entries(headers)) req = req.set(k, v)
  const res = await req.send({ query, variables })
  return {
    status: res.status,
    data: res.body.data ?? null,
    errors: res.body.errors,
    code: res.body.errors?.[0]?.extensions?.code,
    headers: res.headers,
  }
}

/** Like gql, but fails the test on any GraphQL error and returns data. */
export async function ok<T = Record<string, any>>(
  agent: Agent,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const r = await gql<T>(agent, query, variables)
  if (r.errors?.length) throw new Error(`GraphQL error: ${JSON.stringify(r.errors)}`)
  return r.data as T
}

let counter = 0
let cachedHash: string | undefined

/** Creates a user directly in the database and returns a signed-in Supertest agent. */
export async function signedIn(role: Role, name = `${role} ${++counter}`) {
  cachedHash ??= await hashPassword(PASSWORD)
  const email = `${role}${++counter}@test.dev`
  const user = await UserModel.create({ name, email, role, passwordHash: cachedHash })
  const agent = request.agent(app)
  await ok(agent, ops.login, { input: { email, password: PASSWORD } })
  return { agent, user, id: user._id.toString(), email }
}

export const validTicket = {
  subject: 'App not loading on mobile',
  description: 'Blank screen after the splash screen on Android.',
  category: 'bug',
  priority: 'high',
}

/** A customer with one new ticket. */
export async function customerWithTicket() {
  const customer = await signedIn('customer')
  const data = await ok<{ createTicket: { id: string; updatedAt: string } }>(
    customer.agent,
    ops.createTicket,
    { input: validTicket },
  )
  return { customer, ticket: data.createTicket }
}
