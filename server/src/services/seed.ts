/**
 * DEVELOPMENT-ONLY demo data. Refuses to run in production (see assertNotProduction).
 * Demo accounts all share DEMO_PASSWORD, which is documented in the README and
 * is never valid in a production database because this never runs there.
 */
import type { Types } from 'mongoose'
import {
  FIRST_RESPONSE_SLA_MINUTES,
  type Role,
  type TicketActivityAction,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@livedesk/shared'
import type { Logger } from '../lib/logger'
import { nextSequence } from '../models/counter.model'
import { TicketActivityModel } from '../models/ticket-activity.model'
import { TicketMessageModel } from '../models/ticket-message.model'
import { TicketModel } from '../models/ticket.model'
import { SavedReplyModel } from '../models/saved-reply.model'
import { UserModel } from '../models/user.model'
import { hashPassword } from './auth.service'

export const DEMO_PASSWORD = 'Demo@12345'

const demoUsers: { key: string; name: string; email: string; role: Role }[] = [
  { key: 'vasantha', name: 'Vasantha G', email: 'customer@livedesk.dev', role: 'customer' },
  { key: 'rohan', name: 'Rohan S', email: 'rohan@livedesk.dev', role: 'customer' },
  { key: 'sneha', name: 'Sneha P', email: 'sneha@livedesk.dev', role: 'customer' },
  { key: 'ankit', name: 'Ankit Sharma', email: 'agent@livedesk.dev', role: 'agent' },
  { key: 'kavya', name: 'Kavya Reddy', email: 'kavya@livedesk.dev', role: 'agent' },
  { key: 'priya', name: 'Priya Nair', email: 'admin@livedesk.dev', role: 'admin' },
]

interface DemoTicket {
  customer: string
  agent?: string
  subject: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  hoursAgo: number
  messages?: { by: string; text: string; hoursAgo: number; internal?: boolean }[]
  /** Leave the latest customer message unread by staff (shows the unread dot). */
  staffUnread?: boolean
  rating?: { score: number; comment?: string }
}

const demoTickets: DemoTicket[] = [
  {
    customer: 'vasantha',
    subject: 'App not loading on mobile',
    category: 'bug',
    priority: 'high',
    status: 'open',
    hoursAgo: 2,
    description:
      'Since this morning the app shows a blank white screen after the splash screen on my Android phone. Clearing the cache did not help.',
  },
  {
    customer: 'vasantha',
    agent: 'ankit',
    subject: 'Need help with billing',
    category: 'billing',
    priority: 'medium',
    status: 'in_progress',
    hoursAgo: 26,
    description:
      'I was charged twice for the October invoice. Please check and refund the duplicate payment.',
    messages: [
      {
        by: 'ankit',
        text: "Hi Vasantha, thanks for reaching out. I can see two charges — I'm checking with our billing team now.",
        hoursAgo: 6,
      },
      {
        by: 'ankit',
        text: 'Confirmed the duplicate charge in the payments dashboard. Refund queued, needs finance approval.',
        hoursAgo: 5.5,
        internal: true,
      },
      { by: 'vasantha', text: 'Thank you! The second charge was on the 3rd.', hoursAgo: 5 },
    ],
    staffUnread: true,
  },
  {
    customer: 'vasantha',
    agent: 'kavya',
    subject: 'Feature request: Dark mode',
    category: 'feature',
    priority: 'low',
    status: 'resolved',
    hoursAgo: 72,
    description: 'Would love a dark mode for late-night work.',
    messages: [
      {
        by: 'kavya',
        text: "Great news — dark mode shipped in today's release. Let us know what you think!",
        hoursAgo: 24,
      },
    ],
  },
  {
    customer: 'vasantha',
    agent: 'ankit',
    subject: 'Account access issue',
    rating: { score: 5, comment: 'Fixed within minutes, thank you!' },
    category: 'account',
    priority: 'medium',
    status: 'closed',
    hoursAgo: 120,
    description: "I can't log in after changing my phone number.",
    messages: [
      {
        by: 'ankit',
        text: "I've updated your number and reset 2FA. You should be able to sign in now.",
        hoursAgo: 100,
      },
    ],
  },
  {
    customer: 'rohan',
    subject: 'Payment failed but money deducted',
    category: 'billing',
    priority: 'medium',
    status: 'open',
    hoursAgo: 3,
    description: 'My card was charged but the order shows as failed.',
  },
  {
    customer: 'rohan',
    agent: 'kavya',
    subject: 'Slow performance on dashboard',
    category: 'performance',
    priority: 'low',
    status: 'in_progress',
    hoursAgo: 30,
    description: 'The dashboard takes over 10 seconds to load in the afternoons.',
    messages: [
      { by: 'kavya', text: 'Thanks Rohan — could you share which browser you use?', hoursAgo: 20 },
    ],
  },
  {
    customer: 'sneha',
    subject: "Can't reset password",
    category: 'account',
    priority: 'high',
    status: 'open',
    hoursAgo: 4,
    description: 'The reset email never arrives. I checked spam too.',
  },
  {
    customer: 'sneha',
    agent: 'ankit',
    subject: 'How do I change my plan?',
    rating: { score: 4 },
    category: 'other',
    priority: 'low',
    status: 'resolved',
    hoursAgo: 50,
    description: 'I want to move from Basic to Pro.',
    messages: [
      {
        by: 'ankit',
        text: "Go to Settings → Plan and pick Pro. I've also added a 7-day trial for you.",
        hoursAgo: 45,
      },
    ],
  },
]

export function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production')
  }
}

