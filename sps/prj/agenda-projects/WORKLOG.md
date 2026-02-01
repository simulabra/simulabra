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
