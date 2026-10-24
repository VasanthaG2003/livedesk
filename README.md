# LiveDesk

A real-time support helpdesk with separate **customer**, **agent** and **admin** experiences.
Customers raise tickets and chat with support; agents work a live Kanban board; admins see
analytics computed from real data and manage the team. Every change is pushed to the people
allowed to see it over **GraphQL subscriptions**.

## Features

**Customer**: register and sign in · raise a ticket (optional AI category/priority suggestion) ·
track tickets with search, filters and status tabs · chat with support inside each ticket, with
typing indicators, "viewing" presence and "Seen" receipts · live notifications · rate the help
once a ticket is resolved.

**Agent**: Kanban board that updates live, with drag-and-drop (optimistic, rolls back if the
server refuses) · first-response SLA countdowns and Overdue badges · take, release, resolve
tickets · staff-only internal notes · saved replies with placeholders · AI reply drafts ·
personal stats.

**Admin**: dashboard and reports from MongoDB aggregations (tickets created and resolved,
average first-response and resolution time, % of replies within SLA, CSAT, daily trend, per-agent
leaderboard with live online status) · reassign any ticket · create agents · deactivate or
reactivate accounts (signs the user out everywhere at once) · audit log.

## Architecture

```
Browser (React SPA)
 ├─ HTTP   POST /graphql ── queries & mutations ─┐
 └─ WS     /graphql (graphql-ws) ─ subscriptions ─┤
                                                  ▼
            Express 5 + Apollo Server 5   ── one executable schema ──  MongoDB (Mongoose)
            graphql-ws on the same HTTP server, same path
```

- **One schema, two transports.** Apollo Server 5 serves queries and mutations over HTTP on
  Express 5; graphql-ws serves subscriptions over a WebSocket on the same server and path.
- **Thin resolvers, shared services.** Resolvers validate input with Zod schemas shared with the
  client (`shared/`), then call services that hold every business and permission rule.
- **Events after writes.** Services publish to an in-process PubSub only after the database
  write succeeds; subscription resolvers decide who receives each event.

### Real-time authorisation

Subscriptions do **not** run the query resolvers' checks for pushed payloads, so a naive
`pubsub.asyncIterator()` would broadcast every ticket event to every open socket. Each
subscription therefore authorises twice:

