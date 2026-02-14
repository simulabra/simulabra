# geist-evals

Minimal extensible evals system for the agenda geist — prepopulated test DB, eval scenarios (create project, search logs, etc.), and inspection of LLM outputs and tool calls.

## Status

IN PROGRESS

## Phases

| Phase | File | Summary | Status |
|-------|------|---------|--------|
| 1 | plan/phase1-framework-and-seed.md | Eval framework, seed DB, trace capture, runner, 3 basic scenarios | DONE |
| 2 | plan/phase2-comprehensive-scenarios.md | Full scenario coverage, snapshot diffs, multi-turn evals | DONE |
| 3 | plan/phase3-reporting.md | Markdown reports, run comparison, metadata | DONE |

## History

- 2026-02-05: Project created. Architecture explored, plan written.
- 2026-02-06: Phase 1 complete. Eval framework, seed DB, trace capture, runner, and 3 basic scenarios all working.
- 2026-02-06: Phase 1 reviewed and approved. Doc strings added to analysis.js, evals skill updated, acceptance criteria checked off.
- 2026-02-09: Phase 2 complete. Snapshot diff utility, 12 new scenarios (tasks, projects, logs, reminders, multi-turn), 20/20 passing.
- 2026-02-09: Phase 2 reviewed and approved. Fixed async snapshot, multi-turn assertion bug, duplicate scenario input.
- 2026-02-08: Phase 3 complete. ReportFormatter, RunComparator, run metadata, auto-generated markdown reports, 12 tests passing.
