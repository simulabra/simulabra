# Phase 6: UI Project Selector & Filtering

Add a project selector to the UI and filter all views by the selected project. Persist selection to localStorage.

## Dependencies
Phase 3 (HTTP API project endpoints).

## Files to modify

- `apps/agenda/src/ui/app.js` — Add projects signal, ProjectSelector component, filter views, API client methods

## Changes

### AgendaApiClient — new methods

- `listProjects(filter)` — POST `/api/v1/projects/list`
- `createProject(opts)` — POST `/api/v1/projects/create`
- `updateProject(opts)` — POST `/api/v1/projects/update`
- `getProject(opts)` — POST `/api/v1/projects/get`
- `updateTask(opts)` — POST `/api/v1/tasks/update`

### AgendaApp — new signals

- `projects` (default: []) — list of active projects
- `activeProjectId` (default: null) — currently selected project

**activeProjectId semantics:**
- `null` → "All" (no filtering)
- `"inbox"` → "Inbox" (items where projectId is null)
- A project sid → filter to that project

### AgendaApp — localStorage persistence

In init: restore from `localStorage.getItem('agenda_activeProjectId')`.
Effect: persist changes to localStorage.

### AgendaApp — loadProjects method

Fetch active projects from API, update `projects` signal. Call from `initConnection` and `refreshData`.

### AgendaApp — projectName helper

Look up project name by id from loaded projects. Return 'Inbox' for null.

### New ProjectSelector component

Renders tab buttons: All, Inbox, then one per active project. Highlights the active selection. Calls `app.activeProjectId(value)` on click.

**Important**: Reactive class attribute MUST be a function per CLAUDE.md HTML rules:
```
class=${() => "project-tab" + (active === opt.value ? " active" : "")}
```

### Update TodosView

1. Add ProjectSelector to the view header (between title and filter tabs)
2. In `filteredTasks()`, apply project filtering BEFORE the existing filter logic:
   - `activeProjectId === 'inbox'` → filter to `!t.projectId`
   - `activeProjectId === <string>` → filter to `t.projectId === activeProjectId`
   - `activeProjectId === null` → no filtering ("All")

### Update JournalView

Apply same project filtering to logs.

### Update CalendarView

Apply same project filtering to reminders.

### TaskItem — project badge

When viewing "All" (activeProjectId === null), show a small badge with the project name on tasks that belong to a project. Use the `projectName` helper.

## Testing

UI testing via `bun run test-ui`:
- ProjectSelector renders with "All" and "Inbox" options
- Selecting "Inbox" filters to tasks with no projectId
- Selecting a project filters to matching tasks
- localStorage persistence: select, reload, verify
- No regression when no projects exist (selector shows All + Inbox only)

## Acceptance criteria
- Project selector renders in TodosView header
- "All" shows everything; "Inbox" shows unassigned; project tabs show project-specific items
- Selection persists to localStorage
- Journal and Calendar views also filter by selected project
- Works correctly when no projects exist
