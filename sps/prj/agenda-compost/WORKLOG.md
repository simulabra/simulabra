# WORKLOG — agenda-compost

## 2026-02-13

### Session Start
- Task: Review agenda app's Simulabra usage, produce prompt alignment document
- Approach: Deep exploration of all agenda source files, comparison against Simulabra core patterns
- Deliverable: A document with audit findings and proposed prompt updates for the agent

### Phase 1: Audit Findings Document
- Read all 12 source files (models, tools, sqlite, supervisor, provider, database service, geist service, reminder service, run.js, eval framework, eval trace, CLAUDE.md)
- Verified every finding from the architect's plan against actual source code with corrected line numbers
- Verified underused capabilities against src/base.js (EnumVar at 1434, Virtual at 976, Configurable at 1559) and src/db.js (search static at 325)
- Confirmed FTS5 infrastructure is fully built (migrations 003, 005, 006, 007) but unused by DatabaseService.search
- Confirmed interpret/interpretMessage duplication: 7 nearly identical sections across ~90 lines each
- Confirmed CLAUDE.md is stale: references Redis in 7+ places, missing Projects/Haunts/Evals/Provider entirely
- Added observations not in original plan: notification handler callbacks, repeated connectToDatabase, health check overrides
- Output: `sps/prj/agenda-compost/docs/audit.md` — 5 sections, 12 findings with file:line references, prioritized action table

## 2026-02-14

### Phase 2: Prompt Alignment Document
- Read current stale CLAUDE.md (85 lines, references Redis throughout)
- Read current geist system prompts (geist.js:22-87)
- Read root CLAUDE.md for overall Simulabra coding standards
- Cross-referenced actual test files (18 test files found via glob vs 6 listed in stale CLAUDE.md)
- Verified EnumVar API (base.js:1434 — `choices` required, setter validates, inherits Var)
- Verified Virtual API (base.js:976 — throws "not implemented" if not overridden)
- Wrote Part 1: complete CLAUDE.md replacement (13 sections covering architecture, models, tools, services, persistence, provider, evals, launch points, testing, debugging, patterns, anti-patterns, development)
- Wrote Part 2a: revised main system prompt — added data model section, explicit tool mapping with critical distinctions, time parsing guidance, multi-step operation examples
- Wrote Part 2b: revised haunt generation prompt — added priority tiers (high/medium/low), explicit skip criteria, concrete output format guidance
- Wrote Part 3: 13-item refactoring roadmap with priority (P1-P3), effort estimates, affected files, and impact descriptions
- Included motivating code examples for all 5 underused Simulabra features: EnumVar, Virtual, Before/After beyond init, Static methods over functions, FTS5 search
- Output: `sps/prj/agenda-compost/docs/prompt-alignment.md` — 4 parts, self-contained reference document

### Phase 2 Revision: Split General vs Agenda-Specific
- User feedback: general Simulabra patterns belong in root CLAUDE.md, not agenda CLAUDE.md
- Restructured document from 3 parts to 4 parts:
  - Part 1: Proposed additions to root CLAUDE.md (new `<Patterns>` and `<AntiPatterns>` sections)
  - Part 2: Proposed agenda CLAUDE.md (app-specific only — architecture, models, tools, services, etc.)
  - Part 3: Revised geist system prompts (unchanged)
  - Part 4: Refactoring roadmap (item 1 now covers both CLAUDE.md files)
- Removed SimulabraPatterns and AntiPatterns sections from agenda CLAUDE.md proposal
- Root CLAUDE.md additions include code examples for: EnumVar, Virtual, Before/After, Static methods, FTS5, DBVar vs Var, Configurable, reification

## 2026-02-16

### Phase 7: Dead Code Audit and Yard Migration

#### Research (done earlier this session)
- Traced import graph from all entry points
- Identified 17 files across 2 categories (confirmed dead, legacy/test-only)
- Produced docs/dead-code.md with full manifest and fixup list

