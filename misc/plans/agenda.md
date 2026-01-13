<ProductRequirementDocument>
Simulabra Agenda is the personal productivity system that I have been wanting to build for a while, after finding the alternatives wanting.

root: apps/agenda/

<DataModel>
<ItemTypes>
Three core item types, all stored in Redis with full-text search capability:

<Log>
- id: uuid
- content: string (the journal entry text)
- timestamp: datetime
- tags: string[] (extracted from content or explicit)
</Log>

<Task>
- id: uuid
- title: string
- done: boolean
- priority: integer
- due_date: datetime (optional)
- created_at: datetime
- completed_at: datetime (optional)
</Task>

<Reminder>
- id: uuid
- message: string (what to remind about)
- trigger_at: datetime
- recurrence: RecurrenceRule (optional)
- sent: boolean
- created_at: datetime
</Reminder>

<RecurrenceRule>
- pattern: enum (daily, weekly, monthly)
- interval: number (every N days/weeks/months)
- days_of_week: number[] (for weekly: 0=Sun, 6=Sat)
- end_date: datetime (optional)
</RecurrenceRule>
</ItemTypes>

<Storage>
- Redis for primary data storage
- Redis Streams for change feed (event sourcing pattern)
- Redis Search for full-text search across all items
</Storage>
</DataModel>

<Clients>
<WebClient>
- web application (pattern off demos/dummy/client.js and demos/loom.js)
- accessed over tailscale, don't worry about auth for now
- dual-purpose chat window:
  - displays activity log (commands executed, system events)
  - allows direct interaction with the geist (natural language input)
- custom views for different item types (logs, tasks, reminders)
</WebClient>

<SMSClient>
- Twilio integration for sending/receiving SMS
- text an agent with commands like `log remember this`
- natural language messages are interpreted by the geist
- receives reminders and follow-ups via SMS
</SMSClient>

<CLIClient>
- one-shot mode: `bunx agenda 'log remember this'`
- interactive REPL mode: `bunx agenda` or `bunx agenda --interactive`
- same command parsing as SMS client
</CLIClient>
</Clients>

<Services>
Services coordinate via the live system (WebSocket RPC).

<DatabaseService>
- CRUD operations for all item types
- fetches data from Redis
- processes the change feed (Redis Streams consumer)
- exposes RPC methods for clients
</DatabaseService>

<ReminderService>
- polls for due reminders
- handles recurring reminder logic (creates next occurrence)
- triggers notifications via SMS or web push
- marks reminders as sent
</ReminderService>

<GeistService>
- powered by Claude API
- interprets natural language input into structured commands
- has access to tools:
  - create_log(content)
  - create_task(title, priority?, due_date?)
  - complete_task(id)
  - create_reminder(message, when, recurrence?)
  - search(query)
  - list_tasks(filter?)
  - list_reminders()
  - trigger_webhook(url, payload)
- webhook automation for integrations
</GeistService>
</Services>

<Components>
UI components and their conceptual purpose:

<Todos>
- classic todo list, but llms make you accountable
- see active todos (should be 10 or less) with status
- expand todo for detailed history
</Todos>

<Journal>
- timestamped log of random ideas and tidbits
- can be searched and queried
- recollect past thoughts by topic
</Journal>

<Calendar>
- view of upcoming events and reminders
- sends notifications of reminders
</Calendar>
</Components>

<Commands>
<Log>
<ExampleMessage>`log something to say`</ExampleMessage>
<Description>saves the argument to a searchable journal, with a timestamp</Description>
</Log>

<Task>
<ExampleMessage>`task buy groceries p2` or `todo fix the bug by friday`</ExampleMessage>
<Description>creates a task with optional priority and due date</Description>
</Task>

<Done>
<ExampleMessage>`bought groceries` or `completed task 3`</ExampleMessage>
<Description>marks a task as completed by title match or number</Description>
</Done>

