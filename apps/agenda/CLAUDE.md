# CLAUDE.md - Agenda Application

<AgendaOverview>
Personal productivity system with three coordinated microservices: data persistence (SQLite), natural language processing (Claude API via multi-provider adapter), and time-based notifications. Supports HTML, SMS, and CLI interfaces. Includes a proactive "haunts" system that surfaces forgotten or stale items, and a geist eval framework for testing LLM behavior.
</AgendaOverview>

<Architecture>
```
run.js (AgendaSupervisor) ──┬── DatabaseService  ──── SQLite (bun:sqlite)
                            ├── GeistService     ──── Claude/OpenAI API + AgendaToolRegistry
                            └── ReminderService  ──── Polling + notification handlers
```

Services communicate via RPC over WebSocket (port 3030). The supervisor manages lifecycle, health checks, and service registration. Each service composes the `AgendaService` mixin for identity and RPC registration.
</Architecture>

<Models>
All persistent entities are Simulabra classes extending `SQLitePersisted` (from `src/sqlite.js`) with `DBVar` slots. Tables use the `agenda_` prefix.

| Class | File | Purpose |
|-------|------|---------|
| Log | `src/models.js` | Timestamped journal entry with tags |
| Task | `src/models.js` | Actionable item with priority (1-5), due date, tags |
| Reminder | `src/models.js` | Scheduled notification with optional recurrence |
| Haunt | `src/models.js` | Proactive suggestion surfacing items that need attention |
| HauntConfig | `src/models.js` | Singleton config for haunt generation frequency/limits |
| Project | `src/models.js` | Named container grouping tasks, logs, and reminders |

Key patterns in models.js:
- Every DBVar that stores a non-string type has `toSQL`/`fromSQL` converters (dates, booleans, JSON arrays)
- Every model has `After.init` for setting defaults (timestamps, etc.)
- Every model has a `description()` method for human-readable output
- Domain logic lives on the model: `Task.complete()`, `Task.toggle()`, `Reminder.isDue()`, `Reminder.createNextOccurrence()`
- Items belong to projects via `projectId` DBVar
</Models>

<Tools>
Each tool is a reified Simulabra class with the `Tool` mixin (from `simulabra/tools`). `AgendaToolRegistry` auto-registers all tools in `After.init`.

Available tools (14 total, defined in `src/tools.js`):
- CRUD: `create_log`, `create_task`, `complete_task`, `update_task`, `create_reminder`
- Query: `list_tasks`, `list_logs`, `list_reminders`, `search`
- Projects: `create_project`, `list_projects`, `update_project`, `move_to_project`
- External: `trigger_webhook`

Adding a new tool:
1. Define a class with `$tools.Tool` mixin, `toolName`, `doc`, `inputSchema`, and `execute(args, services)` method
2. Register it in `AgendaToolRegistry.After.init`
3. Add corresponding `RpcMethod` in `DatabaseService` if it needs data access
4. Write tests in `tests/tools.js`
</Tools>

<Services>
| Service | File | Purpose |
|---------|------|---------|
| DatabaseService | `src/services/database.js` | SQLite CRUD for all models, chat stream, event publishing |
| GeistService | `src/services/geist.js` | Claude API interpretation, tool execution, haunt generation, scheduler |
| ReminderService | `src/services/reminder.js` | Polls due reminders, triggers notification handlers |

All services connect through supervisor's WebSocket server on port 3030.

Adding a new service:
1. Create a class with `AgendaService` mixin
2. Override `health()` RPC method
3. Add `connectToDatabase()` if it needs DB access
4. Register in `run.js` via `sup.registerService(ServiceSpec.new({...}))`
5. Add `import.meta.main` block for standalone startup
</Services>

<Persistence>
SQLite via `bun:sqlite`. Schema managed by migrations in `src/sqlite.js`.

- `SQLitePersisted` mixin (from `src/sqlite.js`): extends core `$db.SQLitePersisted` with `agenda_` table prefix
- `AgendaMigrations.all()`: Static method returning all 8 migrations in order
- `MigrationRunner`: runs migrations on database init
- FTS5 virtual tables exist for all models (with sync triggers) — use `Model.search(db, query)` for full-text search
- `SQLiteStream`: append-only event log for chat messages and system events