interface SeedActivity {
  actorId: Types.ObjectId
  action: TicketActivityAction
  previousValue?: string
  newValue?: string
  createdAt: Date
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000)

/** Inserts demo data into an empty database. Does nothing if any user exists. */
export async function seedDemoData(logger: Logger) {
  assertNotProduction()
  if (await UserModel.exists({})) {
    logger.info('Database already has users; skipping demo seed')
    return
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const users = new Map<string, { _id: Types.ObjectId; name: string }>()
  for (const u of demoUsers) {
    const doc = await UserModel.create({ name: u.name, email: u.email, role: u.role, passwordHash })
    users.set(u.key, doc)
  }
  const user = (key: string) => users.get(key)!

  for (const t of demoTickets) {
    const created = hoursAgo(t.hoursAgo)
    const publicMessages = (t.messages ?? []).filter((m) => !m.internal)
    const lastMessage = publicMessages.at(-1)
    const lastAt = lastMessage ? hoursAgo(lastMessage.hoursAgo) : null
    const lastFrom = lastMessage ? (lastMessage.by === t.customer ? 'customer' : 'staff') : null
    const updated = t.messages?.length
      ? hoursAgo(Math.min(...t.messages.map((m) => m.hoursAgo)))
      : created
    const firstStaff = publicMessages.find((m) => m.by === t.agent)
    const done = t.status === 'resolved' || t.status === 'closed'

    const ticket = await TicketModel.create({
      ticketNumber: `TK-${1000 + (await nextSequence('ticket'))}`,
      subject: t.subject,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      customerId: user(t.customer)._id,
      assignedAgentId: t.agent ? user(t.agent)._id : null,
      firstResponseAt: firstStaff ? hoursAgo(firstStaff.hoursAgo) : null,
      resolvedAt: done ? updated : null,
      closedAt: t.status === 'closed' ? updated : null,
      firstResponseDueAt: new Date(
        created.getTime() + FIRST_RESPONSE_SLA_MINUTES[t.priority] * 60_000,
      ),
      lastMessageAt: lastAt,
      lastMessageFrom: lastFrom,
      customerReadAt: lastAt,
      staffReadAt: t.staffUnread ? null : lastAt,
      rating: t.rating
        ? { score: t.rating.score, comment: t.rating.comment ?? null, ratedAt: updated }
        : null,
    })
    // Backdate timestamps so the demo looks lived-in. Mongoose treats createdAt as
    // immutable, so this seed-only write goes through the raw driver.
    await TicketModel.collection.updateOne(
      { _id: ticket._id },
      { $set: { createdAt: created, updatedAt: updated } },
    )

    const activity: SeedActivity[] = [
      { actorId: user(t.customer)._id, action: 'created', createdAt: created },
    ]
    if (t.agent) {
      activity.push({
        actorId: user(t.agent)._id,
        action: 'assigned',
        newValue: user(t.agent).name,
        createdAt: hoursAgo(t.hoursAgo - 0.5),
      })
    }
    if (t.status !== 'open') {
      activity.push({
        actorId: user(t.agent ?? 'ankit')._id,
        action: 'status_changed',
        previousValue: 'open',
        newValue: t.status,
        createdAt: updated,
      })
    }
    await TicketActivityModel.insertMany(activity.map((a) => ({ ticketId: ticket._id, ...a })))

    for (const m of t.messages ?? []) {
      const msg = await TicketMessageModel.create({
        ticketId: ticket._id,
        authorId: user(m.by)._id,
        body: m.text,
        internal: m.internal ?? false,
      })
      const at = hoursAgo(m.hoursAgo)
      await TicketMessageModel.collection.updateOne(
        { _id: msg._id },
        { $set: { createdAt: at, updatedAt: at } },
      )
    }
  }

  await SavedReplyModel.insertMany([
    {
      title: 'Greeting',
      body: "Hi {{customer.firstName}}, thanks for reaching out! I'm {{agent.firstName}} and I'll be helping you with {{ticket.number}}.",
      scope: 'team',
      ownerId: user('priya')._id,
    },
    {
      title: 'Need more details',
      body: 'Could you share a screenshot, your browser or app version, and the steps that lead to the problem?',
      scope: 'team',
      ownerId: user('priya')._id,
    },
    {
      title: 'Refund processed',
      body: 'Good news, {{customer.firstName}}: your refund has been processed. It usually reaches your account within 5–7 business days.',
      scope: 'team',
      ownerId: user('priya')._id,
    },
    {
      title: 'Closing check-in',
      body: "I'm marking this as resolved. If anything else comes up, just reply here and the ticket will reopen.",
      scope: 'personal',
      ownerId: user('ankit')._id,
    },
  ])

  logger.info(
    { accounts: demoUsers.map((u) => `${u.email} (${u.role})`), password: DEMO_PASSWORD },
    'Seeded development demo data',
  )
}