<RemindMe>
<ExampleMessage>`remind me to check for 4b history llm upload in a week`</ExampleMessage>
<ExampleMessage>`every monday at 8am lets review the week`</ExampleMessage>
<Description>instruct the system to remind you of something at a later date, supports one-time and recurring</Description>
</RemindMe>

<Search>
<ExampleMessage>`search groceries` or `find meetings from last week`</ExampleMessage>
<ExampleMessage>`recollect what i was thinking about claude`</ExampleMessage>
<Description>full-text search across all items, looks through the journal for entries related to the query</Description>
</Search>

<List>
<ExampleMessage>`list tasks` or `show P1 tasks` or `reminders`</ExampleMessage>
<Description>lists items with optional filters</Description>
</List>
</Commands>

<Architecture>
```
                    +------------------+
                    |   Twilio SMS     |
                    +--------+---------+
                             |
+-------------+    +---------v---------+    +------------------+
|  Web Client +--->|   AgendaServer    |<---+   CLI Client     |
+-------------+    |  (WebSocket RPC)  |    +------------------+
                   +----+----+----+----+
                        |    |    |
          +-------------+    |    +-------------+
          |                  |                  |
   +------v------+    +------v------+    +------v------+
   | Database    |    | Reminder    |    | Geist       |
   | Service     |    | Service     |    | Service     |
   +------+------+    +------+------+    +------+------+
          |                  |                  |
          +--------+---------+                  |
                   |                            |
            +------v------+              +------v------+
            |    Redis    |              | Claude API  |
            | + Streams   |              +-------------+
            | + Search    |
            +-------------+
```
</Architecture>

<Deployment>
Single server deployment with Simulabra-native process supervision.

<Supervisor>
A custom Simulabra Supervisor manages service lifecycles:

<SupervisorClass>
- runs as the master process
- hosts the WebSocket RPC server
- spawns child processes for each service using Bun.spawn()
- monitors child process health (exit codes, heartbeats)
- restarts crashed services with exponential backoff (1s, 2s, 4s, 8s... max 60s)
- resets backoff counter after 60s of successful operation
- logs all lifecycle events to stdout/file
</SupervisorClass>

<ServiceSpec>
Each service is defined by a spec:
- name: string (e.g., "DatabaseService")
- command: string[] (e.g., ["bun", "run", "services/database.js"])
- restart_policy: enum (always, on_failure, never)
- max_restarts: number (give up after N consecutive failures, default 10)
- health_check: optional periodic RPC call to verify service is responsive
</ServiceSpec>

<Communication>
- All services connect to master via WebSocket (localhost:3030)
- Uniform protocol whether local or remote
- Master routes messages between services and clients
- Services register their RPC methods on connect
</Communication>
</Supervisor>

<ProcessTree>
```
agenda-supervisor (master)
├── WebSocket Server (:3030)
├── HTTP Server (:3031 for Twilio webhooks)
│
├── [child] database-service
│   └── connects to master via WS
│   └── connects to Redis
│
├── [child] reminder-service
│   └── connects to master via WS
│   └── calls DatabaseService via RPC
│
└── [child] geist-service
    └── connects to master via WS
    └── calls Claude API
    └── calls DatabaseService via RPC
```
</ProcessTree>

<Production>
- Single server accessed via Tailscale
- Run with: `bun run agenda-supervisor`
- Optional: single systemd user unit for the supervisor
- Logs to stdout (journald captures) or ~/agenda/logs/
- Redis runs separately (system service or container)
</Production>

<Configuration>
Environment-based configuration:
- AGENDA_REDIS_URL: Redis connection string
- AGENDA_TWILIO_SID: Twilio account SID
- AGENDA_TWILIO_TOKEN: Twilio auth token
- AGENDA_TWILIO_PHONE: Twilio phone number
- AGENDA_CLAUDE_KEY: Anthropic API key
- AGENDA_PORT: WebSocket server port (default 3030)
- AGENDA_HTTP_PORT: HTTP server port (default 3031)
</Configuration>
</Deployment>

