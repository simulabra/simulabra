# Phase 1: Eval Framework, Seed Database, and Runner

Build the foundational eval infrastructure: a seeded test database, a trace-capturing client wrapper, the EvalCase class, a runner script, and 3 basic scenarios to prove the system end-to-end.

## Architecture

Three layers:

1. **Seed** — deterministic function that populates an in-memory SQLite DB with realistic data
2. **Framework** — `EvalCase` class that creates an isolated environment per scenario, runs the eval, captures traces
3. **Runner** — standalone script that orchestrates cases and writes inspectable output

## Seed Function — `apps/agenda/evals/seed.js`

Exports `seedDatabase(dbService)` that creates deterministic data via the DatabaseService CRUD methods (createProject, createTask, createLog, createReminder).

Data to seed:

**Projects (3)**:
- "House Renovation" (slug: house, context: "Kitchen remodel and bathroom update. Budget: $15k.")
- "Side Project" (slug: side-project, context: "Building a recipe tracker web app in Simulabra.")
- "Fitness" (slug: fitness, context: "Training for a half marathon in June.")

**Tasks (10-12)**:
- House: "Research countertop materials" (P2), "Get plumber quote" (P1, due 2 days from now), "Pick paint colors" (P3), "Order cabinet hardware" (P4, completed)
- Side Project: "Set up database schema" (P2, completed), "Build recipe input form" (P2), "Add search functionality" (P3)
- Fitness: "Plan workout schedule" (P3, tag: planning), "Buy running shoes" (P2)
- Inbox: "Call dentist" (P3), "Renew car registration" (P1, due yesterday), "Read simulabra docs" (P4)

**Logs (5-6)**:
- House: "Met with contractor, decided on quartz countertops for kitchen island", "Bathroom tile samples arrived — prefer the grey slate"
- Side Project: "Sketched out the data model: recipes have ingredients, steps, tags"
- Inbox: "Interesting talk on distributed systems at the meetup", "Need to look into that new bun release"

**Reminders (3)**:
- House: "Call contractor about timeline" (trigger: tomorrow 10am, pending)
- Inbox: "Take vitamins" (trigger: today 8am, sent)
- Inbox: "Weekly review" (trigger: next Monday 9am, pending, recurrence: weekly)

Returns `{ projects, tasks, logs, reminders }` mapping titles to created records (with IDs) so scenarios can reference them.

Reference: `createTestServices` pattern from `apps/agenda/tests/geist-prompts.js:49-59`.

## TraceCapture — `apps/agenda/evals/trace.js`

A Simulabra class wrapping the real Anthropic client. NOT a mock — delegates all calls and records the interaction.

Slots:
- `client` — the real `Anthropic` instance
- `traces` — array, default `[]`

The `messages` getter returns `{ async create(params) }` that:
1. Records `start = Date.now()`
2. Calls `this.client().messages.create(params)`
3. Pushes `{ timestamp, request: params, response, durationMs }` to traces
4. Returns the response

Same interface shape as `MockAnthropicClient` from tests — plugs into `geistService.client(traceCapture)`.

Reference: `MockAnthropicClient` in `apps/agenda/tests/geist-prompts.js:21-47` for interface shape.

## EvalCase — `apps/agenda/evals/framework.js`

Standalone Simulabra class (does NOT extend $test.AsyncCase — evals are separate from unit tests).

Slots:
- `title` — descriptive name
- `scenario` — `async function(ctx)` containing the eval logic
- `result` — populated after run

The `run()` method:
1. Creates in-memory SQLite via `createTestDb()` (same pattern as tests)
2. Creates real Anthropic client from `ANTHROPIC_API_KEY`, wraps in TraceCapture
3. Wires up `DatabaseService` + `GeistService` with the trace-capturing client
4. Calls `seedDatabase(dbService)` to prepopulate
5. Builds context object `ctx`:
   - `ctx.geist` — GeistService
   - `ctx.db` — DatabaseService
   - `ctx.seed` — the seed return value (record references)
   - `ctx.trace` — TraceCapture instance
   - `ctx.interpret(input)` — convenience: calls `geist.interpret(input)`
   - `ctx.assertToolCalled(result, toolName)` — checks toolsExecuted array
   - `ctx.assertToolNotCalled(result, toolName)` — negative check
