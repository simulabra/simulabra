# Agenda Projects (design sketch)

## Goal
Evolve Agenda “tasks” into **projects**: tasks can belong to a project, the UI can show a project’s tasks in a focused view, and each project carries **custom context** that can be used by Geist (LLM) and by humans.

This design fits the current architecture:
- SQLite persistence + migrations: `apps/agenda/src/sqlite.js`
- Models with `$sqlite.SQLitePersisted`: `apps/agenda/src/models.js`
- CRUD via RPC on `DatabaseService`: `apps/agenda/src/services/database.js`
- HTTP API surface in supervisor: `apps/agenda/run.js`
- Web UI reads/writes via HTTP: `apps/agenda/src/ui/app.js`
- Geist executes tools via `AgendaToolRegistry`: `apps/agenda/src/tools.js`, `apps/agenda/src/services/geist.js`

## Non-goals (for v1)
- Multi-user / sharing / auth
- Subprojects, dependencies, gantt
- Full text search overhaul (Agenda has FTS tables, but `DatabaseService.search` is currently in-memory substring matching)
- A perfect UI/UX — focus on primitives that enable iteration

---

## Current task flow (baseline)
- `Task` is a SQLite model: title, done, priority, dueDate, tags, etc. (`apps/agenda/src/models.js`)
- DB service returns `Task.jsonify()` over RPC (`apps/agenda/src/services/database.js`)
- UI calls `POST /api/v1/tasks/list` and `POST /api/v1/tasks/complete` (`apps/agenda/src/ui/app.js`, `apps/agenda/run.js`)
- Geist maps natural language → tools; tools call `services.db.*` (`apps/agenda/src/services/geist.js`, `apps/agenda/src/tools.js`)

Projects should feel like a thin layer over this: keep Task intact, add a Project model + a `projectId` pointer on Task, then wire through DB service, HTTP, UI, and tools.

---

## Data model

### New model: `Project`
Add a new `$sqlite.SQLitePersisted` model in `apps/agenda/src/models.js`:

**Fields (v1)**
- `name` (string, mutable, searchable): human name (“Simulabra Agenda”, “Taxes 2026”)
- `archived` (boolean, mutable, indexed): active vs archived
- `context` (string, mutable): freeform markdown-ish context used by Geist + humans
- `slug` (string, mutable, indexed, unique in SQL): stable-ish handle for CLI + tooling (“agenda”, “taxes-2026”)
- Optional later: `color`, `icon`, `defaultPriority`, `defaultTags`, `sortOrder`

**Invariants**
- `name` is not required to be unique (people rename/duplicate), but `slug` should be unique if present.
- Context is “user-owned”; Geist reads it but should never silently mutate it (mutations are explicit tools/UI actions).

### Update model: `Task`
Add a nullable `projectId` field to `Task`:
- `projectId` (string | null, mutable, indexed): references `Project.sid` (stored as TEXT)

Semantics:
- `projectId = null` means “Inbox / Unassigned”.
- The “Inbox” can be treated as a virtual project in UI/tools, or materialized as a real Project row (see migration plan).

### Optional (not required for v1): `ProjectMembership` / many-to-many
If later you want tasks to appear in multiple projects, add a join table `agenda_TaskProject(taskId, projectId)` and remove `Task.projectId`.
For v1, keep it one project per task.

---

## Persistence & migrations (SQLite)
Add a migration `006_projects` in `apps/agenda/src/sqlite.js` (and extend `AgendaMigrations.all()`).

### Schema changes
1) Create `agenda_Project`
- `sid TEXT PRIMARY KEY`
- `name TEXT`
- `slug TEXT`
- `archived TEXT`
- `context TEXT`
- `createdAt TEXT`
- `updatedAt TEXT`

2) Add `projectId` to `agenda_Task`
- `ALTER TABLE agenda_Task ADD COLUMN projectId TEXT`

3) Indexes
- `CREATE INDEX idx_agenda_Task_projectId ON agenda_Task(projectId)`
- `CREATE INDEX idx_agenda_Project_archived ON agenda_Project(archived)`
- `CREATE UNIQUE INDEX idx_agenda_Project_slug ON agenda_Project(slug)` (optional but recommended)

4) (Optional) FTS
- `agenda_Project_fts` on `(sid, name, context)` plus triggers, matching the existing pattern in migration `003_create_fts`.

### Data migration: existing tasks
Two reasonable options:

**Option A: Virtual Inbox (simplest)**
- Do nothing; existing tasks keep `projectId = null`.
- UI/tools display “Inbox” as `projectId = null`.

**Option B: Materialized Inbox (more explicit)**
- In the migration or on service boot, create a `Project` row with `slug = "inbox"` if missing.
- Set all existing tasks’ `projectId` to that project’s `sid`.
- Pros: “every task has a project” invariant; Cons: requires updating tasks during migration and introduces a special row.

I’d start with **Option A** and only materialize if needed.

---

## Service layer (RPC): DatabaseService
Extend `apps/agenda/src/services/database.js`.

### Project RPC methods (new)
- `createProject({ name, slug?, context?, archived? }) -> Project`
- `getProject({ id }) -> Project | null`
- `listProjects({ archived? } = {}) -> Project[]` (default `archived=false`)
- `updateProject({ id, name?, slug?, context?, archived? }) -> Project`