<ImplementationGuidelines>
- use test-driven development
- start with supervisor and database service
- try to keep things simple with the right abstractions
</ImplementationGuidelines>
</ProductRequirementDocument>

<CodeReviewReport>
Review focus: Simulabra-flavored object orientation and abstraction quality in `apps/agenda/` (not feature completeness vs the PRD above).

<ReviewedCode>
- `apps/agenda/src/supervisor.js`
- `apps/agenda/src/services/database.js`
- `apps/agenda/src/services/reminder.js`
- `apps/agenda/src/services/geist.js`
- `apps/agenda/src/models.js`
- `apps/agenda/src/redis.js`
- `apps/agenda/run.js`
- `apps/agenda/bin/agenda.js`
- `apps/agenda/bin/logs.js`
- `apps/agenda/tests/**`
</ReviewedCode>

<FrameworkLens>
Simulabra is a metaobject system: “classes” are themselves objects, and “instances” are primarily compositions of slots.

<ObjectsAreSlotCompositions>
- A class definition is a list of slots (Vars, Methods, Statics, Before/After modifiers, and other classes for inheritance/mixins).
- A slot is an object that knows how to “load” itself onto a prototype, and how to “combine” when multiple slots define the same selector.
- Method composition is first-class (Before/After and `this.next('methodName', ...)`), so wrapper objects are often better than hand-written wrapper functions.
</ObjectsAreSlotCompositions>

<ModulesAreObjectScopes>
- The `.module({ name, imports })` loader provides an object graph boundary: local class space `_`, base class space `$`, and imported class spaces `$live`, `$redis`, etc.
- “Thinking like a caller” usually means: define small objects with explicit slots; keep boundary adapters (FS/Redis/Bun/WebSocket/LLM) thin and reified.
</ModulesAreObjectScopes>
</FrameworkLens>

<WhatAgendaGetsRight>
- Clear slot-based domain modeling: `Log`, `Task`, `Reminder`, `RecurrenceRule` in `apps/agenda/src/models.js`.
- Persistence is reified as a mixin (`RedisPersisted`) instead of scattered ad-hoc Redis calls.
- Services correctly “are” live nodes: `DatabaseService`, `ReminderService`, `GeistService` mix in `$live.NodeClient` and expose `$live.RpcMethod` selectors.
- The test suite is broad and already written in the Simulabra testing style (`apps/agenda/tests/**`).
</WhatAgendaGetsRight>

<BadAbstractionsAndOOFriction>
The theme: several concepts exist as “promise objects” (slots or flags) but are not actually connected to behavior, and several boundaries are implemented as plain functions/global state instead of objects.

<DeadOrMisleadingSlotsAndFlags>
- `apps/agenda/src/supervisor.js`: `ServiceSpec.healthCheckMethod` exists but no health checking uses it; `healthCheckLoop()` only checks connection state.
- `apps/agenda/bin/agenda.js`: `AgendaCLI.supervisorUrl` exists but is unused (connection comes from env vars consumed by `$live.NodeClient`).
- `apps/agenda/src/redis.js`: `RedisVar.indexed` and `RedisVar.searchable` exist but no indexing/search uses them; `DatabaseService.search()` ignores them and scans everything.
- `apps/agenda/src/services/database.js`: `eventStream` and `publishEvent()` exist but nothing consumes the stream; the “event sourcing pattern” is currently a write-only abstraction.
</DeadOrMisleadingSlotsAndFlags>

<GlobalStateWhereAnObjectShouldBe>
- `apps/agenda/src/redis.js`: `globalKeyPrefix` + `setKeyPrefix/getKeyPrefix` are module-level mutable state.
  - This makes keyspace selection implicit, cross-test brittle, and hard to compose (two Redis clients can’t reasonably use different prefixes at once).
  - In Simulabra terms: “the keyspace” wants to be a reified object (or at least a slot on `RedisClient`) instead of a hidden global.
