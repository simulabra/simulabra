# Phase 1: Audit Findings Document

Write a detailed audit document to `sps/prj/agenda-compost/docs/audit.md` synthesizing the findings below. The document should be structured as a reference — something a developer or agent can consult when working on the agenda app.

## Source Files Audited
- `apps/agenda/src/models.js` — Log, Task, Reminder, Haunt, HauntConfig, Project
- `apps/agenda/src/tools.js` — 14 tool classes + AgendaToolRegistry
- `apps/agenda/src/sqlite.js` — SQLitePersisted mixin, 8 migrations
- `apps/agenda/src/supervisor.js` — AgendaService, AgendaManagedService, AgendaSupervisor
- `apps/agenda/src/provider.js` — ProviderAdapter, ProviderConfig + 4 standalone functions
- `apps/agenda/src/services/database.js` — DatabaseService (660+ lines)
- `apps/agenda/src/services/geist.js` — GeistService (787 lines)
- `apps/agenda/run.js` — supervisor bootstrap + HTTP routing
- `apps/agenda/evals/` — framework, trace, scenarios, report, compare
- `apps/agenda/CLAUDE.md` — developer/agent guidance (STALE)

## Findings to Document

### What Works Well (Exemplary Patterns)
1. **Model layer** (models.js): Every persistent entity is a proper Simulabra class extending SQLitePersisted with DBVar slots. toSQL/fromSQL converters are consistent. After.init sets defaults. description() provides human-readable output.
2. **Tool layer** (tools.js): Every tool is a reified class with Tool mixin. AgendaToolRegistry uses After.init to self-populate. Clean execute(args, services) interface.
3. **Migration system** (sqlite.js): Each migration is a Migration.new() with version, up(), down(). AgendaMigrations.all() is a Static method.
4. **Service architecture**: AgendaService mixin composes NodeClient. RPC methods properly declared. Service lifecycle managed through supervisor.
5. **Eval framework** (evals/framework.js): EvalCase is a proper Simulabra class. TraceCapture wraps the API client cleanly. Good use of After.init for wiring.

### Anti-Patterns Found

#### 1. Plain Objects Where Classes Should Exist
- **parseStreamEntry** (database.js:322-338): Returns a plain object `{ id, internalId, conversationId, role, content, source, createdAt, ... }`. Should be a ChatMessage class.
- **appendChatMessage** (database.js:349-373): Constructs a plain entry object. Should use ChatMessage.
- **services()** (geist.js:194-200): Returns `{ db: this.dbService() }`. Should be a ServiceContext class or at minimum use a named pattern.
- **analyzeContext()** (geist.js:446-482): Returns a 7-property plain object (tasks, logs, reminders, config, projects, projectMap, tasksByProject, currentTime). This is a first-class concept — AnalysisContext or HauntContext.
- **Tool execution results** (geist.js:274-278): `{ tool, input, result }` objects in an array. Should be ToolResult instances.

#### 2. Standalone Functions Outside the Object System
- **provider.js:4-155**: `toOpenAI()`, `fromOpenAI()`, `toOpenAIMessages()`, `toOpenAITools()` are 150 lines of conversion logic as bare functions. These should be Static methods on ProviderAdapter or a separate MessageTranslator class. They're exported but not discoverable through the module system.

#### 3. Code Duplication
- **interpret() vs interpretMessage()** (geist.js:233-441): These two methods share ~80% of their code — identical tool execution loops, identical follow-up message construction, identical error handling. The only difference is that interpretMessage persists messages and supports chat history. Should extract shared logic into a core method.

#### 4. Unused Infrastructure
- **FTS5 tables exist but aren't used** (sqlite.js migrations 003+006 create FTS5 tables with sync triggers; database.js:277-302 search() does brute-force `.filter()` on all loaded objects instead of using FTS5). The ORM has a `search(db, query)` static method that uses FTS5 — it's just not being called.

#### 5. Inconsistent Method Declarations
- **recordHauntResponse** (geist.js:684-703): Declared as `$.Method` but called cross-process context. Should be consistent with other cross-service methods.

#### 6. Ad-hoc Patterns in run.js
- **apiHandler** (run.js:43-62): A closure that wraps handlers with error handling. This is middleware — should be a class (or use the existing MethodPathHandler with error handling built in).

#### 7. Stale Documentation
- **CLAUDE.md** still references Redis (the app migrated to SQLite). Wrong test file names. Architecture diagram shows Redis instead of SQLite. Development section references RedisVar, RedisPersisted. Debugging references non-existent patterns.

### Underused Simulabra Capabilities
From src/base.js and src/db.js, these are available but not leveraged:
1. **EnumVar** — Haunt status ('pending'/'shown'/'actioned'/'dismissed') and itemType ('task'/'log'/'reminder') are string fields. Should be EnumVar for type safety.
2. **Virtual methods** — No abstract service contracts. AgendaService could declare virtual health() to enforce implementation.
3. **Before/After modifiers** — Used for init but not for lifecycle events (logging, validation, event emission).
4. **Configurable mixin** — Service configuration read from env vars ad-hoc. Could use ConfigVar.
5. **FTS5 search()** — SQLitePersisted.search() exists as a static method but is never called.

## Acceptance Criteria
- Document written to `sps/prj/agenda-compost/docs/audit.md`
- Each finding includes file paths and line numbers
- Organized by category (strengths, anti-patterns, opportunities)
- Actionable — each finding describes what should change
