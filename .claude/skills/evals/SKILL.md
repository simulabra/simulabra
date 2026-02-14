---
name: evals
description: Run geist eval scenarios against the real Claude API. Use when testing LLM behavior, verifying tool selection, or checking for regressions after geist changes.
allowed-tools: Bash, Read, Glob, Grep
---

<Introduction>
The geist evals system runs real Claude API calls against prepopulated in-memory SQLite databases. Each eval scenario sends natural language input through GeistService.interpret() and asserts correct tool selection. Results include full request/response traces, cost tracking, and token counts.
</Introduction>

<Commands>
```bash
# Run all eval scenarios
bun run apps/agenda/evals/run.js

# Run with a filter (substring match on title)
bun run apps/agenda/evals/run.js "search"

# Analyze historical results (pass rates, cost trends, tool stability)
bun run apps/agenda/evals/analysis.js
```
</Commands>

<Task>
$ARGUMENTS

If no arguments are given, run all evals and report the results.
If a filter is given (e.g. `/evals search`), pass it as the filter argument.

After running, summarize:
- Pass/fail status for each scenario
- Tools called
- Cost and token usage
- Any failures with error details

If a failure looks like an LLM nondeterminism issue (wrong tool selected), note that and suggest re-running.
If a failure looks like a code bug, investigate the relevant source files.
</Task>

<Output>
Show the eval output directly. After the run:
- Highlight any failures
- Report total cost
- If all pass, confirm the geist is behaving correctly
- Read the JSON report if the user wants more detail
</Output>

<Rules>
- NEVER delete or clean up old eval result files in `apps/agenda/evals/results/`. They are the historical record — each timestamped JSON report tracks cost, traces, and pass/fail over time. Accumulating them is the point.
- The `.gitignore` in `evals/results/` keeps them out of version control, but they must persist on disk.
</Rules>

<ScenarioFiles>
Eval scenarios live in `apps/agenda/evals/scenarios/`. Each file exports EvalCase instances.
- `basic.js` — create task, search items, create project
- `realistic.js` — bare keyword input, ambiguous verbs, questions, casual project creation
- `tasks.js` — create with priority/due, complete, update priority, list with filter
- `projects.js` — create with context, list, move item to project
- `logs.js` — create log entry, search logs
- `reminders.js` — create reminder, create recurring reminder
- `multiturn.js` — multi-turn conversation via interpretMessage

The framework files:
- `apps/agenda/evals/framework.js` — EvalCase class
- `apps/agenda/evals/trace.js` — TraceCapture with cost tracking
- `apps/agenda/evals/seed.js` — deterministic database seeding
- `apps/agenda/evals/run.js` — runner with colored output
- `apps/agenda/evals/analysis.js` — EvalAnalyzer, ScenarioStats, EvalRun (cross-run analysis)
</ScenarioFiles>
