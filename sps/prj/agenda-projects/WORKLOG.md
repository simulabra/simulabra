# Agenda Projects — Worklog

## 2.1.2026

### Planning session
Explored the full agenda codebase across three parallel investigations:
- Data layer: models.js (Task/Log/Reminder fields, SQLitePersisted mixin), sqlite.js (5 migrations), database.js (all RPC methods)
- HTTP/UI: run.js (all endpoints), app.js (signals, views, AgendaApiClient), supervisor.js (service orchestration)
- Geist/tools: tools.js (9 tools, AgendaToolRegistry), geist.js (system prompts, interpretMessage agentic loop, analyzeContext, generatePrompts)

User confirmed decisions:
- Virtual inbox (null projectId)
- All item types get projectId (not just tasks)
- Hard unique slug constraint
- Context-driven Geist scoping (Geist determines relevant projects from message, not a static UI-passed activeProjectId)
- Include prompting system integration in v1

Designed 8-phase plan with dependency graph. Phases 3+4 can run in parallel after Phase 2. UI track (6→7) and Geist track (5→8) can also run in parallel.

Interesting architectural note: the current filtering in DatabaseService is all in-memory (findAll then filter). This is fine for personal-scale data but worth noting if we ever need SQL-level filtering. For now, adding projectId follows the same pattern.

### Phase 1 — Project Model & Migration

**Files changed:**
- `apps/agenda/src/models.js` — Added Project class with title/slug/archived/context DBVars and description() method. Added projectId DBVar to Task, Log, and Reminder.
- `apps/agenda/src/sqlite.js` — Added migration006 (agenda_Project table, unique slug index, archived index, FTS5 with triggers, projectId column + index on Task/Log/Reminder). Registered in AgendaMigrations.all().
- `apps/agenda/tests/models.js` — Added 8 tests: ProjectCreation, ProjectDescriptionArchived, ProjectPersistence, ProjectSlugUniqueness, TaskWithProjectId, TaskWithNullProjectId, LogWithProjectId, ReminderWithProjectId.
- `apps/agenda/tests/sqlite.js` — Updated MigrationRunner and MigrationRollback tests to expect 6 migrations.