1. **When it starts**: `ticketRoom(ticketId)` runs the same ownership check as the `ticket`
   query (another customer's ticket is `NOT_FOUND`), and `agentPresence` is staff-only.
2. **For every event**: `withFilter` checks the payload against the connection's user.
   Customers only receive events for their own tickets and never internal notes; notifications
   only reach their recipients.

`server/src/tests/realtime.test.ts` opens real graphql-ws connections and asserts that one
customer never receives another customer's events, that internal notes never reach customers,
and that typing and viewer events stay inside the room.

### Authentication

- Passwords hashed with **Argon2id**; unknown emails still run a hash check so response timing
  doesn't reveal which accounts exist.
- **HTTP**: a 15-minute access JWT in an `HttpOnly; SameSite=Lax` cookie (`Secure` in
  production). A random refresh token, stored only as a SHA-256 hash, is rotated on every use;
  reusing an old one revokes that login's whole session family (theft detection).
- **WebSocket**: the client fetches a 60-second token with the `subscriptionToken` mutation and
  sends it in graphql-ws `connectionParams`; the server verifies it in `onConnect` and refuses
  foreign `Origin`s.
- The user is reloaded from the database on every operation, so deactivation and role changes
  apply immediately; deactivating a user or changing a password also closes their sockets.
- CSRF: SameSite cookies + Apollo's CSRF prevention + an Origin allow-list for mutations.
- Mass assignment is impossible by construction: GraphQL input types have no `role`,
  `customerId` or `status` fields where callers shouldn't set them.

### Concurrency and consistency

- Ticket numbers come from an atomic counter (`$inc`), so concurrent creates never collide.
- Updates carry the `updatedAt` the client saw; if someone changed the ticket first the server
  answers `STALE_TICKET`, and Mongoose optimistic concurrency guards the save itself.
- After a reconnect the client refetches what's on screen, so events missed while offline
  aren't lost.

## Stack

| Layer    | Tech                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Client   | React 19, TypeScript (strict), Vite, Tailwind CSS v4, React Router, TanStack Query, graphql-ws, React Hook Form + Zod, Recharts, dnd-kit |
| Server   | Node 22, Express 5, Apollo Server 5, graphql-ws, graphql-subscriptions, Mongoose, Zod, Pino, Helmet                                      |
| AI       | Claude API (`@anthropic-ai/sdk`), optional                                                                                               |
| Database | MongoDB (Atlas in production; in-memory MongoDB for tests and local dev)                                                                 |
| Tests    | Vitest, Supertest, graphql-ws client, React Testing Library                                                                              |

## Repository layout

```
shared/   enums, Zod request schemas and response types used by both sides
server/   src/graphql (schema, resolvers, subscriptions), services, models, realtime, tests
client/   src/features (auth, tickets, realtime, admin, ai), pages, components, lib/operations.ts
```

## Getting started

Requires Node 22.12+.

```bash
npm install
cp server/.env.example server/.env   # then fill in secrets (see comments in the file)
npm run dev                          # API on :4000, web app on :5173
```

`MONGODB_URI=memory` (development only) starts a throwaway in-memory MongoDB and seeds demo data
on every start, so no Atlas cluster is needed to try the app.

### Demo accounts (development only)

All use the password `Demo@12345`; the login page has buttons that fill them in.

| Role     | Email                                                      |
| -------- | ---------------------------------------------------------- |
| Customer | customer@livedesk.dev (also rohan@ and sneha@livedesk.dev) |
| Agent    | agent@livedesk.dev (also kavya@livedesk.dev)               |
| Admin    | admin@livedesk.dev                                         |

- Seed a real non-production database once: `npm run seed -w @livedesk/server` (refuses to run
  when `NODE_ENV=production`).
- Create the first admin of a real database (there is no API for this, on purpose):
  `ADMIN_NAME=… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin -w @livedesk/server`.

### AI assist (optional)

Set `ANTHROPIC_API_KEY` in `server/.env` to enable category/priority suggestions and reply
drafts. Without it the features are hidden. It uses `claude-opus-5-5` by default (`AI_MODEL`
to change), validates the suggestion against a schema, treats ticket text as untrusted data, and
never sends anything without a person accepting it. Refusals fall back server-side
(`fallbacks: "default"`).

## Scripts (run from the repo root)

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | API + web app with hot reload                     |
| `npm run typecheck` | TypeScript in all workspaces                      |
| `npm run lint`      | oxlint in client and server                       |
| `npm test`          | Vitest in all workspaces (83 tests)               |
| `npm run build`     | Production builds (server bundle + static client) |

## API

- `POST /graphql`: queries and mutations (see `server/src/graphql/schema.ts`; each resolver file
  lists who may call what). Errors look like
  `{ message, extensions: { code, status, fields? } }`, e.g. `NOT_FOUND`, `FORBIDDEN`,
  `STALE_TICKET`, `BAD_USER_INPUT`.
- `WS /graphql`: subscriptions `ticketEvents`, `notifications`, `ticketRoom(ticketId)`,
  `agentPresence`.
- `GET /health` (liveness) and `GET /health/ready` (503 until MongoDB is connected).

## Limitations

- The PubSub is in-process: one API instance. Scaling out needs a shared engine (e.g. Redis)
  behind the same interface.
- Live notifications are kept for the browser session only (not stored).
- No file attachments or email notifications yet.

## Notes

- The in-memory MongoDB used for tests is pinned to 7.0 (`server/package.json` → `config`)
  because MongoDB 8.x binaries need macOS 13+.
- `@hookform/resolvers` is pinned to v5: v6.0.0 ships conflicting optional peer dependencies.
- `graphql` is pinned to v16 because Apollo Server 5 requires it.