#### Execution
- Verified all 17 target files exist before moving
- **Critical finding**: `bin/pm-runner.js` is NOT dead — `PMController.start()` in `src/pm.js:487` actively spawns it via `Bun.spawn`. Excluded from yard migration.
- Moved 16 files to `/home/ras/projects/simulabra/yard/` preserving directory structure:
  - Section 1 (confirmed dead): `contexts/master.js`, `misc/protobench.js`, `misc/doc/simulabra-x.jsx`, `misc/doc/syntax.txt`, `misc/lisp.txt`, `misc/live.txt`, 7 files in `misc/prompts/`
  - Section 2 (legacy): `demos/agenda.js`, `tests/agenda.js`, `tests/bf.js`, `apps/agenda/src/redis.js`
- Removed empty directories: `contexts/`, `misc/prompts/`

#### Fixups Applied
- Removed dead `"agent"` and `"serve"` scripts from `package.json` (referenced nonexistent `src/agent.js`)
- Updated `apps/agenda/tests/redis.js` to import from `simulabra/db` directly (replaced all `$redis.` → `$db.`)
- Removed redis.js import and `$redis` scope param from 4 test files: `integration.js`, `chat.js`, `services/geist.js`, `services/reminder.js`
- Removed stale `$redis.` silenced prefix from `tests/support/helpers.js`
- Updated 3 stale references in `misc/doc/simulabra.md` (removed mentions of `demos/agenda.js`)

#### Verification (initial)
- `bun run test` passes: 186 cases across 12 modules
- Legacy `test.agendas` (5 cases) and `test.bf` (5 cases) no longer auto-discovered
- No dangling code imports remain
- Documentation references cleaned up

#### Redis Test Cleanup (extended scope)
- User identified that Redis is no longer used anywhere in production code — the agenda app fully migrated to SQLite
- All 3 remaining Redis-dependent test files (`integration.js`, `chat.js`, `redis.js`) were yarded — their coverage already exists in `tests/services/database.js` (52 test cases)
- `tests/services/geist.js` and `tests/services/reminder.js` were fully rewritten:
  - Replaced Redis setup (`connectRedis()`) with SQLite in-memory pattern (`DatabaseService.new({ dbPath: ':memory:' })`)
  - Converted all async method calls from `$test.Case` (sync) to `$test.AsyncCase` (async) — `executeTool`, `checkDueReminders`, `collectNotifications`, `triggerNotification` all return promises
  - Removed `buildMessages` test from geist.js (method no longer exists on GeistService)
  - Both files now pass: 13 geist tests, 13 reminder tests

#### Production Bug Found
- `src/services/reminder.js:62`: `await db.markReminderSent({ id: reminder.rid })` — `db` is undefined, `rid` is not a field
- Fixed to: `this.dbService().markReminderSent({ id: reminder.id })`
- This bug would crash the service every time it tried to process a due reminder

#### Final Verification
- Core tests: 186 cases across 12 modules — all pass
- Agenda service tests: geist (13), reminder (13), database (52), models (60), tools (17), sqlite (13), supervisor (45), time (22), task-filtering (13), evals-report (12), provider (20), geist-prompts (34) — all pass
- Pre-existing failure in `tests/logs.js` (ANSI color mismatch, unrelated to our changes)

### Phases 8-12: Test Coverage Planning

#### Coverage Audit
- Listed all source classes/slots via `bin/lister.js` for all 11 source files
- Cross-referenced against all 12 test modules (314 tests total)
- Well covered: models (60), supervisor (45), database (52), provider (20), time (22)
- Moderate coverage: geist-prompts (34), geist service (13), tools (17), reminder (13)
- Bugs found: logs.js has 2 (ANSI color test uses wrong class, method name typo)

#### Gaps Identified
- logs.js: 2 bugs (LogFormatter vs AgendaLogFormatter, serviceNameFromFile vs sourceNameFromFile)
- GeistService.executeTool: 6 of 14 tools untested (update_task, create/list/update_project, move_to_project, trigger_webhook)
- DatabaseService: hideChatMessages, publishEvent untested
- Models: Task.toggle(), Model.search (FTS5) not tested at model level
- Scheduler: ScheduledJob.run/calculateNextRun, Scheduler.register/unregister untested
- GeistService: cachedSystem/cachedTools/isAnthropicProvider, scheduler lifecycle untested
- HauntAction: DoneAction, BacklogAction, SnoozeAction, DismissAction only tested end-to-end

