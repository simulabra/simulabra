# Operator Database Separation + HTML Overflow Fix + DB Cleanup

## Problem Summary

Three related issues stemming from operator testing:

1. The operator skill drives the live agenda service but writes test data into the user's production database (`apps/agenda/agenda.db`). There is no isolation boundary between operator testing and real use.

2. Long unbroken strings in the agenda web UI (like "xxxxxxxxxxxx" or "a]]]]]]]]]]]]]") overflow their HTML containers, breaking the layout.

3. Test artifacts from a recent operator session (around `2026-01-29T06:42:22.797Z`) pollute the production database and should be removed.

---

## Task 1: Separate Operator Database

### Current State

- `DatabaseService` opens its SQLite database from `process.env.AGENDA_DB_PATH || this.dbPath()`, where `dbPath` defaults to `'agenda.db'` (relative to `apps/agenda/`).
- The process manager config in `misc/pm/services.js` defines the `agenda` service with `cwd: 'apps/agenda'` and environment variables, but does not set `AGENDA_DB_PATH`.
- The operator skill uses `simulabractl` to manage the running agenda service. It cannot pass environment variables to an already-running instance.
- Unit tests already achieve isolation by passing `dbPath: ':memory:'` to `DatabaseService.new()`.

### Design: Operator Test Instance via PM Config

Add a second service entry in the PM service registry for an operator-dedicated agenda instance. This is the simplest approach that uses the existing infrastructure.

**Components:**

- **`misc/pm/services.js`**: Add an `agenda-test` service definition alongside the existing `agenda` entry. It runs the same `run.js` but with different environment:
  - `AGENDA_DB_PATH` set to `agenda-test.db` (or an absolute temp path)
  - `AGENDA_PORT` set to `3031` (different port to avoid conflict)
  - Same `cwd` and `stop` configuration as the production service

- **Operator skill (`SKILL.md`)**: Update the operator instructions to use `simulabractl start agenda-test` instead of `simulabractl start agenda`, and to target port 3031 for HTTP API calls and browser automation.

- **`.gitignore`**: Ensure `agenda-test.db` is gitignored (it likely already falls under existing patterns, but verify).

**Data flow:**

```
Production:   simulabractl start agenda      -> port 3030, agenda.db
Operator:     simulabractl start agenda-test  -> port 3031, agenda-test.db
```

No code changes needed in the application itself -- the existing `AGENDA_DB_PATH` and `AGENDA_PORT` environment variables already provide the necessary configuration hooks. The only changes are configuration.

### Files to Change

| File | Change |
|------|--------|
| `misc/pm/services.js` | Add `agenda-test` service entry with `AGENDA_DB_PATH` and `AGENDA_PORT` env vars |
| `.claude/skills/operator/SKILL.md` | Document the test instance: start `agenda-test`, use port 3031 |

### Testing

- Start `agenda-test` via simulabractl, verify it creates `agenda-test.db` (not `agenda.db`)
- Verify both services can run simultaneously on different ports
- Have the operator skill exercise the test instance and confirm no pollution of `agenda.db`

---

## Task 2: HTML Overflow Fix

### Current State

The chat messages, task titles, log content, and reminder messages are rendered as plain text in containers with fixed or flexible widths. There is no CSS word-wrapping rule, so unbroken strings (no spaces, very long words) overflow their containers horizontally.

The affected CSS classes and their containers:

- `.chat-message` -- `max-width: 85%` but no word-wrap
- `.message-content` -- inherits, no overflow handling
- `.task-title` -- `display: block` inside `.task-content` (flex: 1), no overflow
- `.log-content` -- `font-size: 14px; line-height: 1.5`, no overflow
- `.reminder-message` -- similar

### Design

Add `overflow-wrap: break-word` to a shared rule covering all text content containers. This is the standard CSS property for breaking long unbroken strings to prevent overflow.

Apply it broadly to the app container so all descendants inherit the behavior:

```
.agenda-app {
  overflow-wrap: break-word;
  word-break: break-word;
}
```

Using both `overflow-wrap` and `word-break` covers older browser edge cases. The `break-word` value of `word-break` is a legacy alias but provides fallback for WebKit.

Alternatively, the fix could target only content-bearing elements (`.message-content`, `.task-title`, `.log-content`, `.reminder-message`) for more surgical precision. However, since there is no reason any element in the agenda app should overflow with text, the broad approach is safer and requires less maintenance.

### Files to Change

| File | Change |
|------|--------|
| `apps/agenda/src/style.css` | Add `overflow-wrap: break-word; word-break: break-word;` to `.agenda-app` |

### Testing

- Run `bun run test-ui` after the change
- Verify with long unbroken strings in chat, task titles, and log entries
- Visually confirm text wraps within container boundaries

---

## Task 3: DB Cleanup

### Current State

The production database contains operator test artifacts from around `2026-01-29T06:42:22.797Z` (+-5 min window = `06:37:22` to `06:47:22`):

- **2 tasks**: "operator test task - delete me" and "agent-created task with priority 5"
- **1 log**: "something: testing the logging system from operator"
- **1 reminder**: "check the server logs"
- **24 stream entries** (chat messages and events from the operator session)

### Design: One-Shot Cleanup Script

Write a small disposable script (or inline SQL) that deletes the affected records. Because of the FTS triggers, deleting from the main tables will automatically cascade to the FTS shadow tables.

**Records to delete (all with `createdAt` in the window `2026-01-29T06:37:22Z` to `2026-01-29T06:47:22Z`):**

```sql
DELETE FROM agenda_Task WHERE createdAt >= '2026-01-29T06:37:22.797Z' AND createdAt <= '2026-01-29T06:47:22.797Z';
DELETE FROM agenda_Log WHERE createdAt >= '2026-01-29T06:37:22.797Z' AND createdAt <= '2026-01-29T06:47:22.797Z';
DELETE FROM agenda_Reminder WHERE createdAt >= '2026-01-29T06:37:22.797Z' AND createdAt <= '2026-01-29T06:47:22.797Z';
DELETE FROM _streams WHERE createdAt >= '2026-01-29T06:37:22.797Z' AND createdAt <= '2026-01-29T06:47:22.797Z';
```

This should be run directly against `apps/agenda/agenda.db` with `sqlite3`. No application code change is needed. Back up the database first.

### Execution Steps

1. Stop the agenda service: `simulabractl stop agenda`
2. Back up: `cp apps/agenda/agenda.db apps/agenda/agenda.db.bak`
3. Run the DELETE statements via `sqlite3`
4. Verify counts are zero
5. Restart: `simulabractl start agenda`
6. Remove backup once confirmed

---

## Execution Order

1. **Task 3 (DB cleanup)** -- immediate, removes existing pollution
2. **Task 2 (HTML overflow)** -- quick CSS fix, independent of the others
3. **Task 1 (Operator DB separation)** -- configuration change, prevents future pollution

---

## Estimate

- Task 1 (operator DB separation): ~15 minutes -- two config file edits
- Task 2 (HTML overflow fix): ~5 minutes -- one CSS rule
- Task 3 (DB cleanup): ~5 minutes -- direct SQL execution
- Total: ~25 minutes of carpenter work
