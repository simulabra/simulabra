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