</GlobalStateWhereAnObjectShouldBe>

<PersistenceSemanticsLeak>
- `apps/agenda/src/redis.js`: `RedisPersisted.toRedisHash()` drops `null`/`undefined` fields, and `save()` uses `HSET` without deleting missing fields.
  - Result: you cannot reliably clear a previously-set optional field (e.g. setting `dueDate` to `null` will not remove the old `dueDate` value in Redis).
  - This is a correctness bug disguised as a convenience abstraction; it will surface as “why won’t this update?” at the caller layer.
</PersistenceSemanticsLeak>

<DateTimeSemanticsLeak>
- `apps/agenda/src/models.js`: `RecurrenceRule.nextOccurrence()` mixes local-time methods (`getDay`, `setDate`, `setMonth`) with UTC comparisons (`setUTCHours` in `endOfDay`).
  - Because persisted times are ISO (UTC) and user intent is “wall clock”, this needs an explicit “time semantics” object: either commit to UTC arithmetic everywhere, or commit to a configured timezone and be consistent.
</DateTimeSemanticsLeak>

<DuplicatedOrHalf-UsedMessageRouting>
- `apps/agenda/src/supervisor.js` re-implements a handler registry (`handlers`) and dispatch rather than composing `$live.MessageDispatcher`.
- `src/live.js` includes a `register` message path on the client, but `apps/agenda/src/supervisor.js` has no `register` handler; that makes “registration” a dead protocol branch in this app.
</DuplicatedOrHalf-UsedMessageRouting>

<ToolsAsStringsInsteadOfObjects>
- `apps/agenda/src/services/geist.js` has two parallel representations of “a tool”:
  - a JSON tool definition in `tools()` (for the LLM)
  - a `switch (toolName)` in `executeTool()` (actual implementation)
- This is exactly the kind of duplication Simulabra’s slot composition is good at avoiding: “Tool” wants to be an object with slots `{ name, schema, execute }`.
</ToolsAsStringsInsteadOfObjects>

<ScriptsOutsideTheObjectWorld>
- `apps/agenda/bin/logs.js` is pure script (functions + mutable globals) even though the repo guideline is “ALWAYS use Simulabra for new scripts and functionality”.
  - This matters because it prevents reuse/composition/testing the log streamer behavior the same way other behaviors are tested.
</ScriptsOutsideTheObjectWorld>

<MinorLeakyEdges>
- Service identity is duplicated: `ServiceSpec.serviceName` must match each service script’s `uid` by convention; it’s easy to drift.
- `Supervisor.stopAll()` stops children but does not stop the Bun WebSocket server (no server handle is stored/closed); “stop” is a partial stop.
- `ManagedService.start()` shell-builds a command string from an argv array (`cmd.join(' ')`); it works for current fixed commands, but the abstraction claims “command array” while implementing “shell string”.
</MinorLeakyEdges>
</BadAbstractionsAndOOFriction>

<RefactoringOutline>
Goal: make Agenda read like an object graph where each boundary concept is reified (Tool, Keyspace, HealthCheck, LogSink), and remove “promise flags” that are not wired to behavior.

<Phase1_UnifyToolModel>
Replace the “tool definition array + switch statement” split with Tool objects.
- Add `Tool` + `ToolRegistry` classes (e.g. `apps/agenda/src/tools.js` or `apps/agenda/src/services/tools.js`).
- Each tool is an object with slots:
  - `name` (string)
  - `definition` (returns the JSON schema entry for Anthropic tools)
  - `execute({ services, args })` (performs RPC calls / domain actions)
- `GeistService.tools()` becomes `this.toolRegistry().definitions()`; `executeTool()` becomes `this.toolRegistry().execute(toolName, args)`.
Payoff: single source of truth; tools become composable, testable, and can use method modifiers for logging/validation.
</Phase1_UnifyToolModel>