#### Plans Written
- `plan/phase8-fix-logs-tests.md` — fix 2 bugs, add AgendaLog tests (~8 new tests)
- `plan/phase9-geist-tool-coverage.md` — 6 missing tools + webhook (~12 new tests)
- `plan/phase10-database-model-gaps.md` — hideChatMessages, publishEvent, Task.toggle, FTS5 (~12 new tests)
- `plan/phase11-scheduler-coverage.md` — ScheduledJob, Scheduler, GeistService scheduler (~14 new tests)
- `plan/phase12-caching-hauntaction.md` — caching helpers, HauntAction isolation (~14 new tests)
- Total: ~60 new tests planned, bringing suite from 314 to ~374

## 2026-02-17

### Phase 8: Fix logs.js Test Bugs + AgendaLog Coverage

#### Files Modified
- `apps/agenda/tests/logs.js`

#### Bug Fixes
1. **LogFormatterColorFor** (was line 134): Test created base `LogFormatter` but asserted agenda-specific colors. Renamed to `BaseLogFormatterDefaultColor`, now correctly asserts white (`\x1b[37m`) for all source names.
2. **LogFormatterFormat** (was line 146): Same root cause — asserted cyan for supervisor via base formatter. Fixed assertion to check for white default color.
3. **LogStreamerServiceNameFromFile** (was line 174): Called nonexistent `serviceNameFromFile()`. Fixed to `sourceNameFromFile()` matching source definition at `src/logs.js:117`. Renamed test to `LogStreamerSourceNameFromFile`.

#### New Tests Added (3)
- `AgendaLogFormatterColors`: Verifies all 4 agenda color mappings (supervisor→cyan, DatabaseService→green, ReminderService→yellow, GeistService→magenta) plus unknown→white fallback.
- `AgendaLogFormatterFormat`: Verifies `format('GeistService', msg)` includes magenta ANSI code.
- `AgendaLogStreamerDefaultFormatter`: Verifies `AgendaLogStreamer.new()` creates an `AgendaLogFormatter` as its default formatter via `.class()` identity check.

#### Verification
- `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/logs.js` — 19 test cases passed
- `bun run test` (core) — 186 cases across 12 modules, all pass
- Agenda tests — 255 non-service + 78 service = 333 total, all pass

#### Acceptance Criteria
- [x] All existing log tests pass (2 bugs fixed + 1 latent color assertion)
- [x] Base LogFormatter color behavior tested separately from AgendaLogFormatter
- [x] AgendaLogFormatter and AgendaLogStreamer have direct tests
- [x] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/logs.js` passes
- [x] `bun run test` clean

### Phase 9: GeistService executeTool Coverage for Remaining Tools

#### Files Modified
- `apps/agenda/tests/services/geist.js`

#### Tests Added (9)
1. **GeistServiceExecuteUpdateTask**: Creates task, updates title and priority via `update_task`. Asserts modified fields in result.
2. **GeistServiceExecuteCreateProject**: Creates project with title, slug, context via `create_project`. Asserts `$class: 'Project'` and fields.
3. **GeistServiceExecuteListProjects**: Creates 2 projects, lists via `list_projects`. Asserts length >= 2.
4. **GeistServiceExecuteUpdateProject**: Creates project, updates title and context via `update_project`. Asserts updated fields.
5. **GeistServiceExecuteMoveToProject**: Creates task + project, moves task via `move_to_project` with `projectId`. Asserts `projectId` on result.
6. **GeistServiceExecuteMoveToProjectBySlug**: Same but resolves project via `projectSlug` instead of `projectId`. Tests the slug resolution code path in MoveToProjectTool.
7. **GeistServiceExecuteMoveLogToProject**: Moves a log entry to a project. Tests the `log` branch of the MoveToProjectTool switch.
8. **GeistServiceExecuteMoveToProjectUnknownType**: Passes `itemType: 'invalid'`. Asserts `success: false` with "Unknown item type" error.
9. **GeistServiceExecuteTriggerWebhook**: Spins up a real `Bun.serve({ port: 0 })` HTTP server, fires `trigger_webhook` with a payload, asserts the server received the correct POST body. Server is torn down in finally block.

#### Verification
- `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` — 22 test cases passed (was 13)
- `bun run test` (core) — 186 cases, all pass
- Agenda tests — 255 non-service + 87 service = 342 total, all pass

#### Acceptance Criteria
- [x] All 14 tools have at least one `executeTool` integration test through GeistService
- [x] `trigger_webhook` test uses a real HTTP server (not mocked fetch)
- [x] Error cases covered (unknown item type in move_to_project)
- [x] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` passes
- [x] `bun run test` clean

