# Agenda App — Simulabra Usage Audit

Comprehensive review of how `apps/agenda/` uses the Simulabra object system. Identifies exemplary patterns, anti-patterns, and underused capabilities to guide future work.

**Files audited:**

| File | Lines | Summary |
|------|-------|---------|
| `src/models.js` | 462 | Log, Task, Reminder, Haunt, HauntConfig, Project |
| `src/tools.js` | 510 | 14 tool classes + AgendaToolRegistry |
| `src/sqlite.js` | 381 | SQLitePersisted mixin, 8 migrations, AgendaMigrations |
| `src/supervisor.js` | 143 | AgendaService, AgendaManagedService, AgendaSupervisor |
| `src/provider.js` | 268 | ProviderAdapter, ProviderConfig + 4 standalone functions |
| `src/services/database.js` | 661 | DatabaseService (CRUD, chat streams, haunts, projects) |
| `src/services/geist.js` | 787 | GeistService (Claude API, tool execution, haunts, scheduler) |
| `src/services/reminder.js` | 172 | ReminderService (polling + notification) |
| `run.js` | 306 | Supervisor bootstrap + HTTP routing |
| `evals/framework.js` | 158 | EvalCase, test DB setup, snapshot/diff helpers |
| `evals/trace.js` | 87 | TraceCapture client wrapper |
| `CLAUDE.md` | 85 | Developer/agent guidance (stale) |

---

## 1. Exemplary Patterns

### 1.1 Model Layer (`src/models.js`)

Every persistent entity is a proper Simulabra class extending `SQLitePersisted` with `DBVar` slots. This is the gold standard for agenda code.

**What makes it good:**
- `toSQL`/`fromSQL` converters on every non-string field (dates, booleans, JSON arrays) — `models.js:23-24`, `76-77`, `32-33`
- `After.init` sets defaults like timestamps — `models.js:41-48`, `316-323`
- `description()` method on every model provides human-readable output — `models.js:49-55`, `142-150`, `228-234`, `324-335`, `450-456`
- Domain methods on the models themselves (`Task.complete()` at line 118, `Task.toggle()` at line 128, `Reminder.isDue()` at line 196, `Reminder.createNextOccurrence()` at line 211)
- Consistent `projectId` DBVar across Task, Log, and Reminder

### 1.2 Tool Layer (`src/tools.js`)

Every tool is a reified class with the `Tool` mixin. The `AgendaToolRegistry` auto-populates via `After.init`.

**What makes it good:**
- Each tool is a distinct class with `toolName`, `doc`, `inputSchema`, and `execute` — clean separation
- `execute(args, services)` interface is uniform across all 14 tools
- `AgendaToolRegistry.After.init` at `tools.js:486-504` registers all tools in one place
- Tools delegate to services rather than implementing logic directly

### 1.3 Migration System (`src/sqlite.js`)

Each migration is a `Migration.new()` with `version`, `up()`, `down()`. `AgendaMigrations.all()` is a `Static` method.

**What makes it good:**
- 8 migrations covering tables, indexes, FTS5, streams, projects, and schema renames
- Every migration has both `up()` and `down()`
- `AgendaMigrations.all()` as a `Static` method at `sqlite.js:369-376` provides a single point of truth
- `SQLitePersisted` extends the core mixin with `agenda_` table prefix (`sqlite.js:11-24`)

### 1.4 Service Architecture (`src/supervisor.js`)

The `AgendaService` mixin composes `NodeClient` for RPC. All three services (Database, Geist, Reminder) use it consistently.

**What makes it good:**
- `AgendaService` mixin at `supervisor.js:6-56`: identity from env, default `health()` RPC, `waitForService()` polling
- `AgendaManagedService` at `supervisor.js:58-98`: overrides `start()` for agenda-specific env vars and logging
- Clean re-export of framework classes at `supervisor.js:126-142`
- Each service follows the same startup pattern: `new() → connect() → waitForService() → connectToDatabase() → start`

### 1.5 Eval Framework (`evals/framework.js`, `evals/trace.js`)

`EvalCase` is a proper Simulabra class. `TraceCapture` wraps the API client cleanly.

**What makes it good:**
- `EvalCase` at `framework.js:50-154`: isolated in-memory DB per eval, seed data, snapshot/diff, assertion helpers
- `TraceCapture` at `trace.js:24-83`: `After.init` wires up `messages.create` proxy, accumulates cost/token tracking
- Clean context object passed to scenario functions with `interpret`, `snapshot`, `diff`, and assertion methods

---

## 2. Anti-Patterns

### 2.1 Plain Objects Where Classes Should Exist

