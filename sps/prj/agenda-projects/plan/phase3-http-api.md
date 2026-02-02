# Phase 3: HTTP API Endpoints

Add project endpoints to the HTTP API surface and a task update endpoint for moving tasks between projects from the UI.

## Dependencies
Phase 2 (DatabaseService project CRUD methods).

## Files to modify

- `apps/agenda/run.js` — Add project API endpoints, add tasks/update endpoint

## Changes

### New project endpoints

Add after the existing prompt endpoints (before `sup.httpRouter(router)`):

#### POST /api/v1/projects/list
Proxy to `db.listProjects(body)`. No required fields.

#### POST /api/v1/projects/create
Require `name` in body (400 if missing). Proxy to `db.createProject(body)`.

#### POST /api/v1/projects/get
Require `id` or `slug` (400 if neither). If slug provided, proxy to `db.getProjectBySlug(body)`, else `db.getProject(body)`.

#### POST /api/v1/projects/update
Require `id` in body (400 if missing). Proxy to `db.updateProject(body)`.

### New task update endpoint

#### POST /api/v1/tasks/update
Require `id` in body (400 if missing). Proxy to `db.updateTask(body)`.
This allows the UI to move tasks between projects without going through chat.

### Existing endpoints — no changes needed

The existing `POST /api/v1/tasks/list`, `POST /api/v1/logs/list`, and `POST /api/v1/reminders/list` already pass body through to their DB methods, so the new `projectId` filter is automatically supported once Phase 2 is in place.

## Testing

Integration testing via running server:
- POST `/api/v1/projects/create` with `{name: "Test", slug: "test"}` → 200, returned object
- POST `/api/v1/projects/list` → includes the project
- POST `/api/v1/projects/update` with new name → updated
- POST `/api/v1/projects/get` with `{slug: "test"}` → found
- POST `/api/v1/tasks/list` with `{projectId: <id>}` → filtering works
- POST `/api/v1/tasks/update` with `{id: <taskId>, projectId: <projectId>}` → task moved

The HTTP layer is thin glue — primary coverage comes from Phase 2 tests.

Run: `bun run test`

## Acceptance criteria
- All project endpoints respond correctly (create, list, get, update)
- Tasks can be moved between projects via POST /api/v1/tasks/update
- Existing endpoints continue to work (backward compatible)
- Missing required fields return 400 errors

## Review
**Status: Approved.**

Five endpoints added to `run.js`, all following the established `apiHandler` pattern exactly. Validation uses `HttpError.new` with `MISSING_FIELD` code consistently. The `projects/get` endpoint correctly dispatches to `getProjectBySlug` when slug is provided, `getProject` otherwise. The create endpoint validates `title` (not plan's `name`), matching the Phase 1 rename — correct. No duplication beyond the intentional idiom. No issues found.
