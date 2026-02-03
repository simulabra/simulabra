# Phase 10: Bugfixes — Task Toggle, Project Creation via Geist, Prompt Update

## Overview
Fix three user-reported bugs and add missing test coverage. This is a bugfix/polish phase.

## Bug Analysis

### Bug 1: Task status toggle broken (`.rid` → `.id` migration gap)
**Root cause**: `TaskItem.handleComplete()` at `apps/agenda/src/ui/app.js:281` reads `this.task().rid`. But when the app migrated from Redis to SQLite, `jsonify()` in `src/db.js:344` was updated to rename `sid` → `id`. The `.rid` field no longer exists on serialized tasks — so clicking the checkbox passes `undefined` to the API, which 400s on missing `id`.

**Evidence**: UI mock test data at `tests/ui/app.js:312` also uses `rid`, confirming the entire UI layer was never updated after the migration.

### Bug 2: No way to uncomplete a task (one-way toggle)
**Root cause**: `completeTask` RPC in `database.js:122` always sets `done=true`. There is no `uncompleteTask` or toggle method. `updateTask` at `database.js:164` does not accept `done`. The UI button label shows "done"/"todo" but always calls `completeTask` — there is no way to go back.

### Bug 3: Geist creates task instead of project
**Root cause**: GeistService.log line 35454 shows user said "make a project for house stuff" and Geist called `create_task({"title":"make a project for house stuff"})`. The system prompt at `geist.js:38` says `project → create_project / list_projects` but this single line is insufficient — the LLM sees "project" in the user message and interprets it as a task about projects. Zero `create_project` calls appear in the entire log history.

## Changes

### 1. Task Model (`apps/agenda/src/models.js`)
Add a `toggle()` method to Task:
- If `done` is false: set `done(true)`, `completedAt(new Date())`
- If `done` is true: set `done(false)`, `completedAt(null)`
Keep the existing `complete()` method for backward compatibility (Geist tools use it).

### 2. Database Service (`apps/agenda/src/services/database.js`)
Rename `completeTask` RPC to `toggleTask`:
- Call `task.toggle()` instead of `task.complete()`
- Publish event `task.toggled` (or keep `task.completed`/`task.uncompleted` based on new state)
- Return the updated task

### 3. HTTP Route (`apps/agenda/run.js`)
Rename endpoint from `/api/v1/tasks/complete` to `/api/v1/tasks/toggle`. Update the handler to call `db.toggleTask(body)`.

### 4. UI (`apps/agenda/src/ui/app.js`)
- **TaskItem.handleComplete()** line 281: change `this.task().rid` → `this.task().id`
- **AgendaApiClient**: rename `completeTask` → `toggleTask`, point to new endpoint
- **AgendaApp**: rename `completeTask` → `toggleTask` method, call `this.api().toggleTask(taskId)`

### 5. Geist System Prompt (`apps/agenda/src/services/geist.js`)
Expand the base system prompt. After the existing tool mapping section, add a clear projects section:

```
projects: organizational containers that group related tasks, logs, and reminders.
- create_project: makes a NEW project (not a task). use when user wants to organize work into a project.
- list_projects: shows existing projects
- update_project: edit project title, context, or archive it
- move_to_project: moves an existing task/log/reminder into a project
do NOT use create_task when the user asks to create a project. projects and tasks are different things.
```

### 6. Tests

**Database service tests** (`apps/agenda/tests/services/database.js`):
- Rename existing `DatabaseServiceCompleteTask` → `DatabaseServiceToggleTask`
- Test full cycle: create task → toggle (should be done) → toggle again (should be not done, completedAt cleared)

**UI tests** (`apps/agenda/tests/ui/app.js`):
- Fix all mock task data: `rid` → `id` (lines 312-314)
- Add a BrowserCase test that clicks a task checkbox and verifies the API call uses correct `id`

**Geist prompt tests** (`apps/agenda/tests/geist-prompts.js`):
- Add test that `buildSystemPrompt` output contains project management instructions (e.g., matches `create_project` and `organizational`)

### 7. Geist Tool References
Check `CompleteTaskTool` in `apps/agenda/src/tools.js` — it calls `services.db.completeTask()`. This tool is used for Geist's "done" action, which should still only complete (not toggle). Keep the tool calling the model's `complete()` method directly, or have it always set done=true regardless of toggle semantics.

**Decision**: The Geist `complete_task` tool should always mark done (never toggle). Only the UI checkbox should toggle. So:
- `completeTask` RPC stays as-is for Geist tool use
- Add a NEW `toggleTask` RPC for the UI
- The HTTP endpoint for UI becomes `/api/v1/tasks/toggle` calling `toggleTask`
- The Geist tool continues using `completeTask` RPC

## Acceptance Criteria
- [ ] Clicking a task checkbox in the UI toggles it between done/not-done
- [ ] The task ID is correctly passed (`.id` not `.rid`)
- [ ] Asking Geist "create a project called X" calls `create_project`, not `create_task`
- [ ] Tests cover the toggle cycle at DB service level
- [ ] UI mock data uses `id` field consistently
- [ ] System prompt clearly distinguishes projects from tasks
- [ ] `bun run test` passes
- [ ] `bun run test-ui` passes
