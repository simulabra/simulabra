# Phase 11: Haunts — Model, Migration & Rename

## Goal
Rename the prompting system from "prompts" to "haunts" throughout the data layer. Add the `actions` field to the model. Write migration 007. Add `UpdateTaskTool` to the tool registry. This phase is purely data-layer — no generation logic or UI changes.

## Context
The existing prompting system (phases 8-9) uses a `Prompt` model with fields: itemType, itemId, message, context, status, action, generatedAt, shownAt, actionedAt, snoozeUntil. The system generates proactive suggestions for the user but currently has 4 hardcoded action buttons (done/backlog/later/dismiss). We're evolving this so the LLM generates context-specific action choices per haunt.

The action execution model is **send-to-Geist**: clicking a haunt action will send a pre-composed message to Geist's chat. So the `actions` field stores `[{label, message}]` where `label` is button text and `message` is what gets sent to Geist.

## Model Changes

### Haunt (replaces Prompt) — `apps/agenda/src/models.js:239-330`

Rename `Prompt` class to `Haunt`. Change doc to: "Proactive suggestion with context-specific action choices". Keep all existing DBVar slots. Add:

- `actions` DBVar: JSON array of action choices `[{label, message}]`. Nullable (old haunts have none). Uses `toSQL: JSON.stringify` / `fromSQL: JSON.parse` pattern (same as `context` field).

The existing `action` field (singular) stays — it records which action the user took. The new `actions` field (plural) stores the available choices.

Update the `description()` method to include "haunt" terminology.

### HauntConfig (replaces PromptConfig) — `apps/agenda/src/models.js:332-410`

Rename `PromptConfig` to `HauntConfig`. Rename fields for consistency:
- `promptFrequencyHours` → `hauntFrequencyHours`
- `maxPromptsPerCycle` → `maxHauntsPerCycle`
- `taskStalenessDays` stays (it describes the task staleness threshold, not the haunt)

## Migration 007 — `apps/agenda/src/sqlite.js`

Add `migration007` after `migration006`. This migration:

1. Creates `agenda_Haunt` table with all columns from `agenda_Prompt` plus `actions TEXT`
2. Copies all rows from `agenda_Prompt` into `agenda_Haunt` (with `actions` as NULL)
3. Drops old FTS triggers, FTS table, indexes, and `agenda_Prompt` table
4. Creates new indexes on `agenda_Haunt` (itemType, status, generatedAt)
5. Creates new FTS table and triggers for `agenda_Haunt` (on `message` field)
6. Renames `agenda_PromptConfig` to `agenda_HauntConfig` via `ALTER TABLE RENAME TO`
7. Renames config columns: `promptFrequencyHours` → `hauntFrequencyHours`, `maxPromptsPerCycle` → `maxHauntsPerCycle` (use ALTER TABLE RENAME COLUMN)

Update `AgendaMigrations.all()` at line 291 to include `migration007`.

Note: SQLite supports `ALTER TABLE RENAME COLUMN` since version 3.25.0 (2018). Bun bundles a modern SQLite.

## Database Service Changes — `apps/agenda/src/services/database.js:426-537`

Rename all RPC methods:
- `createPrompt` → `createHaunt` (add `actions` to accepted fields)
- `getPrompt` → `getHaunt`
- `listPrompts` → `listHaunts`
- `updatePrompt` → `updateHaunt` (add `actions` to accepted fields)
- `getPromptConfig` → `getHauntConfig`
- `hasActivePendingPrompt` → `hasActivePendingHaunt`
- `updatePromptConfig` → `updateHauntConfig`

All internal references change from `$models.Prompt` → `$models.Haunt`, `$models.PromptConfig` → `$models.HauntConfig`.

## UpdateTaskTool — `apps/agenda/src/tools.js`

Add a new tool class `UpdateTaskTool` that wraps `services.db.updateTask()`. Schema:
- Required: `id` (string)
- Optional: `title`, `priority` (integer 1-5), `dueDate` (ISO string), `tags` (array), `projectId`

Register it in `AgendaToolRegistry.init` (line 571-588). This brings the tool count to 14.

Also add `update_task` to the Geist base system prompt tool mappings in `geist.js` (the tool listing section around line 38).

## Files to Modify

| File | Change |
|------|--------|
| `apps/agenda/src/models.js` | Rename Prompt→Haunt, PromptConfig→HauntConfig, add `actions` DBVar |
| `apps/agenda/src/sqlite.js` | Add migration007, update AgendaMigrations.all() |
| `apps/agenda/src/services/database.js` | Rename all prompt RPCs to haunt RPCs, handle `actions` field |
| `apps/agenda/src/tools.js` | Add UpdateTaskTool, register in AgendaToolRegistry |
| `apps/agenda/src/services/geist.js` | Add `update_task` to base system prompt tool listing (line ~38) |
| `apps/agenda/tests/services/database.js` | Rename all prompt tests to haunt, add actions field test |
| `apps/agenda/tests/tools.js` | Add UpdateTaskTool test, update registry count to 14 |
| `apps/agenda/tests/geist-prompts.js` | Rename all references from prompt→haunt in test names and assertions |

## Acceptance Criteria

- [ ] `Haunt` class exists with all fields from `Prompt` plus `actions`
- [ ] `HauntConfig` class exists with renamed fields
- [ ] Migration 007 runs successfully (tested via MigrationRunner in test setup)
- [ ] All database RPCs renamed and work with `actions` field
- [ ] `createHaunt` stores actions array, `getHaunt` returns it parsed
- [ ] `UpdateTaskTool` registered and functional (14 tools total)
- [x] All existing prompt tests pass with renamed identifiers
- [x] New test: haunt with actions round-trips through DB correctly
- [x] New test: haunt without actions (null) handled correctly
- [x] `bun run test` green

## Review

**Verdict: Approved.** Code is correct, complete, and idiomatic. No blocking issues.

### Correctness

All acceptance criteria met. The rename is thorough and consistent across 10 files. Migration 007 uses a sound two-strategy approach: CREATE+COPY+DROP for the Haunt table (needs new `actions` column) and `ALTER TABLE RENAME` for HauntConfig (only needs renames). The `down()` method is consistent with prior migration patterns (teardown only).

The geist.js changes exceeded the plan's stated scope ("Add `update_task` to base system prompt tool listing") by also renaming all RPC method calls and internal variable names. This was **necessary** — the database service RPCs were renamed in this phase, so all callers had to be updated. The run.js API handlers were also correctly updated for the same reason. Phase 12's rename list (lines 71-76) is now partially redundant but that's fine — the remaining phase 12 renames are the Var names (`promptGenerationSystemPrompt`, `promptTimes`, `promptDays`) and the LLM prompt text content.

### Style

- Doc strings on all new/changed components are consistent with existing patterns
- `UpdateTaskTool` doc ("Tool for updating an existing task") matches the `Tool for [verb]ing [noun]` convention used by all 14 tools
- Haunt class doc ("Proactive suggestion with context-specific action choices") is informative and distinct from the old Prompt doc
- Variable naming follows conventions: `h` for haunt in filter lambdas (matching `p` for prompt pattern), `hauntData` in generation loop

### Null Actions Behavior

The tests use `assert(!found.actions())` rather than `assertEq(found.actions(), null)` because the framework's `fromSQLRow` (db.js:257) skips NULL columns entirely — it doesn't call `fromSQL`, so the slot remains `undefined`. This is a known framework behavior, correctly worked around. The WORKLOG documents this well.

### No Refactors Needed

Code is clean and minimal. No dead code, no duplication, no unnecessary abstractions.
