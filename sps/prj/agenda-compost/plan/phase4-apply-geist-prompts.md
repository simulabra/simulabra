# Phase 4: Apply Revised Geist System Prompts

## Goal
Update the two system prompt strings in `apps/agenda/src/services/geist.js` with the improved versions from `docs/prompt-alignment.md` (Part 3).

## Context
The current prompts work but lack:
- Explicit data model documentation (the LLM doesn't know field names/types)
- Clear tool selection mapping (intent → tool)
- Multi-step operation guidance
- Priority tiers for haunt generation
- Explicit skip criteria for haunts

## Changes

### 4a. Main System Prompt (`systemPrompt` Var default)

**Location:** `apps/agenda/src/services/geist.js`, approximately lines 22-51

Replace the `systemPrompt` Var's default string with the revised version from Part 3a of prompt-alignment.md. Key improvements:
- Added `## data model` section with field-level documentation for task, log, reminder, project, haunt
- Added `## tools` section with explicit intent → tool mapping
- Added CRITICAL distinctions (projects vs tasks, complete_task vs update_task)
- Added `## time parsing` section for natural language time handling
- Added `## multi-step operations` section with examples

### 4b. Haunt Generation Prompt (`promptGenerationSystemPrompt` Var default)

**Location:** `apps/agenda/src/services/geist.js`, approximately lines 53-87

Replace the `promptGenerationSystemPrompt` Var's default string with the revised version from Part 3b. Key improvements:
- Structured into priority tiers (high/medium/low) instead of flat list
- Added explicit skip criteria (dismissed 2+ times, already done, snoozed)
- Added concrete output format guidance
- Specified "nothing needs attention → respond with []"

## Verification
- Run geist prompt tests: `bun run test` (tests/geist-prompts.js exercises prompt generation)
- Run evals if available: `bun run apps/agenda/evals/run.js` to compare before/after LLM behavior
- Prompts should parse cleanly as template strings (no syntax errors)

## Acceptance Criteria
- `systemPrompt` default contains data model, tools, time parsing, and multi-step sections
- `promptGenerationSystemPrompt` default has priority tiers and skip criteria
- All existing tests pass
- No changes to prompt logic/methods — only the string content changes
