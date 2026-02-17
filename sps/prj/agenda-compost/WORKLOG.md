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
