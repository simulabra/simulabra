# geist-evals Worklog

## 2026-02-05

- Explored agenda geist architecture: GeistService, DatabaseService, tools, models, migrations
- Studied existing test patterns: MockAnthropicClient, createTestDb, createTestServices
- Designed 3-phase plan: framework+seed, comprehensive scenarios, reporting
- Key design decision: TraceCapture wraps real Anthropic client (not mock) for actual LLM eval
- Key design decision: EvalCase is standalone (not $test.AsyncCase) to separate from unit tests

## 2026-02-06

### Phase 1 Implementation

Files created:
- `apps/agenda/evals/seed.js` — EvalSeed.populate() creates 3 projects, 12 tasks (2 completed), 5 logs, 3 reminders (1 sent, 1 recurring)
- `apps/agenda/evals/trace.js` — TraceCapture class (plain JS, not Simulabra) wraps real Anthropic client; TraceCaptureFactory.create() for integration with Simulabra classes
- `apps/agenda/evals/framework.js` — EvalCase Simulabra class with run() method: creates isolated in-memory SQLite, seeds, runs scenario, captures result with traces
- `apps/agenda/evals/run.js` — Runner entry point: loads .env, collects EvalCase instances, runs sequentially, prints colored PASS/FAIL, writes timestamped JSON report
- `apps/agenda/evals/scenarios/basic.js` — 3 scenarios: create task, search items, create project
- `apps/agenda/evals/results/.gitignore` — ignores JSON reports, keeps .gitkeep

Files modified:
- `apps/agenda/package.json` — added `"evals"` script

Struggles:
- Initially used `$.Getter` for TraceCapture.messages, but Simulabra has no Getter slot type. Solved by making TraceCapture a plain JS class with a `get messages` getter (matching MockAnthropicClient pattern) and wrapping it in a TraceCaptureFactory Simulabra class.

All 3 evals pass with real Claude API calls (~4s each, ~12s total). JSON reports written to evals/results/.