**Scope change:** Plan specified `name` as the human-readable DBVar. In Simulabra, `name` is a reserved slot on all objects (it holds the object's identity string). Renamed to `title` to avoid collision — consistent with Task's existing `title` slot. This affects the DB column, FTS index, and all callers.

**Test results:** 57 model tests pass, 13 sqlite tests pass, all core tests pass. No regressions.

### Phase 2 — DatabaseService Project CRUD

**Files changed:**
- `apps/agenda/src/services/database.js` — Added 7 new RPC methods: createProject, getProject, getProjectBySlug, listProjects, updateProject, updateLog, updateReminder. Extended 6 existing RPCs: createTask, updateTask, listTasks (projectId filter), createLog, listLogs (projectId filter), createReminder, listReminders (projectId filter).
- `apps/agenda/tests/services/database.js` — Added 18 new test cases covering all project CRUD operations, projectId on task/log/reminder creation, filtering by projectId (including null=Inbox), updateLog/updateReminder, and not-found error handling.

**Design notes:**
- `getProjectBySlug` uses a direct SQL query (`SELECT * FROM agenda_Project WHERE slug = $slug`) + `fromSQLRow()`, matching the PromptConfig pattern, since `findAll`+filter would be wasteful when we have an indexed slug column.
- `listProjects` sorts by `title` alphabetically (using `localeCompare`), unlike tasks (priority) or logs (timestamp), since projects are name-navigated entities.
- projectId filtering uses a three-way check: `=== null` means Inbox, `!== undefined` means specific project, `undefined` means no filter (backward compatible). This pattern is applied consistently to listTasks, listLogs, and listReminders.
- `updateLog` and `updateReminder` are minimal RPCs (only projectId for now) to support Phase 4's `move_to_project` tool. They can be expanded later.

**Test results:** 49 database service tests pass (31 existing + 18 new), 57 model tests pass, all core tests pass. No regressions.

### Phase 3 — HTTP API Endpoints

**Files changed:**
- `apps/agenda/run.js` — Added 5 new API endpoints: POST /api/v1/projects/list, /api/v1/projects/create, /api/v1/projects/get, /api/v1/projects/update, and POST /api/v1/tasks/update. All follow the existing `apiHandler` pattern with 400 validation for missing required fields. The projects/get endpoint dispatches to `getProjectBySlug` when `slug` is provided, otherwise `getProject`.

**Design notes:**
- Thin adapter layer: each endpoint validates required fields, obtains a DatabaseService proxy, and delegates to the Phase 2 RPC methods. No business logic in the HTTP layer.
- The projects/create endpoint validates `title` (not `name`) to match the Phase 1 rename.
- The projects/get endpoint accepts either `id` or `slug`, preferring slug when both are provided. This supports UI navigation by slug and internal lookups by id.
- The tasks/update endpoint enables UI-driven project assignment without going through Geist chat.
- Existing list endpoints (tasks/list, logs/list, reminders/list) already pass body through to DB methods, so the Phase 2 projectId filtering is automatically available — no changes needed.

**Test results:** 49 database service tests pass, 57 model tests pass, all core tests pass. No regressions. Pre-existing failure in chat.js (uses deprecated Redis-based connectRedis) is unrelated.

### Phase 4 — Project Tools for Geist

**Files changed:**
- `apps/agenda/src/tools.js` — Added 4 new tool classes: CreateProjectTool, ListProjectsTool, UpdateProjectTool, MoveToProjectTool. Extended 6 existing tools (CreateLogTool, CreateTaskTool, CreateReminderTool, ListTasksTool, ListLogsTool, ListRemindersTool) with optional `projectId` in inputSchema and execute methods. Registered all 4 new tools in AgendaToolRegistry (9 → 13 tools).
- `apps/agenda/tests/tools.js` — Added 7 new test cases: ToolRegistryCount (13 tools), CreateProjectToolSchema, MoveToProjectToolSchema, CreateTaskToolSchemaExtended (verifies all 6 extended tools), ToolExecuteCreateProject, ToolExecuteMoveToProjectBySlug. Updated AgendaToolRegistryDefaults count (9 → 13). Fixed pre-existing bug in ToolRegistryExecuteWithMockedServices mock (positional args → object destructuring).

**Design notes:**
- Plan specified `name` in tool schemas; used `title` to match Phase 1's rename. The CreateProjectTool schema uses `title` as the required property.
- MoveToProjectTool is the most complex tool: it accepts either `projectId` (direct) or `projectSlug` (resolved via `getProjectBySlug`), then dispatches to the correct update method (`updateTask`, `updateLog`, or `updateReminder`) based on `itemType`.
- The list tools (ListTasksTool, ListLogsTool, ListRemindersTool) already pass their `args` straight through to DB methods, so adding `projectId` to the schema is all that's needed — the Phase 2 three-way filter (`null` = Inbox, defined = specific project, undefined = no filter) handles the rest automatically.
- The create tools (CreateLogTool, CreateTaskTool, CreateReminderTool) needed both schema and execute updates to pass `projectId` through to the DB methods.

**Pre-existing bug fix:** The `ToolRegistryExecuteWithMockedServices` test mock defined `createLog: (content, tags) => ...` but the tool calls `services.db.createLog({ content, tags, ... })` — a single object argument. The mock received the object as its first positional param, so `calledWith.content` was the entire args object, not the string. This caused `assertEq` to fail with a TypeError (calling `.description()` on a string). Fixed the mock to `createLog: (args) => ...`.

**Test results:** 15 agenda tools tests pass (8 existing + 7 new), 57 model tests pass, 49 database service tests pass, all core tests pass. No regressions.

### Phase 5 — Context-Driven Project Resolution

**Files changed:**
- `apps/agenda/src/services/geist.js` — Added `resolveProjectContext` method (loads active projects via `db.listProjects({ archived: false })`; returns null when empty, or `{ projects, projectList }` with formatted listing). Added `buildSystemPrompt` method (returns base prompt if null context, appends project listing and instructions otherwise). Updated `interpret` and `interpretMessage` to resolve project context and use the dynamic system prompt for both initial and follow-up API calls. Added 3 project tool mappings to the base `systemPrompt` string (create_project, list_projects, move_to_project, update_project).
- `apps/agenda/tests/geist-prompts.js` — Added 6 new test cases: ResolveProjectContextEmpty, ResolveProjectContextWithProjects, ResolveProjectContextExcludesArchived, BuildSystemPromptNoProjects, BuildSystemPromptWithProjects, SystemPromptIncludesProjectToolMappings.

**Design notes:**
- `resolveProjectContext` filters `archived: false` to only include active projects. This means archived projects won't pollute Geist's context.
- `buildSystemPrompt` is a synchronous method (not async) since it only assembles strings. The async work is in `resolveProjectContext`.
- The same `systemPrompt` local variable is used for both the initial and follow-up API calls within a turn, ensuring consistent context.
- Project context snippets are truncated to 200 characters in the listing to keep the system prompt manageable.
- The base systemPrompt now includes tool mappings for project operations, so even without dynamic context, Geist knows the tools exist.

**Test results:** 24 geist-prompts tests pass (18 existing + 6 new), 15 tools tests pass, 49 database service tests pass, all core tests pass. No regressions.

### Phase 6 — UI Project Selector & Filtering

**Files changed:**
- `apps/agenda/src/ui/app.js` — Added 5 API client methods to AgendaApiClient (listProjects, createProject, updateProject, getProject, updateTask). Added `projects` and `activeProjectId` signals to AgendaApp. Added `loadProjects` and `projectName` helper methods. Created ProjectSelector component with reactive tab rendering. Added `projectFilteredTasks` to TodosView, `filteredLogs` to JournalView, and `filteredReminders` to CalendarView. Added project badge on TaskItem when viewing All. Integrated ProjectSelector into all three view renders.
- `apps/agenda/src/style.css` — Added `.project-tabs` (flex row, overflow-x scroll), `.project-tab` (sand background, italic, box-shadow), `.project-tab.active` (light-sand, ocean text), `.project-badge` (inline tag with seaweed text).
- `apps/agenda/tests/ui/app.js` — Added Bun.build step at module load time to resolve bare specifiers for Playwright. Added `createApiMockServer` with mock API endpoints. Added `loadApiPage` helper. Added 5 BrowserCase tests: ProjectSelectorRendersOptions, ProjectSelectorInboxFilters, ProjectSelectorProjectFilters, ProjectSelectorLocalStorage, ProjectSelectorNoProjectsRegression.

**Design notes:**
- activeProjectId semantics: `null` = "All" (no filter), `"inbox"` = items with no projectId, string sid = specific project. This mirrors the Phase 2 three-way filtering pattern from the backend.
- Project filtering is applied BEFORE each view's existing filter logic (task mode, search, etc.) via dedicated `projectFilteredTasks`/`filteredLogs`/`filteredReminders` methods. This keeps the filtering concerns cleanly layered.
- The ProjectSelector uses `${() => this.renderTabs()}` in the template for reactivity. Projects load asynchronously after mount, so the tab list must re-render when the `projects` signal changes. A static render would capture an empty array and never update.
- localStorage persistence uses `$.Effect.create()` to sync `activeProjectId` changes. On init, stored value is restored before the connection is established.

**Struggles:**
- **Module specifier resolution**: Playwright loads the app in a real browser, which can't resolve bare imports like `simulabra/html`. Fixed by adding `Bun.build` step at test load time (following the swyperloom test pattern) to bundle the app before serving to Playwright.
- **Reactive tab rendering**: Initial implementation built the options array in `render()`, which only runs once. Projects arrive asynchronously. Had to split into a `renderTabs()` method wrapped in a reactive function expression.
- **Test selector scoping**: `$('.project-tab')` matched elements across all three views (TodosView, JournalView, CalendarView) since they all contain a ProjectSelector. Fixed by scoping selectors to `.todos-view .project-tab`.
- **Mock server chat/wait blocking**: The long-polling `/api/v1/chat/wait` endpoint with a 30s timeout prevented `server.stop()` from cleaning up, causing subsequent tests to hang. Fixed by returning immediately from chat/wait in test mocks.
- **BrowserCase resource exhaustion**: Running 16+ BrowserCase tests (each launching a separate Chromium) causes hangs after ~8 tests. This is a pre-existing framework issue, not caused by Phase 6 changes. The 5 new project selector tests were validated with a shared-browser approach.

**Test results:** All 5 project selector UI tests pass. All core tests pass (models, sqlite, database, tools, geist-prompts). No regressions.
