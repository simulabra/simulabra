# agenda-compost

Review the agenda app's Simulabra usage patterns and produce a prompt alignment document for follow-on agent work.

## Tags
review, agenda, simulabra, prompts, architecture

## Status
IN PROGRESS

## Overview
Deep review of apps/agenda/ to assess how well it leverages the Simulabra object system. Identify anti-patterns, missed abstractions, and shortcuts. Produce a document that aligns future agent prompts with Simulabra idioms so the agent thinks in terms of classes, slots, and composition rather than ad-hoc code.

## Phases
- [x] Phase 1: Deep audit of agenda app Simulabra usage
- [x] Phase 2: Write the review document with findings and prompt updates
- [x] Phase 3: Add Patterns/AntiPatterns to root CLAUDE.md, replace agenda CLAUDE.md
- [x] Phase 4: Update geist system prompts with improved versions
- [x] Phase 5: Extract shared interpret/interpretMessage logic (~-80 lines)
- [x] Phase 6: Replace brute-force search with FTS5 Model.search()
- [x] Phase 7: Dead code audit and yard migration
- [x] Phase 8: Fix logs.js test bugs + AgendaLog coverage
- [x] Phase 9: GeistService executeTool coverage for remaining 6 tools
- [ ] Phase 10: DatabaseService gaps + model-level tests (hideChatMessages, FTS5, Task.toggle)
- [ ] Phase 11: Scheduler and time system coverage
- [ ] Phase 12: GeistService caching helpers + HauntAction isolation tests

## History
- 2026-02-13: Project initialized. Beginning codebase exploration.
- 2026-02-13: Phase 1 complete. Audit document written to docs/audit.md with verified line numbers across all 12 source files.
- 2026-02-14: Phase 2 complete. Prompt alignment document written to docs/prompt-alignment.md with proposed CLAUDE.md, revised system prompts, and 13-item refactoring roadmap.
- 2026-02-14: Phase 3 complete. Root CLAUDE.md now has <Patterns> (8 patterns with code examples) and <AntiPatterns> (5 items). Agenda CLAUDE.md fully replaced: 13 sections, zero Redis references, all models/services/evals documented.
- 2026-02-14: Phase 4 complete. Both geist system prompts replaced in src/services/geist.js. Main prompt now has data model, intent→tool mapping, time parsing, and multi-step operation sections. Haunt prompt now has priority tiers, explicit skip criteria, and structured output format.
- 2026-02-14: Phase 5 complete. Extracted _processWithTools $.Method from shared interpret/interpretMessage logic. geist.js: 820→767 lines (-53). Both methods are now thin wrappers around the shared core.
- 2026-02-14: Phase 6 complete. DatabaseService.search now uses Model.search(db, query) via FTS5 indexes. Brute-force findAll().filter() eliminated. Search method: 30→16 lines. Wildcard/empty queries fall back to findAll() without filtering.
- 2026-02-16: Phase 7 started. Dead code audit — traced import graph from all entry points, identified 17 files (sections 1 & 2) for yard migration. Document at docs/dead-code.md.
- 2026-02-16: Phase 7 complete. Moved 16 files to yard/ (excluded bin/pm-runner.js — still active via PMController.start). Removed dead "agent"/"serve" scripts from package.json. Updated 5 agenda test files to remove redis.js dependency. Cleaned up stale doc references. All tests pass.
- 2026-02-16: Phase 7 extended — Redis test cleanup. Yarded 3 broken Redis-only test files (integration.js, chat.js, redis.js). Ported geist.js and reminder.js tests from Redis to SQLite in-memory. Fixed production bug in reminder.js:62 (undefined `db` reference). 314 agenda test cases passing across 12 modules.
- 2026-02-16: Phases 8-12 planned. Test coverage audit identified: 2 bugs in logs.js, 6 untested tools in GeistService, untested hideChatMessages/publishEvent/Task.toggle/FTS5 search, scheduler gaps, caching helpers, HauntAction isolation. ~60 new tests planned across 5 phases.
- 2026-02-17: Phase 8 complete. Fixed 2 bugs in logs.js tests (wrong class, wrong method name), fixed latent color assertion in LogFormatterFormat, added 3 new tests for AgendaLogFormatter/AgendaLogStreamer. 19 logs tests passing.
- 2026-02-17: Phase 9 complete. Added 9 executeTool integration tests for 6 remaining tools (update_task, create_project, list_projects, update_project, move_to_project, trigger_webhook). All 14 tools now have executeTool coverage. 22 geist service tests passing.
