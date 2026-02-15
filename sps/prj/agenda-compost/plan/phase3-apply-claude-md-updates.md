# Phase 3: Apply CLAUDE.md Updates

## Goal
Update both the root `CLAUDE.md` and `apps/agenda/CLAUDE.md` with the content proposed in `docs/prompt-alignment.md` (Parts 1 and 2).

## Root CLAUDE.md Changes

Add two new sections after `</CodingStandards>` and before `<Testing>`:

1. **`<Patterns>` section** — universal Simulabra patterns with code examples:
   - REIFY EVERYTHING (class over plain object)
   - EnumVar for constrained fields
   - Virtual for service contracts
   - Before/After beyond init
   - Static methods over standalone functions
   - DBVar vs Var guidance
   - FTS5 search usage
   - Configurable mixin

2. **`<AntiPatterns>` section** — five key anti-patterns to avoid:
   - Plain objects for domain concepts
   - Duplicate method bodies
   - Client-side filtering
   - Standalone functions
   - Ad-hoc middleware

**Source content:** `sps/prj/agenda-compost/docs/prompt-alignment.md`, Part 1 (lines 15-136)

**File:** `/CLAUDE.md` — insert after `</CodingStandards>` line, before `<Testing>` line

## Agenda CLAUDE.md Replacement

Replace the entire contents of `apps/agenda/CLAUDE.md` with the proposed version from Part 2.

The new document covers 13 sections: AgendaOverview, Architecture, Models, Tools, Services, Persistence, Provider, Evals, LaunchPoints, Testing, Debugging, Development. All references to Redis are eliminated. Projects, Haunts, Provider, and Evals are documented.

**Source content:** `sps/prj/agenda-compost/docs/prompt-alignment.md`, Part 2 (lines 140-312)

**File:** `apps/agenda/CLAUDE.md` — full replacement

## Acceptance Criteria
- Root CLAUDE.md has `<Patterns>` and `<AntiPatterns>` sections with all code examples
- `apps/agenda/CLAUDE.md` contains no references to Redis
- `apps/agenda/CLAUDE.md` documents all current models (Log, Task, Reminder, Haunt, HauntConfig, Project)
- `apps/agenda/CLAUDE.md` documents Provider, Evals, and Projects
- All existing sections in root CLAUDE.md are preserved
- Tests pass: `bun run test`
