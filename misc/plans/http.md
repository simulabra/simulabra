# Agenda HTTP API (Bun.serve) — Plan

## Goal

Make Agenda work end-to-end (UI → HTTP → services) without relying on WebSocket RPC from the browser:

- Serve the built Agenda web app from the Agenda supervisor (`Bun.serve`).
- Add HTTP API endpoints on the same origin.
- Keep service↔supervisor communication on `simulabra/live` WebSockets for now.

Non-goals for the first working version:

- Drop-in compatibility with `LiveBrowserClient`.
- Full authentication/authorization (but keep the code shaped for it).
- Perfect REST semantics (MVP uses explicit operation endpoints).

## API Shape (MVP)

### Routing (explicit endpoints, no “remote method” exposure)

All API paths are stable and app-owned. The client never supplies a service name or selector/method name.

Proposed endpoints for Agenda UI:

- `GET /api/v1/status` → supervisor status (for debugging + tests)
- `POST /api/v1/tasks/list` → list tasks
- `POST /api/v1/tasks/complete` → complete a task
- `POST /api/v1/logs/list` → list logs
- `POST /api/v1/reminders/list` → list reminders
- `POST /api/v1/chat/history` → load chat history
- `POST /api/v1/chat/wait` → long-poll for new chat messages
- `POST /api/v1/chat/send` → send a chat message (invokes Geist)

### Request format

- JSON-only for MVP.
- Each endpoint defines its own input object. If an underlying service method needs multiple inputs, refactor it to accept a single object argument.

### Response format

Always JSON:

- Success: `{ ok: true, value }`
- Error: `{ ok: false, error, code? }`

### Status codes (MVP)

- `200` success
- `400` invalid request (bad JSON, missing path parts)
- `404` unknown endpoint
- `503` dependency service not connected / starting
- `500` unexpected error

## Implementation Plan

### Phase 1 — Core HTTP routing objects (reusable) ✅

Add a small Bun.serve-oriented HTTP layer that matches Simulabra style (objects + composition):

- `HttpError` (status + safe message + optional code/data)
- `HttpContext` (request, url, params, body, startedAt, requestId)
- `HttpHandler` interface: `match(ctx)` + `handle(ctx)`
- `HttpRouter` (ordered handlers, dispatches first match)
- `JsonBody` mixin (parses JSON into `ctx.body`)
- `ErrorBoundary` mixin (turn exceptions into `{ ok:false, ... }`)
- `RequestLogger` mixin (timing + request id)

Where:

- Put the reusable pieces in core (`src/`) so Agenda and future apps can share them.
- Prefer `$.Before`/`$.After`/`$.AsyncBefore`/`$.AsyncAfter` over manual wrappers.

Deliverable:

- A router that can be embedded into a `Bun.serve({ fetch })` handler and returns `Response`.

### Phase 2 — Extend `live.Supervisor` to serve HTTP alongside WebSockets ✅

Make `src/live.js` supervisor the single origin for:

- WebSockets (services connect as today)
- Static files (Agenda UI)
- HTTP API (`/api/v1/...`)

Plan:

- Add `Supervisor.httpRouter()` (or `httpHandlers()`) slot.
- Factor `serve()` so `fetch(req, server)` does:
  1) `if (server.upgrade(req)) return;` (WebSockets)
  2) otherwise `return this.httpRouter().handle(req)` (HTTP)

Deliverable:

- Supervisor can route both HTTP and WS on one port.

### Phase 3 — Agenda static serving from supervisor ✅

Serve the built Agenda app from `out/agenda` (keeps bundling as the source of truth):

- `GET /` → redirect to `/agenda/` (or serve the app directly at `/`)
- `GET /agenda/*` → serve files from `out/agenda`
  - include correct content types
  - return `404` on missing

Workflow:

- `bash build.sh` to update `out/agenda`
- `bun run apps/agenda/run.js`
- open `http://localhost:3030/agenda/`

Deliverable:

- One process (`apps/agenda/run.js`) serves UI + API + WS.

### Phase 4 — Agenda HTTP endpoint handlers (explicit) ✅

Add endpoint handlers that map each HTTP endpoint to a specific internal call (via `Supervisor.serviceProxy()`), plus request/response normalization.

Pattern:

- Each endpoint is an object: `{ method, path, handle(ctx) }`.
- `handle(ctx)` calls a specific service + method with a validated input object:
  - `const db = await sup.serviceProxy({ name: 'DatabaseService' })`
  - `return await db.listTasks(body)`

Hardening for MVP (still local-only friendly):

- No user-controlled selector dispatch: service/method are constants inside endpoint code.
- Basic input validation per endpoint (shape + required fields).
- Consistent error mapping (`HttpError` for expected failures, 500 for bugs).

Deliverable:

- UI can call `fetch('/api/v1/tasks/list', { method:'POST', body: JSON.stringify({ ... }) })`.

### Phase 5 — Refactor Agenda service APIs to be HTTP-friendly ✅

Standardize the “public” service methods used by the UI so each takes a single object argument.

Examples to refactor:

- `DatabaseService.listLogs(limit = 50)` → `listLogs({ limit = 50 } = {})`
- `DatabaseService.completeTask(id)` → `completeTask({ id })`

Then update callers (UI + any CLI paths still used).

Deliverable:

- Endpoints can always pass exactly one object argument.

### Phase 6 — Refactor Agenda UI to use HTTP ✅

Replace browser WebSocket RPC usage with fetch calls:

- Create an `AgendaApi` client object in UI code (reified, so it can be swapped/configured).
  - `listTasks(filter)`
  - `completeTask({ id })`
  - `listLogs({ limit })`
  - `listReminders(filter)`
  - `chatHistory({ conversationId, limit })`
  - `chatWait({ conversationId, afterId, timeoutMs, limit })`
  - `chatSend({ conversationId, text, source, clientUid, clientMessageId })`
- Update:
  - `refreshData()`
  - `sendMessage()`
  - `loadChatHistory()`
  - chat sync loop (`waitForChatMessages` as HTTP long-poll)

UI connection state:

- Replace WS “connected/reconnecting” with a simpler HTTP notion:
  - last successful call timestamp
  - exponential backoff on failure
  - show `"offline"` when failing

Deliverable:

- Agenda UI works with only HTTP from the browser.

### Phase 7 — Tests ✅

Add tests in `apps/agenda/tests/` and/or core:

- Router unit tests (path match, JSON parse, error mapping).
- Endpoint tests with a stubbed `serviceProxy` (no subprocess needed).
- One integration test that starts an Agenda supervisor on an ephemeral port, registers a minimal in-process service (or a test-only connection), and verifies:
  - `POST /api/v1/status` (or another small endpoint) returns `{ ok:true, value: ... }`.

Run:

- `bun run test` (Agenda is included)

## Follow-ups (after “working”)

- Authentication:
  - cookie session for browser
  - bearer token for CLI/automation
- Authorization:
  - per-route guards as `$.AsyncBefore` mixins
  - method allowlists become “policy objects” instead of ad-hoc sets
- Better transport primitives:
  - SSE for event streams / chat updates
  - eventually: internal service-to-service auth if exposed beyond localhost