Several methods return ad-hoc plain objects that represent first-class domain concepts. These objects have no identity, no methods, no discoverability through the module system.

**2.1a — Chat messages as plain objects**

`DatabaseService.parseStreamEntry` at `database.js:321-338` returns:
```js
{
  id, internalId, conversationId, role, content,
  source, createdAt, clientUid, clientMessageId, meta
}
```

`DatabaseService.appendChatMessage` at `database.js:341-375` constructs a nearly identical object. These are the same concept — a `ChatMessage` — constructed in two places with no shared definition.

**Should be:** A `ChatMessage` class in `models.js` (does not need persistence — just a value object with a constructor and methods).

**2.1b — Analysis context as plain object**

`GeistService.analyzeContext` at `geist.js:443-483` returns:
```js
{
  tasks, logs, reminders, config, projects,
  projectMap, tasksByProject, currentTime
}
```

This 8-property object is a first-class concept used by `generateHaunts` to build the LLM prompt. It has derived data (`projectMap`, `tasksByProject`) that could be computed methods.

**Should be:** An `AnalysisContext` or `HauntContext` class with slots for the raw data and methods for the derived views.

**2.1c — Tool execution results as plain objects**

Both `interpret` (geist.js:274-278) and `interpretMessage` (geist.js:382-386) push:
```js
{ tool: block.name, input: block.input, result: toolResult }
```

**Should be:** A `ToolResult` class, or use the result type from the tool registry.

**2.1d — Services context as plain object**

`GeistService.services()` at `geist.js:193-201` returns `{ db: this.dbService() }`. This is a service locator passed to every tool execution. If more services are added later, every tool signature stays the same but the object grows ad-hoc.

**Should be:** A `ServiceContext` class, or pass the services directly rather than wrapping them.

### 2.2 Standalone Functions Outside the Object System

**`src/provider.js:4-155`** — Four conversion functions (`toOpenAI`, `fromOpenAI`, `toOpenAIMessages`, `toOpenAITools`) totaling ~150 lines exist as bare module-level functions, exported at line 155.