### Phase 10: DatabaseService Gaps + Model-Level Tests

#### Files Modified
- `apps/agenda/tests/services/database.js`
- `apps/agenda/tests/models.js`

#### Tests Added (10)

**hideChatMessages (3 tests in database.js)**
1. **DatabaseServiceHideChatByIds**: Appends 3 chat messages, hides 2 by internalIds. Asserts `{ hidden: 2 }` and that `listChatMessages` returns only the unhidden message.
2. **DatabaseServiceHideChatBySinceMinutes**: Appends 2 messages, hides with `sinceMinutes: 5`. Asserts all recent messages hidden and list returns empty.
3. **DatabaseServiceHideChatNoArgs**: Appends a message, calls `hideChatMessages({})` with no ids/sinceMinutes. Asserts `{ hidden: 0 }` and message still visible.

**publishEvent (2 tests in database.js)**
4. **DatabaseServicePublishEventOnCreate**: Creates a task, reads from `service.eventStream().readLatest(10)`. Finds event with `type: 'task.created'` and matching task id.
5. **DatabaseServicePublishEventOnReminder**: Creates a reminder, reads event stream. Finds event with `type: 'reminder.created'` and matching reminder id.

**Task.toggle (2 tests in models.js)**
6. **TaskToggleDoneToUndone**: Creates task, calls `complete()`, then `toggle()`. Asserts `done()` is false and `completedAt()` is null.
7. **TaskToggleUndoneToDone**: Creates task (not done), calls `toggle()`. Asserts `done()` is true and `completedAt()` is a Date.

**FTS5 Model.search (3 tests in models.js)**
8. **ModelSearchFTS5Tasks**: Creates 3 tasks, searches for "groceries OR grocery". Asserts 2 matching tasks returned via FTS5 index.
9. **ModelSearchFTS5Logs**: Creates 3 logs, searches for "Alice". Asserts 2 matching logs returned via FTS5 index.
10. **ModelSearchFTS5NoResults**: Creates tasks and logs, searches for "xyznonexistent". Asserts empty arrays from both Task.search and Log.search.

#### Verification
- `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/database.js` — 57 test cases passed (was 52)
- `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/models.js` — 65 test cases passed (was 60)
- `bun run test` (core) — 186 cases across 12 modules, all pass
- Agenda tests — 260 non-service + 92 service = 352 total, all pass

#### Acceptance Criteria
- [x] `hideChatMessages` covered for both modes (by ids, by sinceMinutes) plus edge case
- [x] `publishEvent` verified for 2 event types (task.created, reminder.created)
- [x] `Task.toggle()` tested directly at model level (both directions)
- [x] FTS5 `Model.search` tested directly (not just through DatabaseService.search)
- [x] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/database.js` passes
- [x] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/models.js` passes
- [x] `bun run test` clean

### Phase 11: Scheduler and Time System Coverage

#### Files Modified
- `apps/agenda/tests/time.js`
- `apps/agenda/tests/services/geist.js`

#### Tests Added (11)

**ScheduledJob (3 tests in time.js)**
1. **ScheduledJobRun**: Creates job with mock action counter, calls `run()`. Asserts action called once and `lastRunAt()` is a Date.
2. **ScheduledJobRunDisabled**: Creates job with `enabled: false`, calls `run()`. Asserts action NOT called and `lastRunAt()` remains undefined.
3. **ScheduledJobCalculateNextRun**: Creates job with TimeOfDaySchedule, calls `calculateNextRun('UTC')`. Asserts returns a future Date and stores it in `nextRunAt()`.

**Scheduler (5 tests in time.js)**
4. **SchedulerRegister**: Registers a job, asserts `jobs()` Map contains it by jobName key.
5. **SchedulerUnregister**: Registers then unregisters a job, asserts `jobs()` no longer has it.
6. **SchedulerStartSchedulesJobs**: Registers job, starts scheduler, asserts `timers()` has entry for jobName. Stops in finally block.
7. **SchedulerStopClearsTimers**: Starts scheduler with job, asserts timers exist, stops scheduler, asserts `timers().size` is 0.
8. **SchedulerRegisterWhileRunning**: Starts scheduler with one job, registers second job while running. Asserts second job gets a timer immediately. Stops in finally block.

