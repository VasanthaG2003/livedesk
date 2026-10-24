// GraphQL operations used across the tests.

const SUMMARY = `id ticketNumber subject category priority status createdAt updatedAt
  customer { id name role } assignedAgent { id name role }
  firstResponseDueAt firstResponseAt lastMessageAt lastMessageFrom customerReadAt staffReadAt`
const TICKET = `${SUMMARY} description resolvedAt closedAt rating { score comment ratedAt }`
const USER = 'id name email role isActive createdAt'

export const ops = {
  register: `mutation($input: RegisterInput!) { register(input: $input) { ${USER} } }`,
  login: `mutation($input: LoginInput!) { login(input: $input) { ${USER} } }`,
  refresh: `mutation { refreshSession { ${USER} } }`,
  logout: `mutation { logout }`,
  me: `query { me { ${USER} } }`,
  changePassword: `mutation($input: ChangePasswordInput!) { changePassword(input: $input) }`,
  subscriptionToken: `mutation { subscriptionToken }`,

  createTicket: `mutation($input: CreateTicketInput!) { createTicket(input: $input) { ${TICKET} } }`,
  updateTicket: `mutation($id: ID!, $input: UpdateTicketInput!) { updateTicket(id: $id, input: $input) { ${TICKET} } }`,
  ticket: `query($id: ID!) { ticket(id: $id) { ${TICKET} } }`,
  tickets: `query($filter: TicketFilter, $page: Int, $pageSize: Int) {
    tickets(filter: $filter, page: $page, pageSize: $pageSize) {
      data { ${SUMMARY} } meta { page pageSize total totalPages } counts { open in_progress resolved closed } } }`,
  messages: `query($ticketId: ID!) { messages(ticketId: $ticketId) { id body internal author { id name role } } }`,
  activity: `query($ticketId: ID!) { activity(ticketId: $ticketId) { action previousValue newValue actor { name } } }`,
  sendMessage: `mutation($ticketId: ID!, $input: SendMessageInput!) {
    sendMessage(ticketId: $ticketId, input: $input) { message { id body internal author { id name role } } ticket { ${TICKET} } } }`,
  markRead: `mutation($ticketId: ID!) { markRead(ticketId: $ticketId) { id customerReadAt staffReadAt } }`,
  rate: `mutation($ticketId: ID!, $input: RateTicketInput!) { rateTicket(ticketId: $ticketId, input: $input) { id rating { score comment } } }`,
  setTyping: `mutation($ticketId: ID!, $typing: Boolean!) { setTyping(ticketId: $ticketId, typing: $typing) }`,
  agents: `query { agents { id name role } }`,
  savedReplies: `query { savedReplies { id title scope } }`,
  createSavedReply: `mutation($input: SavedReplyInput!) { createSavedReply(input: $input) { id title scope } }`,
  deleteSavedReply: `mutation($id: ID!) { deleteSavedReply(id: $id) }`,

  adminStats: `query($days: Int, $tz: String) { adminStats(days: $days, tz: $tz) {
    range { tz } created { current previous } resolved { current previous }
    avgFirstResponseMs { current } avgResolutionMs { current } slaMetPct { current }
    csat { average count } trend { day created resolved } byCategory { bug billing account } } }`,
  myStats: `query($days: Int) { myStats(days: $days) { openAssigned resolved { current } } }`,
  users: `query($role: Role!, $q: String) { users(role: $role, q: $q) {
    data { id name totalTickets openTickets isActive } meta { total } } }`,
  customers: `query { customers { data { id name } } }`,
  setUserActive: `mutation($id: ID!, $isActive: Boolean!) { setUserActive(id: $id, isActive: $isActive) { id isActive } }`,
  createAgent: `mutation($input: RegisterInput!) { createAgent(input: $input) { ${USER} } }`,
  auditLog: `query { auditLog { action actor { name } target { name } } }`,

  aiStatus: `query { aiStatus { enabled } }`,
  triage: `mutation($input: TriageInput!) { triageTicket(input: $input) { category priority reason } }`,
  draftReply: `mutation($ticketId: ID!) { draftReply(ticketId: $ticketId) }`,
}