<Phase2_ReifyKeyspaceAndFixRedisPersistedSemantics>
- Replace `setKeyPrefix/getKeyPrefix` with an explicit object/slot:
  - Option A: `RedisClient.keyPrefix` Var and `RedisPersisted.keyPrefix(redisClient)` uses it.
  - Option B: `Keyspace` object with `prefix` and `keyFor(className, id)` helpers.
- Fix “clearing optional fields”:
  - Track nulls explicitly (e.g. store a sentinel string) or issue `HDEL` for fields that are now null.
  - Add a test case that sets a value, saves, clears it, saves again, and verifies it is actually cleared in Redis.
- Replace `KEYS` usage (`RedisClient.keys`) with `SCAN` (add `scan` helper) once the data size matters.
</Phase2_ReifyKeyspaceAndFixRedisPersistedSemantics>

<Phase3_StandardizeTimeSemantics>
- Introduce an explicit time policy object (UTC arithmetic or configured timezone).
- Update `RecurrenceRule.nextOccurrence()` to use one consistent family (`getUTC*`/`setUTC*` if committing to UTC).
- Add tests that cover:
  - weekly `daysOfWeek` behavior near DST boundaries
  - end-date cutoff semantics (inclusive/exclusive) in the chosen policy
</Phase3_StandardizeTimeSemantics>

<Phase4_SupervisorAsACompositionOfLiveParts>
- Rework `Supervisor` to compose `$live.MessageDispatcher` instead of reimplementing handler maps:
  - `Supervisor` slots include `$live.MessageDispatcher`, `nodes`, `services`, etc.
  - Service connection/disconnection becomes a first-class “NodeRegistry” object.
- Implement real health checking using `ServiceSpec.healthCheckMethod`:
  - A `HealthCheck` object calls `serviceProxy({ name }).[healthCheckMethod]()` with timeout.
  - Unhealthy transitions should be explicit state on `ManagedService` (and ideally drive restart policy).
This makes ServiceSpec “honest”: its slots change behavior.
</Phase4_SupervisorAsACompositionOfLiveParts>

<Phase5_ServiceIdentityAndBootstrapping>
- Remove the convention leak where service uid must match spec name:
  - Either derive `uid` from env set by `ManagedService.start()` (e.g. `AGENDA_SERVICE_NAME`)
  - Or have a common `AgendaService` base that sets `uid` to `this.class().name` by default and have ServiceSpec use that exact value.
- Centralize startup in a single object that owns the process tree (Supervisor + specs + log sinks + shutdown policy).
</Phase5_ServiceIdentityAndBootstrapping>

<Phase6_ObjectifyTheScripts>
- Convert `apps/agenda/bin/logs.js` into a Simulabra module with classes like `LogStreamer` + `FileTail`.
- Keep the bin entrypoint minimal: load module, instantiate object, call `.run()`.
Payoff: composability and test coverage for operational tooling.
</Phase6_ObjectifyTheScripts>
</RefactoringOutline>
</CodeReviewReport>

<RefactoringProgress>
<Phase1_UnifyToolModel status="COMPLETE">
Completed: 2026-01-13

<FilesChanged>
- Created: `apps/agenda/src/tools.js` - Tool, ToolRegistry, and 7 concrete tool classes
- Updated: `apps/agenda/src/services/geist.js` - Now uses ToolRegistry
- Created: `apps/agenda/tests/tools.js` - Unit tests for tool model
</FilesChanged>

<Implementation>
Created a unified tool model where each tool is a self-contained Simulabra object:

```
Tool (base class)
├── toolName() - the API name for Claude
├── doc() - description shown to LLM
├── inputSchema() - JSON schema for parameters
├── definition() - returns Anthropic tool format
└── execute(args, services) - virtual, implemented by subclasses

ToolRegistry
├── tools() - array of registered Tool objects
├── register(tool) - add a tool
├── get(name) - lookup by name
├── definitions() - all tool definitions for Claude API
└── execute(toolName, args, services) - dispatch to correct tool

AgendaToolRegistry extends ToolRegistry
└── Auto-registers all 7 tools on init

Concrete Tools:
- CreateLogTool
- CreateTaskTool
- CompleteTaskTool
- CreateReminderTool
- SearchTool
- ListTasksTool
- ListLogsTool
```
</Implementation>

