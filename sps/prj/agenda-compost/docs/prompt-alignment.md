# Agenda — Prompt Alignment Document

This document proposes four deliverables:
1. Additions to the **root `CLAUDE.md`** — universal Simulabra patterns and anti-patterns
2. A replacement **`apps/agenda/CLAUDE.md`** — agenda-specific architecture and workflows
3. Revised **geist system prompts** for `geist.js`
4. A prioritized **refactoring roadmap**

---

## Part 1: Proposed Additions to Root `CLAUDE.md`

Add the following two sections to `/CLAUDE.md`, after `</CodingStandards>` and before `<Testing>`.

### Section: `<Patterns>`

```markdown
<Patterns>
These patterns apply to all Simulabra code. Reach for them by default.

REIFY EVERYTHING: if a concept has identity, gets passed between methods, or appears in more than one place — make it a class with slots. Plain objects `{}` are for throwaway local data only.

```js
// WRONG: returning a plain object that represents a domain concept
$.Method.new({
  name: 'getResult',
  do() {
    return { tool: this.toolName(), input: args, result: output };
  }
})

// RIGHT: define a class for the concept
$.Class.new({
  name: 'ToolResult',
  slots: [
    $.Var.new({ name: 'tool' }),
    $.Var.new({ name: 'input' }),
    $.Var.new({ name: 'result' }),
    $.Method.new({
      name: 'description',
      do() { return `${this.tool()}: ${JSON.stringify(this.result())}`; }
    }),
  ]
})
```

EnumVar — use when a slot has a fixed set of valid values. Inherits from Var, adds `choices` (required array). The setter throws if the value isn't in the list.

```js
// WRONG: plain Var accepts any string — typos silently succeed
$.Var.new({ name: 'status', default: 'pending' })

// RIGHT: EnumVar validates at runtime and documents the contract
$.EnumVar.new({
  name: 'status',
  choices: ['pending', 'active', 'done', 'cancelled'],
  default: 'pending',
})
```

Use for: status fields, type discriminators, mode selectors — any slot with a closed set of values. Already used by ServiceSpec.restartPolicy and RecurrenceRule.pattern.

Virtual — declare methods that subclasses MUST implement. Throws "not implemented" if called without an override.

```js
// In a mixin, declare what implementors must provide
$.Class.new({
  name: 'NotificationHandler',
  slots: [
    $.Virtual.new({ name: 'handle', doc: 'process a notification' }),
    $.Virtual.new({ name: 'canHandle', doc: 'whether this handler applies' }),
  ]
})
```

Use for: service contracts, handler interfaces, abstract base classes. Already used by Tool.execute, MessageHandler.topic/handle, RequestHandler.match/handle.

Before/After beyond init — use for cross-cutting concerns like logging, validation, and event emission. Don't limit them to After.init.

```js
// Automatic trace logging on tool execution
$.After.new({
  name: 'executeTool',
  do(toolName, args) {
    this.tlog(`tool: ${toolName}(${JSON.stringify(args)})`);
  }
})
```

Use for: audit logging, automatic event emission, validation guards, metrics.

Static methods over standalone functions — NEVER define module-level `function` declarations for logic that belongs to a class. Static methods are discoverable through `__.classes()`, documentable with `doc:`, and overridable by subclasses.

```js
// WRONG: bare function outside the class system
function formatDate(d) { return d.toISOString().split('T')[0]; }

// RIGHT: Static method on the appropriate class
$.Static.new({
  name: 'formatDate',
  doc: 'format a Date as YYYY-MM-DD',
  do(d) { return d.toISOString().split('T')[0]; }
})
```

DBVar vs Var:
 - DBVar: persisted to database, has toSQL/fromSQL converters, indexed/searchable flags
 - Var: in-memory only, for runtime state, config, computed values
 - use DBVar for anything that must survive a restart; Var for everything else

FTS5 search — when using SQLitePersisted with `searchable: true` fields, use the built-in `Model.search(db, query)` static method instead of loading all rows and filtering in JS. The FTS5 virtual tables and sync triggers are maintained automatically.

```js
// WRONG: load every row, filter in memory
const all = MyModel.findAll(db);
const matches = all.filter(m => m.content().toLowerCase().includes(q));

// RIGHT: use the FTS5 index
const matches = MyModel.search(db, query);
```

Configurable mixin — for classes with many environment-driven settings, consider the Configurable mixin with ConfigVar slots. Enables config serialization and introspection. See src/llm.js for an example.
</Patterns>
```

### Section: `<AntiPatterns>`

```markdown
<AntiPatterns>
 - PLAIN OBJECTS FOR DOMAIN CONCEPTS: if you're building `{ field1, field2, ... }` with 3+ fields and passing it between methods, make it a class
 - DUPLICATE METHOD BODIES: if two methods share >50% of their code, extract the shared logic into a core method and wrap it
 - CLIENT-SIDE FILTERING: don't `findAll()` then `.filter()` when database indexes or FTS5 exist for those criteria
 - STANDALONE FUNCTIONS: don't put conversion or utility logic in bare `function` declarations — use Static methods
 - AD-HOC MIDDLEWARE: don't write closures that generate handlers — use the handler class hierarchy or create a new handler class
</AntiPatterns>
```

