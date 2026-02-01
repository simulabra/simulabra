# Phase 2: DatabaseService Project CRUD

Extend the DatabaseService with RPC methods for Project CRUD, and extend existing list/create/update methods to handle projectId.

## Dependencies
Phase 1 (Project model and migration must be in place).

## Files to modify

- `apps/agenda/src/services/database.js` — Add project CRUD RPCs, extend task/log/reminder methods

## Changes

### New Project RPC methods

Add after the existing Prompt RPC methods:

#### createProject
`do({ name, slug, context = null, archived = false })` — Create Project, save, publishEvent('project.created'), return jsonify().

#### getProject
`do({ id })` — findById, return jsonify() or null.

#### getProjectBySlug
`do({ slug })` — Direct SQL query: `SELECT * FROM agenda_Project WHERE slug = $slug`. Return fromSQLRow().jsonify() or null. This enables tools that accept slug references.

#### listProjects
`do({ archived } = {})` — findAll, optional archived filter, sort by name, return jsonify array.

#### updateProject
`do({ id, name, slug, context, archived })` — findById, set changed fields, save, publishEvent('project.updated'), return jsonify(). Throw if not found.

### Extend existing methods

#### createTask — accept optional projectId
Add `projectId = null` to destructured params. Pass to `$models.Task.new(...)`.

#### updateTask — accept optional projectId
Add `projectId` to destructured params. `if (projectId !== undefined) task.projectId(projectId);`

#### listTasks — filter by projectId
Add to the in-memory filter chain:
- `projectId === null` → filter to items where `!t.projectId()`
- `projectId === <string>` → filter to items where `t.projectId() === projectId`
- `projectId === undefined` → no filtering (backward compatible)

#### createLog — accept optional projectId
Same pattern as createTask.

#### listLogs — filter by projectId
Same pattern as listTasks. Add `projectId` to the destructured params.

#### createReminder — accept optional projectId
Same pattern.

#### listReminders — filter by projectId
Same pattern.

### Add updateLog and updateReminder RPCs
These don't exist yet but are needed for the move_to_project tool (Phase 4). Add minimal versions:

#### updateLog
`do({ id, projectId })` — findById, set projectId if provided, save, publishEvent('log.updated'), return jsonify(). Throw if not found.

#### updateReminder
`do({ id, projectId })` — Same pattern. Throw if not found.

These can be expanded later with more fields if needed.

## Testing

- **CreateProject**: createProject with name, slug, context. Assert returned object has correct fields.
- **GetProject**: createProject then getProject by id. Assert fields match.
- **GetProjectBySlug**: createProject with slug, then getProjectBySlug. Assert found.
- **ListProjects**: Create 2 projects (one archived, one active). listProjects() returns both. listProjects({archived: false}) returns only active.
- **UpdateProject**: Create project, updateProject with new name. Assert returned and refetched values match.
- **UpdateProjectNotFound**: updateProject with nonexistent id throws.
- **CreateTaskWithProjectId**: createProject, createTask with projectId. Assert task has projectId.
- **ListTasksFilterByProjectId**: Create project, 2 tasks in project + 1 without. listTasks({projectId: id}) returns 2. listTasks({projectId: null}) returns 1.
- **UpdateTaskProjectId**: Create task, updateTask to set projectId. Assert updated.
- **CreateLogWithProjectId**: createLog with projectId, assert persists.
- **ListLogsFilterByProjectId**: Filter both ways.
- **CreateReminderWithProjectId**: Similar.
- **UpdateLog**: updateLog to set projectId. Assert updated.
- **UpdateReminder**: updateReminder to set projectId. Assert updated.

Run: `bun run test`

## Acceptance criteria
- All project CRUD operations work through DatabaseService
- Existing task/log/reminder creation works without projectId (backward compatible)
- Filtering by projectId works for tasks, logs, and reminders
- projectId=null is filterable as "Inbox"
- updateLog and updateReminder exist for move_to_project support
- All existing tests continue to pass

## Review

**Verdict: APPROVED**

Code is correct, idiomatic, and well-tested. All acceptance criteria are met. 49 database service tests pass (31 existing + 18 new), all core tests pass, no regressions.

**Correctness:**
- All 5 Project CRUD RPCs match the plan spec. `name` was correctly translated to `title` (Phase 1 rename).
- The three-way projectId filter (`=== null` / `!== undefined` / `undefined`) is applied consistently across listTasks, listLogs, and listReminders.
- `getProjectBySlug` uses direct SQL with `fromSQLRow()`, matching the `getPromptConfig` precedent.
- `updateLog` and `updateReminder` are minimal as specified, ready for Phase 4 expansion.
- Backward compatibility preserved: all existing callers continue to work since projectId defaults to null/undefined.

**Style:**
- Added doc strings to all 7 new RPC methods during review (they were missing).
- Removed two orphaned inline comments (`// Log update (for move_to_project)` and `// Reminder update (for move_to_project)`) — the doc strings now carry that information.
- Code follows existing service patterns faithfully.

**Test coverage:**
- 18 new tests cover: all CRUD paths, not-found errors, projectId on creation, filtering both ways (project + inbox), and updateLog/updateReminder round-trip persistence.
- Tests go beyond the plan by adding UpdateLogNotFound and UpdateReminderNotFound cases.

**No issues found.**