Adding a new model:
1. Define the class in `src/models.js` with `$sqlite.SQLitePersisted` and `DBVar` slots
2. Add a migration in `src/sqlite.js` creating the table + indexes + FTS5 if searchable
3. Register the migration in `AgendaMigrations.all()`
4. Add CRUD `RpcMethod`s in `DatabaseService`
5. Write tests
</Persistence>

<Provider>
Multi-provider LLM support via `src/provider.js`:
- `ProviderAdapter`: presents Anthropic SDK interface over any OpenAI-compatible API
- `ProviderConfig`: reads provider/model/key from environment variables
- Supports: Anthropic (native), OpenRouter, any OpenAI-compatible endpoint

Environment variables: `AGENDA_PROVIDER`, `AGENDA_MODEL`, `AGENDA_PROVIDER_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`
</Provider>

<Evals>
Geist eval framework for testing LLM behavior against real APIs:
- `evals/framework.js`: `EvalCase` class with isolated in-memory DB, seed data, snapshot/diff
- `evals/trace.js`: `TraceCapture` wraps API client to record all interactions with cost tracking
- `evals/scenarios/`: test scenarios (basic, realistic, tasks, projects, logs, reminders, multiturn)
- `evals/run.js`: runner that executes cases, prints results, saves JSON + markdown reports

Run evals: `bun run apps/agenda/evals/run.js [filter]`
</Evals>

<LaunchPoints>
- `run.js` — bootstrap supervisor and register services
- `src/supervisor.js` — AgendaService, AgendaManagedService, AgendaSupervisor
- `src/models.js` — Log, Task, Reminder, Haunt, HauntConfig, Project (SQLitePersisted)
- `src/tools.js` — 14 tool classes + AgendaToolRegistry
- `src/sqlite.js` — SQLitePersisted mixin, migrations, AgendaMigrations
- `src/provider.js` — ProviderAdapter, ProviderConfig
- `src/time.js` — RecurrenceRule, Scheduler, TimeOfDaySchedule, ScheduledJob
- `src/services/database.js` — DatabaseService (SQLite CRUD + chat streams)
- `src/services/geist.js` — GeistService (Claude API + tool execution + haunts)
- `src/services/reminder.js` — ReminderService (polling + notifications)
- `evals/run.js` — eval runner
- `index.html` — web interface entry point
</LaunchPoints>

<Testing>
From core directory:
- `bun run test` — runs all tests including agenda
- `bun run test-ui` — runs UI tests

Test files in `tests/`:
- `models.js` — Log, Task, Reminder, Haunt, Project model tests
- `sqlite.js` — SQLitePersisted and migration tests
- `tools.js` — tool registry and execution
- `time.js` — recurrence rules and scheduling
- `provider.js` — ProviderAdapter and format conversion
- `services/database.js` — DatabaseService CRUD
- `services/geist.js` — GeistService with mock API
- `services/reminder.js` — ReminderService polling
- `chat.js` — chat stream operations
- `task-filtering.js` — task list filtering
- `geist-prompts.js` — prompt generation
- `supervisor.js` — service management
- `integration.js` — cross-service scenarios
- `evals-report.js` — eval report formatting
- `ui/app.js` — browser UI tests (playwright)
- `support/helpers.js` — shared test utilities

Tests use in-memory SQLite databases (`:memory:`) for isolation.
</Testing>

<Debugging>
- Service logs: `apps/agenda/logs/*.log`
- Supervisor status: `supervisor.status()` returns all service health states
- RPC debugging: WebSocket on port 3030 (default)
- Health states: `healthy`, `unhealthy`, `starting`
- Eval traces: `evals/results/` contains JSON + markdown reports
</Debugging>

<Development>
Key patterns:
- Services compose `AgendaService` mixin for identity and RPC registration
- Tools are reified objects with `Tool` mixin: `toolName`, `doc`, `inputSchema`, `execute(args, services)`
- Models use `SQLitePersisted` mixin with `DBVar` for persistent fields
- Recurrence uses `RecurrenceRule.nextOccurrence()` for trigger calculation
- Multi-provider LLM via `ProviderAdapter` (Anthropic-compatible interface over any OpenAI endpoint)

Gotchas:
- Service specs require `healthCheckMethod` for RPC health checks
- WebSocket connections auto-reconnect via supervisor restart policy
- Test fixture arrays must deep-copy objects: `.map(o => ({...o}))` not `[...arr]`
</Development>