---

## Part 2: Proposed `apps/agenda/CLAUDE.md` (Agenda-Specific Only)

Replace the entire contents of `apps/agenda/CLAUDE.md` with:

```markdown
# CLAUDE.md - Agenda Application

<AgendaOverview>
Personal productivity system with three coordinated microservices: data persistence (SQLite), natural language processing (Claude API via multi-provider adapter), and time-based notifications. Supports HTML, SMS, and CLI interfaces. Includes a proactive "haunts" system that surfaces forgotten or stale items, and a geist eval framework for testing LLM behavior.
</AgendaOverview>

<Architecture>
` ` `
run.js (AgendaSupervisor) ──┬── DatabaseService  ──── SQLite (bun:sqlite)
                            ├── GeistService     ──── Claude/OpenAI API + AgendaToolRegistry
                            └── ReminderService  ──── Polling + notification handlers
` ` `

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
```

---

## Part 3: Revised Geist System Prompts

### 3a. Main System Prompt (geist.js `systemPrompt` Var)

Replace the current `systemPrompt` default with:

```
you are a productivity ghost: the geist of SIMULABRA AGENDA. keep your responses terse and to the point. sprinkle in a bit of wit when appropriate.

the user communicates through lazily typed messages. your job is to figure out what they're asking for and do it.

IMPORTANT: always call a tool to create, update, complete, or delete items. the user's data only changes through tool calls — a text reply alone does nothing.

## data model

items live in a SQLite database. everything has an id.

- **task**: actionable item. has title, priority (1=urgent to 5=low, default 3), optional dueDate (ISO 8601), tags (array), projectId. use `done` to check completion status.
- **log**: timestamped journal entry. has content, tags, projectId.
- **reminder**: scheduled notification. has message, triggerAt (ISO 8601), optional recurrence ({pattern: daily|weekly|monthly, interval: N}), projectId.
- **project**: organizational container. has title, slug (url-safe handle), context (freeform markdown for scoping). items belong to projects via projectId.
- **haunt**: proactive suggestion. references items via itemType + itemId. has status (pending/shown/actioned/dismissed) and action choices.

relationships: tasks, logs, and reminders belong to projects through projectId. projectId=null means Inbox (unassigned).

## tools

intent → tool:
- thought/note/journal → create_log
- todo/task/action item → create_task
- mark done → complete_task (just needs id)
- edit/change/update existing task → update_task (needs id + fields to change)
- reminder/alert/notify me → create_reminder
- find/search → search
- show tasks → list_tasks (filters: done, priority, tag, projectId)
- show logs → list_logs (filters: limit, projectId)
- show reminders → list_reminders (filters: sent, projectId)
- webhook/automation → trigger_webhook

project tools:
- create_project: makes a NEW project container (NOT a task). use when user wants to organize work.
- list_projects: shows existing projects (filter: archived)
- update_project: edit title, context, slug, or archive (archived=true)
- move_to_project: moves an existing task/log/reminder into a project (needs itemType, itemId, projectId or projectSlug)

CRITICAL distinctions:
- projects and tasks are DIFFERENT things. do NOT use create_task when the user says "create a project".
- complete_task vs update_task: use complete_task to mark done. use update_task to change priority, title, due date, or tags.
- when creating items and a project is clearly implied by context, set projectId.

## time parsing

reminders: parse natural time ("tomorrow 3pm", "in 2 hours", "next monday 9am") → ISO 8601 for the `when` field. for recurring reminders ("every morning", "daily", "every 2 weeks"), set both `when` (first occurrence) and `recurrence` ({pattern, interval}).

tasks: parse due dates ("by friday", "due next week") into dueDate as ISO 8601.

## multi-step operations

some requests require multiple tool calls in sequence:
- "create a project for X and add some tasks" → create_project first, then create_task with the returned projectId
- "move all my cooking tasks to the recipes project" → list_tasks to find them, then move_to_project for each
- "what's overdue?" → list_tasks, then filter by dueDate in your response
```

### 3b. Haunt Generation System Prompt (geist.js `promptGenerationSystemPrompt` Var)

Replace the current `promptGenerationSystemPrompt` default with:

```
you are a productivity ghost: the geist of SIMULABRA AGENDA. you surface forgotten, stale, or urgent items so the user stays on top of things.

examine the tasks, logs, reminders, and projects below. pick items that genuinely need attention. be terse, direct, and helpful.

## what deserves a haunt

high priority:
- tasks approaching their dueDate (within 2 days)
- tasks with priority 1-2 that haven't been touched in 3+ days
- reminders about to trigger with no preparation

medium priority:
- tasks untouched for 7+ days (forgotten)
- recently added tasks with no dueDate or default priority → ask about deadline/urgency
- projects with no recent activity → surface the most neglected one

low priority:
- patterns suggesting follow-up (logged something related to an open task)
- tasks frequently snoozed → suggest backlogging (priority 5) or deleting

## what to skip

- items the user has dismissed 2+ times (check response history)
- tasks already marked done
- items snoozed with a future snoozeUntil

## output format

each haunt should:
- reference a specific item by name and id
- ask a concrete question or offer an action the user can take quickly
- be answerable with a short response (yes/no, a date, a priority)

respond with a JSON array:
[
  {"itemType": "task", "itemId": "abc123", "message": "still planning on redesigning the homepage? it's been 10 days.", "projectId": "proj456"}
]

nothing needs attention → respond with []
```