### Task RPC updates
- `createTask({ title, priority, dueDate, tags, projectId? })`
- `updateTask({ id, title?, priority?, dueDate?, tags?, projectId? })`
- `listTasks(filter)` supports:
  - existing: `done`, `priority`, `maxPriority`, `tag`
  - new: `projectId` (exact match), and optionally `includeUnassigned` for “All projects”

### Denormalization for UI convenience (optional)
For the tasks view it’s useful to show the project name without extra round trips. Two approaches:
- UI loads projects once, then maps `task.projectId -> project.name` client-side
- Or DB service returns `task.project` embedded (id + name) in list calls

Start with the client-side mapping (keeps DB service simple).

---

## HTTP API surface (supervisor)
Extend `apps/agenda/run.js` with endpoints:

Projects:
- `POST /api/v1/projects/list` → proxy `db.listProjects`
- `POST /api/v1/projects/create` → proxy `db.createProject`
- `POST /api/v1/projects/update` → proxy `db.updateProject`

Tasks:
- Keep `POST /api/v1/tasks/list`, but allow `{ projectId }` in the body
- Add `POST /api/v1/tasks/update` if the UI should move tasks between projects without chat

---

## UI: project-specific tasks view
Extend `apps/agenda/src/ui/app.js`.

### App state additions
- `projects` signal (list of projects)
- `activeProjectId` signal (string | null), persisted to `localStorage`

### View design (v1)
Keep bottom nav as-is, but evolve the existing Tasks tab:
- Header gets a **project selector**:
  - “All” (no project filtering)
  - “Inbox” (projectId null)
  - each active project by name
- Task list filters by `(task.projectId === activeProjectId)` when a project is selected
- When “All” is selected, optionally group tasks by project with a divider

### Context display/edit (v1)
When a specific project is selected:
- Show a collapsible “Context” panel at the top of the tasks view:
  - read-only rendering of `project.context`
  - an “edit” mode that saves via `/api/v1/projects/update` (context only)

This is intentionally minimal: it turns projects into a *place* you can focus, without redesigning the app.

---

## Geist: custom context + project tools

### Project scoping for chat/tool execution
To make “active project” real (not just UI filtering), Geist needs to know the current project when interpreting a message.

Recommended approach:
- Extend `interpretMessage` payload to include `projectId` (nullable).
  - UI passes `activeProjectId` with each `/api/v1/chat/send`
  - CLI can add `--project <slug>` later
- Geist loads the project (name + context) from `DatabaseService` and builds a **dynamic system prompt**:
  - base prompt (current `systemPrompt`)
  - + `Project: <name>` and `Project context: <context>`
- Tool execution receives a `services` context that includes `projectId`, so tools can default it.

This avoids relying on the model to “remember” which project it’s in.

### Tools (new) for projects
Add new Tool classes in `apps/agenda/src/tools.js` and register them in `AgendaToolRegistry`:

Project CRUD:
- `create_project`
  - input: `{ name: string, slug?: string, context?: string }`
  - behavior: creates a project (archived=false)
- `list_projects`
  - input: `{ archived?: boolean }`
  - behavior: lists projects
- `update_project`
  - input: `{ id: string, name?: string, slug?: string, context?: string, archived?: boolean }`
  - behavior: update fields

Task ↔ project operations:
- Option 1 (minimal): extend existing tools
  - `create_task` accepts optional `projectId` or `projectSlug`
  - `list_tasks` accepts optional `projectId`
- Option 2 (more explicit): add dedicated tools
  - `move_task_to_project` input `{ taskId: string, projectId: string | null }`
  - `list_project_tasks` input `{ projectId: string, done?: boolean, maxPriority?: number }`

I’d do **Option 1** plus a single explicit “move task” tool if needed.

### Geist prompt updates
Update `apps/agenda/src/services/geist.js` system prompt “tools:” section with the new project tools and project semantics:
- “projects → list_projects”
- “create project → create_project”
- “archive project → update_project(archived=true)”
- “move task to project → move_task_to_project / update_task(projectId=…)”

---

## Prompting system (optional follow-on)
If/when projects exist, prompt generation can improve by including project context:
- `analyzeContext()` returns:
  - active tasks grouped by project
  - each project’s context
- prompts can reference both task + project (“still planning to ship X in project Y?”)

This can be deferred until after projects + UI are working.

---

## Implementation plan (incremental)
1) Add `Project` model + migration + `projectId` on Task
2) Add DatabaseService RPC methods for projects, and extend task CRUD to accept/filter by `projectId`
3) Add project HTTP endpoints in `apps/agenda/run.js`
4) Add tools: `create_project`, `list_projects`, `update_project` (+ optional move tool)
5) UI: load projects, add project selector in TodosView, filter tasks by project
6) UI: context panel + edit/save
7) Geist: pass `projectId` through chat send → interpretMessage → dynamic prompt + tool defaults

---

## Open questions
- Should logs/reminders also belong to projects (shared `projectId` field on all item types)?
- Is “Inbox” virtual (null) good enough, or should it be a real project row?
- Do we want per-project chat streams (conversationId per project), or a single chat with per-message projectId?
- How strict should slug uniqueness be (hard error vs auto-dedupe)?

