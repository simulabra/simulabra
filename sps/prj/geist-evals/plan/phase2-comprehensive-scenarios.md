# Phase 2: Comprehensive Eval Scenarios and Snapshot Diffs

Add eval scenarios covering the full breadth of geist capabilities. Add a database snapshot/diff utility to verify DB mutations.

## Snapshot Diff Utility

Add to the eval context (in `apps/agenda/evals/framework.js`):

**`ctx.snapshot()`** — captures current DB state by calling:
- `db.listTasks({})`
- `db.listLogs({})`
- `db.listReminders({})`
- `db.listProjects({})`

Returns `{ tasks, logs, reminders, projects }`.

**`ctx.diff(before, after)`** — compares two snapshots by ID:
- `created` — IDs in after but not before
- `modified` — same ID, any field value changed
- `deleted` — IDs in before but not after

Returns `{ tasks: { created, modified, deleted }, logs: {...}, reminders: {...}, projects: {...} }`.

The runner should automatically snapshot before/after each scenario and include the diff in the JSON report.

## Scenarios by Capability Area

### `scenarios/tasks.js` (3-4 scenarios)

- **"Create task with priority and due date"** — "I need to file taxes by april 15, make it high priority". Assert create_task called. Verify via snapshot diff that a new task exists.
- **"Complete a task by description"** — reference a seeded task title. "mark 'get plumber quote' as done". Assert complete_task called.
- **"Update task priority"** — "make 'plan workout schedule' urgent". Assert update_task called.
- **"List tasks with filter"** — "show me my high priority tasks". Assert list_tasks called.

### `scenarios/projects.js` (2-3 scenarios)

- **"Create project with context"** — "create a project called reading list for tracking books". Assert create_project.
- **"List projects"** — "show me my projects". Assert list_projects. Response should mention seeded projects.
- **"Move item to project"** — "move 'call dentist' to the fitness project". Assert move_to_project called.

### `scenarios/logs.js` (2 scenarios)

- **"Create a log entry"** — "note: found a great deal on running shoes at REI". Assert create_log.
- **"Search logs"** — "find my notes about countertops". Assert search called.

### `scenarios/reminders.js` (1-2 scenarios)

- **"Create a reminder"** — "remind me tomorrow at 3pm to call the contractor". Assert create_reminder.
- **"Create recurring reminder"** — "remind me every morning at 8am to check email". Assert create_reminder, recurrence field populated.

### `scenarios/multiturn.js` (1-2 scenarios)

Uses `geist.interpretMessage()` instead of `interpret()` with a shared conversationId:
- **"Multi-turn task creation and update"** — Turn 1: "add a task to review the codebase". Turn 2: "actually make that priority 2 and put it in the side project". Assert turn 1 calls create_task, turn 2 calls update_task or move_to_project.

## Assertion Design for Nondeterminism

Eval assertions should be loose:
- Assert correct tool *type* was called (not exact arguments)
- Use snapshot diffs to verify DB mutations (not exact field values)
- Accept text response variability — assert key terms if needed, not exact strings
- For multi-tool scenarios, assert the *set* of tools called, not the order

## Files to Create

| File | Purpose |
|------|---------|
| `apps/agenda/evals/scenarios/tasks.js` | Task eval scenarios |
| `apps/agenda/evals/scenarios/projects.js` | Project eval scenarios |
| `apps/agenda/evals/scenarios/logs.js` | Log/search eval scenarios |
| `apps/agenda/evals/scenarios/reminders.js` | Reminder eval scenarios |
| `apps/agenda/evals/scenarios/multiturn.js` | Multi-turn conversation evals |

## Files to Modify

| File | Change |
|------|--------|
| `apps/agenda/evals/framework.js` | Add snapshot(), diff() to context |
| `apps/agenda/evals/run.js` | Import new scenario files, auto-snapshot before/after |

## Acceptance Criteria

- [ ] Snapshot diff correctly identifies created/modified records
- [ ] 12-15 total eval scenarios across all files
- [ ] JSON report includes DB diffs per scenario
- [ ] Multi-turn eval demonstrates conversation context via interpretMessage
- [ ] All scenarios pass (allowing for LLM nondeterminism)
