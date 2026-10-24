/**
 * One executable schema, served over HTTP (queries, mutations) and over
 * WebSocket via graphql-ws (subscriptions). Enum values match the stored
 * values, so no mapping layer is needed. Dates are ISO-8601 strings.
 *
 * Input types double as an allow-list: a client can't send `role`,
 * `customerId` or any other field that isn't declared here — GraphQL
 * validation rejects the whole operation before a resolver runs.
 */
export const typeDefs = /* GraphQL */ `
  enum Role {
    customer
    agent
    admin
  }
  enum TicketStatus {
    open
    in_progress
    resolved
    closed
  }
  enum TicketPriority {
    low
    medium
    high
  }
  enum TicketCategory {
    bug
    billing
    account
    feature
    performance
    other
  }
  enum MessageSide {
    customer
    staff
  }
  enum ActivityAction {
    created
    status_changed
    priority_changed
    assigned
    unassigned
    replied
    rated
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: Role!
    isActive: Boolean!
    createdAt: String!
  }

  "Just enough to show who someone is next to a ticket or message."
  type UserRef {
    id: ID!
    name: String!
    role: Role!
  }

  "A ticket as it appears in lists, on the board and in live events."
  type TicketSummary {
    id: ID!
    ticketNumber: String!
    subject: String!
    category: TicketCategory!
    priority: TicketPriority!
    status: TicketStatus!
    customer: UserRef!
    assignedAgent: UserRef
    createdAt: String!
    updatedAt: String!
    firstResponseDueAt: String
    firstResponseAt: String
    lastMessageAt: String
    lastMessageFrom: MessageSide
    customerReadAt: String
    staffReadAt: String
  }

  type Rating {
    score: Int!
    comment: String
    ratedAt: String!
  }

  type Ticket {
    id: ID!
    ticketNumber: String!
    subject: String!
    description: String!
    category: TicketCategory!
    priority: TicketPriority!
    status: TicketStatus!
    customer: UserRef!
    assignedAgent: UserRef
    createdAt: String!
    updatedAt: String!
    firstResponseDueAt: String
    firstResponseAt: String
    lastMessageAt: String
    lastMessageFrom: MessageSide
    customerReadAt: String
    staffReadAt: String
    resolvedAt: String
    closedAt: String
    rating: Rating
  }

  type Message {
    id: ID!
    ticketId: ID!
    author: UserRef!
    body: String!
    "Staff-only note. Never returned or pushed to customers."
    internal: Boolean!
    createdAt: String!
  }

  type Activity {
    id: ID!
    ticketId: ID!
    actor: UserRef!
    action: ActivityAction!
    previousValue: String
    newValue: String
    createdAt: String!
  }

  type FeedItem {
    id: ID!
    ticketId: ID!
    ticketNumber: String!
    ticketSubject: String!
    actor: UserRef!
    action: ActivityAction!
    previousValue: String
    newValue: String
    createdAt: String!
  }

  type PageMeta {
    page: Int!
    pageSize: Int!
    total: Int!
    totalPages: Int!
  }

  type StatusCounts {
    open: Int!
    in_progress: Int!
    resolved: Int!
    closed: Int!
  }

  type CategoryCounts {
    bug: Int!
    billing: Int!
    account: Int!
    feature: Int!
    performance: Int!
    other: Int!
  }

  type TicketPage {
    data: [TicketSummary!]!
    meta: PageMeta!
    "Totals per status for the same filters, ignoring the status filter."
    counts: StatusCounts!
  }

  type SendMessageResult {
    message: Message!
    ticket: Ticket!
  }

  type SavedReply {
    id: ID!
    title: String!
    body: String!
    scope: String!
    owner: UserRef!
    createdAt: String!
  }

  type UserListItem {
    id: ID!
    name: String!
    email: String!
    role: Role!
    isActive: Boolean!
    createdAt: String!
    totalTickets: Int!
    openTickets: Int!
    lastActivityAt: String
  }

  type UserPage {
    data: [UserListItem!]!
    meta: PageMeta!
  }

  type AuditEntry {
    id: ID!
    actor: UserRef!
    action: String!
    target: UserRef
    createdAt: String!
  }

  "A metric for the selected period and the one before it."
  type PeriodValue {
    current: Float
    previous: Float
  }

  type DailyCount {
    day: String!
    created: Int!
    resolved: Int!
  }

  type Csat {
    average: Float
    count: Int!
  }

  type AgentStatsRow {
    agent: UserRef!
    online: Boolean!
    openAssigned: Int!
    resolved: Int!
    avgFirstResponseMs: Float
    csat: Float
    csatCount: Int!
  }

  type StatsRange {
    days: Int!
    from: String!
    to: String!
    tz: String!
  }

  type Team {
    agentsOnline: Int!
    totalAgents: Int!
  }

  type AdminStats {
    range: StatsRange!
    byStatus: StatusCounts!
    created: PeriodValue!
    resolved: PeriodValue!
    avgFirstResponseMs: PeriodValue!
    avgResolutionMs: PeriodValue!
    slaMetPct: PeriodValue!
    csat: Csat!
    trend: [DailyCount!]!
    byCategory: CategoryCounts!
    agents: [AgentStatsRow!]!
    team: Team!
  }

  type MyStats {
    range: StatsRange!
    openAssigned: Int!
    resolved: PeriodValue!
    avgFirstResponseMs: PeriodValue!
    slaMetPct: PeriodValue!
    csat: Csat!
    byCategory: CategoryCounts!
  }

  type TriageSuggestion {
    category: TicketCategory!
    priority: TicketPriority!
    reason: String!
  }

  type AiStatus {
    enabled: Boolean!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
  }
  input LoginInput {
    email: String!
    password: String!
  }
  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }
  input CreateTicketInput {
    subject: String!
    description: String!
    category: TicketCategory!
    priority: TicketPriority!
  }
  input UpdateTicketInput {
    status: TicketStatus
    priority: TicketPriority
    "An agent id to assign, or null to unassign."
    assignedAgentId: ID
    "The ticket's updatedAt as last seen; a mismatch fails with STALE_TICKET."
    expectedUpdatedAt: String
  }
  input SendMessageInput {
    body: String!
    internal: Boolean
  }
  input RateTicketInput {
    score: Int!
    comment: String
  }
  input SavedReplyInput {
    title: String!
    body: String!
  }
  input TicketFilter {
    q: String
    status: TicketStatus
    category: TicketCategory
    priority: TicketPriority
    "me, unassigned or an agent id (staff only)."
    assignee: String
    "Staff only."
    customerId: ID
  }
  input TriageInput {
    subject: String!
    description: String!
  }

  type Query {
    "The signed-in user, or null."
    me: User
    tickets(filter: TicketFilter, page: Int, pageSize: Int): TicketPage!
    ticket(id: ID!): Ticket!
    messages(ticketId: ID!): [Message!]!
    activity(ticketId: ID!): [Activity!]!
    agents: [UserRef!]!
    savedReplies: [SavedReply!]!
    customers(q: String, page: Int): UserPage!
    users(role: Role!, q: String, page: Int): UserPage!
    adminStats(days: Int, tz: String): AdminStats!
    myStats(days: Int, tz: String): MyStats!
    auditLog: [AuditEntry!]!
    activityFeed: [FeedItem!]!
    aiStatus: AiStatus!
  }

  type Mutation {
    register(input: RegisterInput!): User!
    login(input: LoginInput!): User!
    refreshSession: User!
    logout: Boolean!
    changePassword(input: ChangePasswordInput!): Boolean!
    "A 60-second token for opening the subscriptions WebSocket (sent in connectionParams)."
    subscriptionToken: String!

    createTicket(input: CreateTicketInput!): Ticket!
    updateTicket(id: ID!, input: UpdateTicketInput!): Ticket!
    sendMessage(ticketId: ID!, input: SendMessageInput!): SendMessageResult!
    markRead(ticketId: ID!): TicketSummary!
    rateTicket(ticketId: ID!, input: RateTicketInput!): Ticket!
    setTyping(ticketId: ID!, typing: Boolean!): Boolean!

    createSavedReply(input: SavedReplyInput!): SavedReply!
    deleteSavedReply(id: ID!): Boolean!
    setUserActive(id: ID!, isActive: Boolean!): User!
    createAgent(input: RegisterInput!): User!

    triageTicket(input: TriageInput!): TriageSuggestion!
    draftReply(ticketId: ID!): String!
  }

  enum TicketEventType {
    created
    updated
    assigned
    status_changed
    rated
    message
  }

  type TicketEvent {
    type: TicketEventType!
    ticket: TicketSummary!
    message: Message
    from: TicketStatus
    to: TicketStatus
    assignedTo: UserRef
    by: UserRef
  }

  enum NotificationKind {
    created
    message
    assigned
    status
  }

  type Notification {
    id: ID!
    kind: NotificationKind!
    ticketId: ID!
    ticketNumber: String!
    title: String!
    body: String!
    createdAt: String!
  }

  enum RoomEventType {
    typing
    viewers
  }

  type RoomEvent {
    type: RoomEventType!
    user: UserRef
    typing: Boolean
    viewers: [UserRef!]
  }

  type Subscription {
    "Every ticket change the user may see: own tickets for customers, all tickets for staff."
    ticketEvents: TicketEvent!
    "Live notifications for the signed-in user."
    notifications: Notification!
    "Viewers and typing for one ticket. Subscribing counts as viewing it."
    ticketRoom(ticketId: ID!): RoomEvent!
    "Ids of agents with a live connection (staff only)."
    agentPresence: [ID!]!
  }
`
