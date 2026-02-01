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