6. Invokes `this.scenario()(ctx)`
7. Catches errors, builds result: `{ title, success, error?, traces: trace.traces(), durationMs }`
8. Closes database

## Runner — `apps/agenda/evals/run.js`

Standalone entry point: `bun run apps/agenda/evals/run.js [optional-filter]`

1. Loads `.env` from core directory for `ANTHROPIC_API_KEY`
2. Imports all scenario modules from `evals/scenarios/`
3. Collects all EvalCase instances (via Simulabra module instance registry)
4. If a filter arg is given, runs only matching cases (substring match on title)
5. Runs each case sequentially, prints per-case summary to stdout:
   ```
   [PASS] Create a task from natural language (3.2s)
     tools: create_task
   [FAIL] Search for existing items (2.8s)
     error: Expected search tool to be called
   ```
6. Writes detailed JSON report to `apps/agenda/evals/results/eval-{timestamp}.json`
7. Prints final summary: N passed, M failed, total duration
8. Exits with code 1 if any failures

JSON report structure:
```json
{
  "timestamp": "2026-02-05T14:30:00Z",
  "results": [
    {
      "title": "...",
      "success": true,
      "durationMs": 3200,
      "traces": [ { "timestamp", "request", "response", "durationMs" } ],
      "toolsExecuted": [ { "tool", "input", "result" } ]
    }
  ],
  "summary": { "passed": 3, "failed": 0, "totalDurationMs": 9500 }
}
```

## Initial Scenarios — `apps/agenda/evals/scenarios/basic.js`

Three scenarios to prove the framework:

**1. "Create a task from natural language"**
- Input: `"add a task: buy new kitchen tiles, high priority, for the house renovation project"`
- Assert: `create_task` tool called
- Assert: result is successful

**2. "Search for existing items"**
- Input: `"find my notes about countertops"`
- Assert: `search` tool called
- Assert: result is successful

**3. "Create a new project"**
- Input: `"start a new project called garden for landscaping the backyard"`
- Assert: `create_project` tool called
- Assert: result is successful

Keep assertions loose — verify tool selection, not exact args (LLM is nondeterministic).

## Files to Create

| File | Purpose |
|------|---------|
| `apps/agenda/evals/seed.js` | Deterministic database seeding |
| `apps/agenda/evals/trace.js` | TraceCapture Anthropic client wrapper |
| `apps/agenda/evals/framework.js` | EvalCase class + context helpers |
| `apps/agenda/evals/run.js` | Runner script |
| `apps/agenda/evals/scenarios/basic.js` | 3 initial scenarios |

## Files to Modify

| File | Change |
|------|--------|
| `apps/agenda/package.json` | Add `"evals"` script |
| `apps/agenda/.gitignore` | Ignore `evals/results/*.json` |

## Key References

- `apps/agenda/tests/geist-prompts.js:11-59` — createTestDb, MockAnthropicClient, createTestServices
- `apps/agenda/src/services/geist.js:230-318` — interpret() method (the main entry point for evals)
- `apps/agenda/src/services/database.js:20-45` — initDatabase pattern
- `apps/agenda/src/tools.js:621-646` — AgendaToolRegistry

## Acceptance Criteria

- [ ] `seedDatabase` creates 3 projects, 10+ tasks, 5+ logs, 3 reminders
- [ ] `TraceCapture` records all API calls with request/response/timing
- [ ] `EvalCase.run()` creates isolated DB, seeds, runs scenario, captures result
- [ ] Runner prints per-case summaries, writes JSON report
- [ ] All 3 basic scenarios run successfully with real Claude API calls
- [ ] `bun run evals` works from `apps/agenda/`
- [ ] Results directory contains timestamped JSON report
