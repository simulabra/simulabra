# Phase 2: Prompt Alignment Document

Write the main deliverable: a prompt alignment document to `sps/prj/agenda-compost/docs/prompt-alignment.md`. This document serves two audiences:
1. The **geist agent** (Claude) — via updates to the system prompt in geist.js
2. The **developer agent** (Claude Code) — via updates to apps/agenda/CLAUDE.md

The document should be self-contained and usable as a reference for follow-on projects.

## Document Structure

### Part 1: Updated CLAUDE.md for apps/agenda/

Rewrite the entire CLAUDE.md to reflect the current state of the app:
- SQLite (not Redis) persistence
- Current architecture with DatabaseService, GeistService, ReminderService
- Current test file locations (apps/agenda/tests/)
- Correct model classes and their locations
- Add a new **Simulabra Patterns** section that teaches:
  - When to define a new class vs use a plain object (answer: almost always define a class)
  - When to use DBVar vs Var (persistent vs in-memory)
  - How to add new tools (create class with Tool mixin, register in AgendaToolRegistry)
  - How to add new model types (create class with SQLitePersisted, add migration, add CRUD RpcMethods)
  - When to use EnumVar for constrained string fields
  - Avoid standalone functions — use Static methods or instance methods
  - Every concept that has identity, gets passed between methods, or appears in more than one place should be a class
- Add an **Anti-Patterns to Avoid** section:
  - Don't return plain objects from methods that produce structured data — make a class
  - Don't duplicate method bodies — extract shared behavior
  - Don't do client-side filtering when database indexes exist
  - Don't put conversion logic in bare functions — use Static methods on a translator class

### Part 2: Updated Geist System Prompt

Propose a revised geist system prompt (the one in geist.js systemPrompt Var) that:
- Keeps the terse, ghostly personality
- Better describes the object model the agent is working with (tasks have priority 1-5, projects are containers with context, logs are timestamped entries, reminders have trigger times and optional recurrence)
- Teaches the agent about relationships (items belong to projects via projectId, haunts reference items via itemType+itemId)
- Gives clearer guidance on tool selection edge cases found during development (e.g. update_task vs complete_task, when to set projectId)
- Adds guidance for multi-step operations (e.g. "create a project and add tasks to it" → create_project first, then create_task with projectId)
- Improves the haunt generation prompt to be more specific about what makes a good haunt

### Part 3: Refactoring Roadmap

Based on the audit findings, propose a prioritized list of follow-on projects:

1. **Fix stale CLAUDE.md** (quick win, high impact for developer agent alignment)
2. **Extract shared interpret logic** (reduce duplication, improve maintainability)
3. **Reify plain objects** (ChatMessage, AnalysisContext, ToolResult classes)
4. **Use FTS5 for search** (use the existing infrastructure)
5. **Convert provider functions to Static methods** (consistency)
6. **Add EnumVar for status/type fields** (type safety)
7. **apiHandler → middleware class** (Simulabra consistency)

Each item should have:
- Priority (P1-P3)
- Estimated effort (small/medium/large)
- Which files are affected
- What the change achieves

## Key Files to Reference
- `apps/agenda/CLAUDE.md` — current (stale) developer guidance
- `apps/agenda/src/services/geist.js:22-87` — current system prompts
- `apps/agenda/src/models.js` — the actual data model
- `apps/agenda/src/tools.js` — tool definitions
- `CLAUDE.md` (root) — overall Simulabra coding standards

## Acceptance Criteria
- Document written to `sps/prj/agenda-compost/docs/prompt-alignment.md`
- Contains complete proposed CLAUDE.md replacement text
- Contains complete proposed system prompt revision
- Contains prioritized refactoring roadmap with effort estimates
- Self-contained — usable without reading any other document