These are the core logic of the multi-provider system, but they:
- Are not discoverable through the module system (`__.classes()` won't show them)
- Can't be overridden or composed via the Simulabra class system
- Are not documented with `doc:` strings

**Should be:** `Static` methods on `ProviderAdapter`, or a separate `MessageTranslator` class. The conversion logic is complex enough to warrant proper reification.

**`evals/framework.js:13-48`** — `createTestDb`, `snapshot`, `diffTable`, `diffSnapshots` are module-scoped closures. Less problematic since they're test infrastructure, but `snapshot` and `diffSnapshots` would be useful outside evals (e.g., for debugging, introspection).

### 2.3 Code Duplication Between interpret() and interpretMessage()

`GeistService.interpret` (geist.js:233-322) and `GeistService.interpretMessage` (geist.js:324-441) share ~80% identical code:

| Section | interpret() | interpretMessage() |
|---------|------------|-------------------|
| Client check | lines 239-243 | lines 330-334 |
| DB check | lines 245-249 | lines 336-340 |
| Project context | line 253 | line 344 |
| System prompt | line 254 | line 345 |
| API call | lines 257-263 | lines 365-371 |
| Tool loop | lines 268-283 | lines 376-391 |
| Follow-up | lines 285-309 | lines 393-417 |
| Error handling | lines 317-320 | lines 437-439 |

The only differences:
- `interpretMessage` persists user/assistant messages to the chat stream
- `interpretMessage` builds messages from chat history instead of a single input
- `interpretMessage` attaches metadata to the assistant message

**Should be:** Extract a core `_processWithTools(systemPrompt, messages)` method that handles the API call, tool loop, and follow-up. Both `interpret` and `interpretMessage` become thin wrappers.

### 2.4 Unused FTS5 Infrastructure

The migration system creates FTS5 virtual tables and sync triggers for every model:
- `sqlite.js:89-148` (migration 003): FTS5 for Log, Task, Reminder
- `sqlite.js:249-259` (migration 006): FTS5 for Project
- `sqlite.js:322-332` (migration 007): FTS5 for Haunt

The ORM (`src/db.js:325-336`) provides `SQLitePersisted.search(db, query)` as a `Static` method that properly uses the FTS5 index.

**But the application ignores all of this.** `DatabaseService.search` at `database.js:275-303` does:
```js
const q = query.toLowerCase();
const logs = $models.Log.findAll(this.db());
const matchingLogs = logs.filter(l =>
  l.content().toLowerCase().includes(q) || ...
);
```

This loads every row into memory, hydrates Simulabra objects, then does a JavaScript string `.includes()` check. The FTS5 tables are being maintained (writes trigger inserts/updates/deletes) for zero benefit.

**Should be:** Replace the brute-force search with calls to `$models.Log.search(this.db(), query)`, `$models.Task.search(this.db(), query)`, etc.

### 2.5 Inconsistent Method Declarations

`GeistService.recordHauntResponse` at `geist.js:684-703` is declared as `$.Method` but makes async cross-service calls to `db.getHauntConfig({})` and `db.updateHauntConfig(...)`. All other methods that call the DB proxy are `$live.RpcMethod`s or are called from within RpcMethods. This one is called from `actionHaunt` (an RpcMethod) at line 672.

Being a `$.Method` means it cannot be called directly over RPC. While it's currently only called internally, the inconsistency obscures the intent — is this meant to be a private helper, or a full service method?

### 2.6 Ad-hoc Middleware in run.js

`apiHandler` at `run.js:43-62` is a closure that wraps route handlers with error handling:
```js
const apiHandler = (method, path, handler) => {
  router.addHandler($supervisor.MethodPathHandler.new({
    httpMethod: method,
    path,
    handlerFn: async (ctx) => {
      try {
        return await handler(ctx);
      } catch (e) {
        if (e.message?.includes('not connected') || ...) {
          throw $supervisor.HttpError.new({ status: 503, ... });
        }
        throw e;
      }
    }
  }));
};
```

This is middleware, but implemented as a string-matching closure rather than a composable handler class. The `MethodPathHandler` class already exists in the framework — the error-wrapping logic should be part of the handler chain, not a function that generates handlers.

### 2.7 Stale Documentation (`CLAUDE.md`)

The agenda `CLAUDE.md` is deeply out of date. Every section contains inaccuracies:

| Section | Problem |
|---------|---------|
| `<AgendaOverview>` | Says "data persistence (Redis)" — app uses SQLite |
| `<Architecture>` | Diagram shows `DatabaseService ──── Redis` |
| `<LaunchPoints>` | Lists `RecurrenceRule (RedisPersisted)` — models use `SQLitePersisted` |
| `<Testing>` | Lists `tests/redis.js` — doesn't exist. Lists `tests/models.js`, `tests/tools.js` etc. as separate files — actual tests may differ |
| `<Testing>` | "Tests use isolated Redis keyspaces via `client.keyPrefix()`" — no longer true |
| `<Debugging>` | Missing evals section entirely |
| `<Development>` | "Models use `RedisPersisted` mixin with `RedisVar` for fields" — uses `SQLitePersisted` + `DBVar` |
| `<Development>` | "Don't use native Date methods for arithmetic; use TimePolicy" — `TimePolicy` may no longer exist as described |
| `<Services>` | "Redis CRUD" for DatabaseService — it's SQLite CRUD |
| Missing | No mention of Projects, Haunts, Provider system, Evals, or scheduler |

---

## 3. Underused Simulabra Capabilities

### 3.1 EnumVar for Constrained String Fields

**Available at:** `src/base.js:1434` — `EnumVar` restricts a slot to a fixed set of choices. Already used by `ServiceSpec.restartPolicy` in `src/live.js:468` and `RecurrenceRule.pattern` in `src/time.js:357`.

**Not used for:**
- `Haunt.status` (`models.js:269-273`): accepts any string, should be `EnumVar` with choices `['pending', 'shown', 'actioned', 'dismissed']`
- `Haunt.itemType` (`models.js:245-248`): accepts any string, should be `EnumVar` with choices `['task', 'log', 'reminder']`
- `MoveToProjectTool.inputSchema.itemType` (`tools.js:416`): defines an enum in JSON Schema but the model layer doesn't enforce it

**Impact:** String typos in status values would silently succeed. EnumVar provides both runtime validation and self-documentation.

### 3.2 Virtual Methods for Service Contracts

**Available at:** `src/base.js:976` — `Virtual` declares a method that must be implemented by subclasses. Already used by `Tool.execute` in `src/tools.js:28`, `MessageHandler.topic/handle` in `src/live.js:10-11`, `RequestHandler.match/handle` in `src/http.js:432-435`.

**Not used for:**
- `AgendaService` declares `health()` as a concrete RpcMethod, but each service overrides it with service-specific info. If `health()` were `Virtual`, new services would be forced to implement it rather than silently inheriting the generic one.
- No abstract contract for the `connectToDatabase()` pattern that both `GeistService` and `ReminderService` implement identically.

### 3.3 Before/After Modifiers Beyond init

**Available at:** `src/base.js:1101` (Before), `src/base.js:1138` (After) — wrap method calls with pre/post behavior.

**Currently used for:** `After.init` only (default values, wiring).

**Not used for:**
- Logging: tool executions, API calls, and RPC methods are manually logged with `this.tlog()`. A `Before` or `After` modifier on `executeTool` could provide automatic trace logging.
- Validation: `updateHaunt` at `database.js:489-509` manually checks each field. An `After` on the setter could validate status transitions.
- Event emission: `publishEvent` is called manually after every CRUD operation. An `After` on `save()` could automate this.

### 3.4 Configurable Mixin for Service Configuration

**Available at:** `src/base.js:1559` — `Configurable` mixin with `ConfigVar` and `ConfigSignal` slots. Already used by `LLMClient` in `src/llm.js:110`.

**Not used for:** Service configuration. Currently:
- `GeistService.After.init` reads env vars via `ProviderConfig.new().fromEnv()` (geist.js:110-118)
- `AgendaManagedService.start()` passes `SIMULABRA_PORT` and `AGENDA_SERVICE_NAME` as env vars (supervisor.js:86-89)
- `DatabaseService` reads `AGENDA_DB_PATH` from env (database.js:25)
- `GeistService` reads `AGENDA_PROMPT_TIMES`, `AGENDA_PROMPT_DAYS`, `AGENDA_TIMEZONE` from env (geist.js:96-107)

All of this could use `ConfigVar` slots with env-key mappings, enabling config serialization and introspection.

### 3.5 FTS5 search() Static Method

**Available at:** `src/db.js:325-336` — `SQLitePersisted.search(db, query)` performs a proper FTS5 MATCH query joining the main table with its `_fts` virtual table.

**Not used anywhere in the agenda app.** See anti-pattern 2.4 above.

---

## 4. Additional Observations

### 4.1 Eval Helpers as Closures

`evals/framework.js:13-48` defines `createTestDb`, `snapshot`, `diffTable`, and `diffSnapshots` as module-scoped closures rather than class methods. This works but means these utilities can't be extended, overridden, or composed through the class system. If evals grow more complex, these should become methods on an `EvalEnvironment` class.

### 4.2 Notification Handlers as Raw Functions

`ReminderService.notificationHandlers` at `reminder.js:15` stores an array of raw functions. This is the callback pattern rather than the object pattern. Each handler could be a `NotificationHandler` class with a `handle(reminder)` virtual method, enabling typed handlers (SMSHandler, WebhookHandler, etc.) with their own configuration.

### 4.3 Repeated connectToDatabase Pattern

Both `GeistService` (geist.js:760-771) and `ReminderService` (reminder.js:146-157) have identical `connectToDatabase()` methods:
```js
async do() {
  if (!this.connected()) {
    throw new Error('not connected to supervisor');
  }
  const proxy = await this.serviceProxy({ name: 'DatabaseService' });
  this.dbService(proxy);
  this.tlog('connected to DatabaseService');
}
```

This could be extracted to the `AgendaService` mixin since it's a universal need for agenda services.

### 4.4 Health Check Overrides

Every service overrides `health()` (`database.js:60-65`, `geist.js:128-137`, `reminder.js:18-27`) despite `AgendaService` defining a default. The overrides are nearly identical — they just return `{ status: 'ok', service: '<name>' }` with optional extra fields. The base `AgendaService.health()` at `supervisor.js:23-31` already returns `{ status: 'ok', service: this.uid() }`.

---

## 5. Summary of Recommended Actions

| Priority | Category | Action |
|----------|----------|--------|
| High | Documentation | Rewrite `apps/agenda/CLAUDE.md` — every section is stale |
| High | Duplication | Extract shared interpret logic from `interpret()`/`interpretMessage()` |
| High | Unused infra | Replace brute-force `search()` with `SQLitePersisted.search()` |
| Medium | Plain objects | Create `ChatMessage` class for stream entries |
| Medium | Plain objects | Create `AnalysisContext` class for haunt generation context |
| Medium | Standalone fns | Move provider conversion functions to `ProviderAdapter` static methods |
| Medium | Type safety | Use `EnumVar` for `Haunt.status` and `Haunt.itemType` |
| Medium | Duplication | Extract `connectToDatabase()` to `AgendaService` mixin |
| Low | Middleware | Reify the `apiHandler` error-wrapping pattern in `run.js` |
| Low | Contracts | Add `Virtual` health check to `AgendaService` |
| Low | Observability | Use `Before`/`After` modifiers for automatic logging and event emission |
| Low | Configuration | Evaluate `Configurable` mixin for service env vars |
