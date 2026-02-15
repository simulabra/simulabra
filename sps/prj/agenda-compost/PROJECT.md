# agenda-compost

Review the agenda app's Simulabra usage patterns and produce a prompt alignment document for follow-on agent work.

## Tags
review, agenda, simulabra, prompts, architecture

## Status
DONE

## Overview
Deep review of apps/agenda/ to assess how well it leverages the Simulabra object system. Identify anti-patterns, missed abstractions, and shortcuts. Produce a document that aligns future agent prompts with Simulabra idioms so the agent thinks in terms of classes, slots, and composition rather than ad-hoc code.

## Phases
- [x] Phase 1: Deep audit of agenda app Simulabra usage
- [x] Phase 2: Write the review document with findings and prompt updates
- [x] Phase 3: Add Patterns/AntiPatterns to root CLAUDE.md, replace agenda CLAUDE.md
- [x] Phase 4: Update geist system prompts with improved versions
- [x] Phase 5: Extract shared interpret/interpretMessage logic (~-80 lines)
- [x] Phase 6: Replace brute-force search with FTS5 Model.search()

## History
- 2026-02-13: Project initialized. Beginning codebase exploration.
- 2026-02-13: Phase 1 complete. Audit document written to docs/audit.md with verified line numbers across all 12 source files.
- 2026-02-14: Phase 2 complete. Prompt alignment document written to docs/prompt-alignment.md with proposed CLAUDE.md, revised system prompts, and 13-item refactoring roadmap.
- 2026-02-14: Phase 3 complete. Root CLAUDE.md now has <Patterns> (8 patterns with code examples) and <AntiPatterns> (5 items). Agenda CLAUDE.md fully replaced: 13 sections, zero Redis references, all models/services/evals documented.
- 2026-02-14: Phase 4 complete. Both geist system prompts replaced in src/services/geist.js. Main prompt now has data model, intent→tool mapping, time parsing, and multi-step operation sections. Haunt prompt now has priority tiers, explicit skip criteria, and structured output format.
- 2026-02-14: Phase 5 complete. Extracted _processWithTools $.Method from shared interpret/interpretMessage logic. geist.js: 820→767 lines (-53). Both methods are now thin wrappers around the shared core.
- 2026-02-14: Phase 6 complete. DatabaseService.search now uses Model.search(db, query) via FTS5 indexes. Brute-force findAll().filter() eliminated. Search method: 30→16 lines. Wildcard/empty queries fall back to findAll() without filtering.
