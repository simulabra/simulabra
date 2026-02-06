# Phase 3: Reporting and Inspection

Make eval results easy to read and compare across runs.

## Markdown Report — `apps/agenda/evals/report.js`

A `ReportFormatter` class that reads a JSON report and produces a human-readable markdown file.

Format:
```markdown
# Geist Eval Report — 2026-02-05 14:30

## Summary
- 12/13 passed
- Total duration: 45s
- Model: claude-sonnet-4-20250514

## Results

### [PASS] Create a task from natural language (3.2s)
**Input**: "add a task: buy new kitchen tiles, high priority, for the house project"
**Tools called**: create_task({title: "Buy new kitchen tiles", priority: 1, ...})
**Response**: "created task 'buy new kitchen tiles' in house renovation."
**DB changes**: +1 task (title: "Buy new kitchen tiles", priority: 1)
```

For each scenario:
- Pass/fail status with duration
- User input
- System prompt (abbreviated: first 200 chars)
- Claude's response text
- Tool calls with arguments
- Tool results (abbreviated)
- DB state changes from snapshot diff

The runner should auto-generate the markdown report alongside the JSON after each run.

## Run Comparison — `apps/agenda/evals/compare.js`

CLI: `bun run apps/agenda/evals/compare.js <run1.json> <run2.json>`

Outputs:
- Scenarios that changed status (pass/fail flips)
- Duration changes (significant only, >20% difference)
- Tool call differences (different tools called for same scenario)

Useful for testing prompt changes or model upgrades.

## Run Metadata

Extend JSON report with:
- `model` — from GeistService.model()
- `systemPromptHash` — hash of the system prompt for change detection
- `seedVersion` — constant in seed.js, bumped when seed data changes
- `gitCommit` — from `git rev-parse HEAD`

## Files to Create

| File | Purpose |
|------|---------|
| `apps/agenda/evals/report.js` | Markdown report generator |
| `apps/agenda/evals/compare.js` | Run comparison utility |

## Files to Modify

| File | Change |
|------|--------|
| `apps/agenda/evals/run.js` | Add metadata, auto-generate markdown |
| `apps/agenda/evals/seed.js` | Add SEED_VERSION constant |
| `apps/agenda/package.json` | Add evals:report and evals:compare scripts |

## Acceptance Criteria

- [ ] Markdown report generated alongside JSON for each run
- [ ] Report shows all relevant information per scenario (input, tools, response, DB changes)
- [ ] Compare utility shows status/duration/tool diffs between runs
- [ ] Metadata includes model, prompt hash, seed version, git commit