<DesignNotes>
- Used `toolName()` Var instead of `name` Property due to Simulabra inheritance behavior with Property defaults
- Each tool overrides `toolName`, `doc`, `inputSchema` with defaults, and implements `execute()`
- `GeistService.tools()` retained for backwards compatibility, delegates to `toolRegistry().definitions()`
- Tools can be tested in isolation with mocked services: `registry.execute('create_log', args, { db: mockDb })`
</DesignNotes>

<TestsCovering>
- Tool base class slots and definition generation
- ToolRegistry register/lookup/definitions
- AgendaToolRegistry pre-configuration with all 7 tools
- Tool input schema validation
- Execute with mocked services
- Error handling for unknown tools
- Anthropic API format compliance
</TestsCovering>
</Phase1_UnifyToolModel>

<Phase2_ReifyKeyspaceAndFixRedisPersistedSemantics status="COMPLETE">
Completed: 2026-01-13

<FilesChanged>
- Updated: `apps/agenda/src/redis.js` - Added keyPrefix slot to RedisClient, reified keyspace, fixed null field clearing
- Updated: `apps/agenda/tests/redis.js` - Updated to use new keyPrefix pattern, added null clearing test
- Updated: `apps/agenda/tests/integration.js` - Updated to use client.keyPrefix() instead of setKeyPrefix()
</FilesChanged>

<Implementation>
1. **Reified Keyspace as RedisClient.keyPrefix slot**:
   - Added `keyPrefix` Var to `RedisClient` with default ''
   - Updated `RedisPersisted.keyPrefix(redis)` to take redis client and use `redis.keyPrefix()`
   - Updated `indexKey(redis)`, `redisKey(redis)` to take redis argument
   - Removed global `setKeyPrefix/getKeyPrefix` functions

2. **Fixed null field clearing bug**:
   - Changed `toRedisHash()` to return `{ hash, nullFields }` instead of just hash
   - Updated `save(redis)` to call `hDel` on nullFields after `hSet` on hash
   - Added `hDel` method to `RedisClient`

3. **Added SCAN for scalability**:
   - Added `scan(pattern, count)` method to `RedisClient` using cursor-based iteration
   - Existing `keys()` method preserved for backwards compatibility
</Implementation>

<DesignNotes>
- Chose Option A from plan: `RedisClient.keyPrefix` slot rather than separate Keyspace class
- This is simpler and more direct - keyspace is bound to the client connection
- Tests set prefix via `client.keyPrefix('test:prefix:')` instead of module-level function
- Static methods like `keyPrefix(redis)`, `indexKey(redis)` now take redis as first arg
- Null field clearing uses HDEL which properly removes fields from the hash
</DesignNotes>

<TestsCovering>
- RedisPersistedNullFieldClearing: Sets value, saves, clears to null, saves again, verifies cleared
- RedisClientKeyPrefix: Verifies keys start with correct prefix when set
- RedisClientScan: Verifies SCAN returns all matching keys
- All existing redis tests updated to pass redis to redisKey()
</TestsCovering>
</Phase2_ReifyKeyspaceAndFixRedisPersistedSemantics>

<Phase3_StandardizeTimeSemantics status="PENDING">
Next phase. Will address:
- Introduce explicit time policy object (UTC arithmetic or configured timezone)
- Update `RecurrenceRule.nextOccurrence()` to use consistent date methods
- Add tests for DST boundary behavior
</Phase3_StandardizeTimeSemantics>
<Phase4_SupervisorAsACompositionOfLiveParts status="PENDING" />
<Phase5_ServiceIdentityAndBootstrapping status="PENDING" />
<Phase6_ObjectifyTheScripts status="PENDING" />
</RefactoringProgress>