**GeistService scheduler (3 tests in services/geist.js)**
9. **GeistServiceInitScheduler**: Sets `promptTimes(['08:00'])`, calls `initScheduler()`. Asserts `scheduler()` exists and has a 'generateHaunts' job.
10. **GeistServiceStartStopScheduler**: Calls `startScheduler()`, asserts `scheduler().running()` is true. Calls `stopScheduler()`, asserts false. Uses finally block for cleanup.
11. **GeistServiceStopSchedulerNoInit**: Calls `stopScheduler()` without prior init. Asserts no error thrown and `scheduler()` remains undefined.

#### Verification
- `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/time.js` — 30 test cases passed (was 22)
- `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` — 25 test cases passed (was 22)
- `bun run test` (core) — all modules pass
- All agenda tests pass

#### Acceptance Criteria
- [x] `ScheduledJob.run()` and `calculateNextRun()` directly tested
- [x] `Scheduler.register()` and `unregister()` tested with job tracking verification
- [x] `Scheduler.start()` creates timers, `stop()` clears them
- [x] GeistService scheduler lifecycle tested (init/start/stop)
- [x] All timers properly cleaned up (no leaked timers causing test hangs)
- [x] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/time.js` passes
- [x] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` passes
- [x] `bun run test` clean

### Phase 12: GeistService Caching Helpers + HauntAction Isolation Tests

#### Files Modified
- `apps/agenda/tests/services/geist.js`

#### Tests Added (13)

**Caching helpers (7 tests)**
1. **GeistServiceIsAnthropicProviderTrue**: Sets mock client with `provider: () => 'anthropic'`. Asserts `isAnthropicProvider()` returns true.
2. **GeistServiceIsAnthropicProviderFalse**: Sets mock client with `provider: () => 'openrouter'`. Asserts false.
3. **GeistServiceIsAnthropicProviderNoClient**: Sets `client(undefined)`. Asserts false without crash.
4. **GeistServiceCachedSystemAnthropicWraps**: Anthropic provider — asserts `cachedSystem('prompt')` returns array with `{ type: 'text', text: 'prompt', cache_control: { type: 'ephemeral' } }`.
5. **GeistServiceCachedSystemNonAnthropicPassthrough**: Non-Anthropic — asserts `cachedSystem('prompt')` returns raw string `'prompt'`.
6. **GeistServiceCachedToolsAnthropicAddsCache**: Anthropic — asserts last tool has `cache_control.type === 'ephemeral'`, first tool does not.
7. **GeistServiceCachedToolsNonAnthropicClean**: Non-Anthropic — asserts no tools have `cache_control`.

**HauntAction isolation (4 tests)**
8. **DoneActionExecute**: Creates `DoneAction`, calls `execute(mockItem, null)`. Asserts `{ status: 'actioned' }` and `onDone` was called.
9. **BacklogActionExecute**: Same pattern for `BacklogAction` and `onBacklog`.
10. **SnoozeActionExecute**: Asserts returns `{ status: 'pending', snoozeUntil }` with `snoozeUntil` approximately 24h in the future (within 5s tolerance).
11. **DismissActionExecute**: Asserts returns `{ status: 'dismissed' }`.

**TaskHauntItem with real DB (2 tests)**
12. **TaskHauntItemOnDone**: Creates task via real DatabaseService, calls `TaskHauntItem.new({ itemId }).onDone(dbService)`. Asserts task is now `done: true`.
13. **TaskHauntItemOnBacklog**: Same setup, calls `onBacklog(dbService)`. Asserts task `priority` changed to 5.

#### Verification
- `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` — 38 test cases passed (was 25)
- `bun run test` (core) — all modules pass

#### Acceptance Criteria
- [x] All caching methods tested for both Anthropic and non-Anthropic providers
- [x] Null client edge case does not crash `isAnthropicProvider`
- [x] Each HauntAction subclass has an isolated unit test for `execute()`
- [x] `TaskHauntItem.onDone()` and `onBacklog()` tested with real DB
- [x] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` passes
- [x] `bun run test` clean
