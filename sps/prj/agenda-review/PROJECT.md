# agenda-review

**Description:** Review the agenda app's code patterns and produce feedback with analysis, to be used as inputs back into the core Simulabra framework.

**Tags:** agenda, review, framework-feedback

## Overview

Systematic review of the agenda application code. Each observation captures friction, code smells, or missing abstractions — things the core framework should handle better so application code stays clean.

## Status

IN PROGRESS — gathering observations

## Observations

1. **Defensive DB guards (fail-fast)** — GeistService has ~6 sites checking `if (!db)` and returning soft errors. ReminderService has 2 more. Also 3 sites checking `if (!this.client())` in geist. Better to crash and let the supervisor restart. Inconsistent within geist.js itself: `analyzeContext`, `getPendingHaunts`, `actionHaunt` already throw correctly, while `interpret`, `interpretMessage`, `generateHaunts`, `executeTool` silently degrade. Added fail-fast to core CLAUDE.md as a general coding standard.

2. **Test runner has no timeout** — `tests/db.js` hangs indefinitely, blocking `bun run test`. The test runner should fail fast too: add per-test or per-file timeouts.

3. **`interpret` and `interpretMessage` are mostly the same** — The two RpcMethods share ~50 lines of identical Claude API interaction (call → process tool blocks → execute tools → follow-up). They differ only in: (a) how input arrives (raw string vs `{ conversationId, text, source, ... }`), (b) whether messages come from chat history or are built fresh, (c) whether user/assistant messages are persisted to the DB. The message should be a real Simulabra object — a `GeistMessage` class carrying input text, conversation context, and persistence behavior — so a single `interpret` method operates on it. The current function-arguments-as-interface pattern doesn't compose and forces duplication whenever a new input channel appears.

## History

- 2026-02-14: Project created. First observation: defensive DB guards in geist.js. Applied fail-fast fix to geist.js and reminder.js. Found pre-existing test hang in tests/db.js.