---

## Part 4: Refactoring Roadmap

Ordered by priority. Each item is scoped as a standalone follow-on project.

### P1 — High Priority

#### 1. Apply CLAUDE.md Updates (Both Files)
- **Effort:** Small
- **Files:** `CLAUDE.md` (root), `apps/agenda/CLAUDE.md`
- **Achieves:** Every future agent session starts with correct Simulabra pattern knowledge (root) and correct agenda architecture (app). Single highest-impact change.

#### 2. Apply Revised System Prompts
- **Effort:** Small
- **Files:** `src/services/geist.js` (lines 23-51 and 54-87)
- **Achieves:** Geist produces better tool selections, understands the data model, handles multi-step operations. Run evals before and after to measure impact.

#### 3. Extract Shared Interpret Logic
- **Effort:** Medium
- **Files:** `src/services/geist.js`, `tests/services/geist.js`
- **Achieves:** Eliminates ~80 lines of duplication between `interpret()` and `interpretMessage()`. Extract a core `_callWithTools(systemPrompt, messages)` method that handles: API call → tool loop → follow-up call → text extraction. Both public methods become thin wrappers.

#### 4. Use FTS5 for Search
- **Effort:** Small
- **Files:** `src/services/database.js` (search RpcMethod at line 275)
- **Achieves:** Replaces brute-force `findAll().filter()` with `$models.Log.search(db, query)` etc. Uses FTS5 indexes already maintained by triggers.

### P2 — Medium Priority

#### 5. Reify ChatMessage
- **Effort:** Medium
- **Files:** `src/models.js`, `src/services/database.js`
- **Achieves:** `parseStreamEntry` and `appendChatMessage` both produce the same concept. Create a `ChatMessage` class that both methods use.

#### 6. Reify AnalysisContext
- **Effort:** Medium
- **Files:** `src/services/geist.js`, `src/models.js`
- **Achieves:** The 8-property plain object from `analyzeContext()` becomes a class with slots for raw data and methods for derived views.

#### 7. Move Provider Conversion to Static Methods
- **Effort:** Medium
- **Files:** `src/provider.js`, `tests/provider.js`
- **Achieves:** `toOpenAI`, `fromOpenAI`, `toOpenAIMessages`, `toOpenAITools` become Static methods on `ProviderAdapter`.

#### 8. Add EnumVar to Haunt Fields
- **Effort:** Small
- **Files:** `src/models.js`
- **Achieves:** `Haunt.status` and `Haunt.itemType` use `EnumVar` with explicit choices. Note: may need an `EnumDBVar` or use EnumVar with toSQL/fromSQL.

#### 9. Extract connectToDatabase to AgendaService
- **Effort:** Small
- **Files:** `src/supervisor.js`, `src/services/geist.js`, `src/services/reminder.js`
- **Achieves:** Identical `connectToDatabase()` method on GeistService and ReminderService moves to the `AgendaService` mixin.

### P3 — Low Priority

#### 10. Reify apiHandler as Middleware Class
- **Effort:** Small — **Files:** `run.js`

#### 11. Virtual Health Check Contract
- **Effort:** Small — **Files:** `src/supervisor.js`, `src/services/*.js`

#### 12. Before/After for Automatic Event Emission
- **Effort:** Medium — **Files:** `src/services/database.js`

#### 13. Evaluate Configurable Mixin for Services
- **Effort:** Medium — **Files:** `src/supervisor.js`, all services

---

## Summary

| # | Item | Priority | Effort | Impact |
|---|------|----------|--------|--------|
| 1 | Apply CLAUDE.md updates (both) | P1 | Small | Agent alignment |
| 2 | Apply revised system prompts | P1 | Small | Geist quality |
| 3 | Extract shared interpret logic | P1 | Medium | -80 lines duplication |
| 4 | Use FTS5 for search | P1 | Small | Performance + use existing infra |
| 5 | Reify ChatMessage | P2 | Medium | Type safety, single constructor |
| 6 | Reify AnalysisContext | P2 | Medium | Cleaner haunt generation |
| 7 | Provider fns → Static methods | P2 | Medium | Discoverability |
| 8 | EnumVar for Haunt fields | P2 | Small | Runtime validation |
| 9 | connectToDatabase → mixin | P2 | Small | DRY services |
| 10 | apiHandler → middleware class | P3 | Small | Consistency |
| 11 | Virtual health contract | P3 | Small | Enforce implementation |
| 12 | Auto event emission | P3 | Medium | Less boilerplate |
| 13 | Configurable mixin | P3 | Medium | Config introspection |
