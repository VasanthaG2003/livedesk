// Every GraphQL operation the client sends. Named, so they're easy to spot in
// logs and to route in tests. Fields match the types in @livedesk/shared.

const USER = 'id name email role isActive createdAt'
const REF = 'id name role'
const SUMMARY = `id ticketNumber subject category priority status createdAt updatedAt
  customer { ${REF} } assignedAgent { ${REF} }
  firstResponseDueAt firstResponseAt lastMessageAt lastMessageFrom customerReadAt staffReadAt`
const TICKET = `${SUMMARY} description resolvedAt closedAt rating { score comment ratedAt }`
const MESSAGE = `id ticketId body internal createdAt author { ${REF} }`
const META = 'meta { page pageSize total totalPages }'
const PERIOD = 'current previous'
const CATEGORIES = 'bug billing account feature performance other'

export const Q = {
  me: `query Me { me { ${USER} } }`,
  tickets: `query Tickets($filter: TicketFilter, $page: Int, $pageSize: Int) {
    tickets(filter: $filter, page: $page, pageSize: $pageSize) {
      data { ${SUMMARY} } ${META} counts { open in_progress resolved closed } } }`,
  ticket: `query Ticket($id: ID!) { ticket(id: $id) { ${TICKET} } }`,
  messages: `query Messages($ticketId: ID!) { messages(ticketId: $ticketId) { ${MESSAGE} } }`,
  activity: `query Activity($ticketId: ID!) { activity(ticketId: $ticketId) {
    id ticketId action previousValue newValue createdAt actor { ${REF} } } }`,
  agents: `query Agents { agents { ${REF} } }`,
  savedReplies: `query SavedReplies { savedReplies { id title body scope createdAt owner { ${REF} } } }`,
  users: `query Users($role: Role!, $q: String, $page: Int) { users(role: $role, q: $q, page: $page) {
    data { ${USER} totalTickets openTickets lastActivityAt } ${META} } }`,
  customers: `query Customers($q: String, $page: Int) { customers(q: $q, page: $page) {
    data { ${USER} totalTickets openTickets lastActivityAt } ${META} } }`,
  adminStats: `query AdminStats($days: Int, $tz: String) { adminStats(days: $days, tz: $tz) {
    range { days from to tz } byStatus { open in_progress resolved closed }
    created { ${PERIOD} } resolved { ${PERIOD} } avgFirstResponseMs { ${PERIOD} }
    avgResolutionMs { ${PERIOD} } slaMetPct { ${PERIOD} } csat { average count }
    trend { day created resolved } byCategory { ${CATEGORIES} }
    agents { agent { ${REF} } online openAssigned resolved avgFirstResponseMs csat csatCount }
    team { agentsOnline totalAgents } } }`,
  myStats: `query MyStats($days: Int, $tz: String) { myStats(days: $days, tz: $tz) {
    range { days from to tz } openAssigned resolved { ${PERIOD} } avgFirstResponseMs { ${PERIOD} }
    slaMetPct { ${PERIOD} } csat { average count } byCategory { ${CATEGORIES} } } }`,
  auditLog: `query AuditLog { auditLog { id action createdAt actor { ${REF} } target { ${REF} } } }`,
  activityFeed: `query ActivityFeed { activityFeed {
    id ticketId ticketNumber ticketSubject action previousValue newValue createdAt actor { ${REF} } } }`,
  aiStatus: `query AiStatus { aiStatus { enabled } }`,
}

export const M = {
  register: `mutation Register($input: RegisterInput!) { register(input: $input) { ${USER} } }`,
  login: `mutation Login($input: LoginInput!) { login(input: $input) { ${USER} } }`,
  logout: `mutation Logout { logout }`,
  changePassword: `mutation ChangePassword($input: ChangePasswordInput!) { changePassword(input: $input) }`,
  subscriptionToken: `mutation SubscriptionToken { subscriptionToken }`,
  createTicket: `mutation CreateTicket($input: CreateTicketInput!) { createTicket(input: $input) { ${TICKET} } }`,
  updateTicket: `mutation UpdateTicket($id: ID!, $input: UpdateTicketInput!) { updateTicket(id: $id, input: $input) { ${TICKET} } }`,
  sendMessage: `mutation SendMessage($ticketId: ID!, $input: SendMessageInput!) {
    sendMessage(ticketId: $ticketId, input: $input) { message { ${MESSAGE} } ticket { ${TICKET} } } }`,
  markRead: `mutation MarkRead($ticketId: ID!) { markRead(ticketId: $ticketId) { ${SUMMARY} } }`,
  rateTicket: `mutation RateTicket($ticketId: ID!, $input: RateTicketInput!) { rateTicket(ticketId: $ticketId, input: $input) { ${TICKET} } }`,
  setTyping: `mutation SetTyping($ticketId: ID!, $typing: Boolean!) { setTyping(ticketId: $ticketId, typing: $typing) }`,
  createSavedReply: `mutation CreateSavedReply($input: SavedReplyInput!) { createSavedReply(input: $input) { id title body scope createdAt owner { ${REF} } } }`,
  deleteSavedReply: `mutation DeleteSavedReply($id: ID!) { deleteSavedReply(id: $id) }`,
  setUserActive: `mutation SetUserActive($id: ID!, $isActive: Boolean!) { setUserActive(id: $id, isActive: $isActive) { ${USER} } }`,
  createAgent: `mutation CreateAgent($input: RegisterInput!) { createAgent(input: $input) { ${USER} } }`,
  triageTicket: `mutation TriageTicket($input: TriageInput!) { triageTicket(input: $input) { category priority reason } }`,
  draftReply: `mutation DraftReply($ticketId: ID!) { draftReply(ticketId: $ticketId) }`,
}

export const S = {
  ticketEvents: `subscription TicketEvents { ticketEvents {
    type from to ticket { ${SUMMARY} } message { ${MESSAGE} } } }`,
  notifications: `subscription Notifications { notifications { id kind ticketId ticketNumber title body createdAt } }`,
  ticketRoom: `subscription TicketRoom($ticketId: ID!) { ticketRoom(ticketId: $ticketId) {
    type typing user { ${REF} } viewers { ${REF} } } }`,
  agentPresence: `subscription AgentPresence { agentPresence }`,
}
