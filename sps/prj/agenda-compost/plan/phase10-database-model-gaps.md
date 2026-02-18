# Phase 10: DatabaseService Gaps + Model-Level Tests

## Goal
Cover untested DatabaseService methods (`hideChatMessages`, `publishEvent`) and model-level methods (`Task.toggle`, `Model.search` via FTS5).

## Tests to Add

### hideChatMessages (in `apps/agenda/tests/services/database.js`)

Source: `DatabaseService.hideChatMessages` RpcMethod in `src/services/database.js`.
Hides chat messages either by `internalIds` array or by `sinceMinutes` time window.

| Test Name | Scenario |
|---|---|
| `DatabaseServiceHideChatByIds` | Append 3 messages, hide 2 by internalIds. Assert `{ hidden: 2 }`. Then `listChatMessages` returns only the unhidden one. |
| `DatabaseServiceHideChatBySinceMinutes` | Append messages, `hideChatMessages({ sinceMinutes: 5 })`. Assert correct count hidden. |
| `DatabaseServiceHideChatNoArgs` | `hideChatMessages({})` with no ids or sinceMinutes. Assert `{ hidden: 0 }`. |

### publishEvent (in `apps/agenda/tests/services/database.js`)

Source: `DatabaseService.publishEvent(type, data)` in `src/services/database.js`.
Publishes to the `eventStream` SQLiteStream.

| Test Name | Scenario |
|---|---|
| `DatabaseServicePublishEventOnCreate` | Create a task, read from `service.eventStream()`. Assert an event with `type: 'task.created'` was published. |
| `DatabaseServicePublishEventOnReminder` | Create a reminder, assert `reminder.created` event. |

### Task.toggle (in `apps/agenda/tests/models.js`)

Source: `Task.toggle()` in `src/models.js`. Flips between done/not-done.

| Test Name | Scenario |
|---|---|
| `TaskToggleDoneToUndone` | Create task, `complete()`, `toggle()`. Assert `done()` is false, `completedAt()` is null. |
| `TaskToggleUndoneToDone` | Create task (not done), `toggle()`. Assert `done()` is true, `completedAt()` is a Date. |

### FTS5 Model.search (in `apps/agenda/tests/models.js`)

Source: `Model.search(db, query)` static method from `src/db.js:325`. Uses FTS5 virtual tables created by migrations in `src/sqlite.js`.

| Test Name | Scenario |
|---|---|
| `ModelSearchFTS5Tasks` | Create tasks with different titles, `Task.search(db, 'keyword')`. Assert only matching tasks returned. |
| `ModelSearchFTS5Logs` | Same for logs with `Log.search(db, 'keyword')`. |
| `ModelSearchFTS5NoResults` | Search for non-existent term. Assert empty array. |

## Implementation Notes

- **publishEvent**: Access via `service.eventStream()` which is a `SQLiteStream`. Read entries with `readLatest(limit)`. Each entry has `{ type, data }` in its JSON payload.
- **FTS5**: Requires migrations to have run (to create virtual tables + sync triggers). The `createTestService()` helper already calls `initDatabase()` which runs all migrations. For model-level FTS5 tests, use the same DB setup pattern from `tests/sqlite.js`.
- **hideChatMessages**: Read `src/services/database.js` to understand the exact parameter handling. The `internalIds` mode hides specific messages; `sinceMinutes` hides messages newer than N minutes ago.

## Files to Modify
- `apps/agenda/tests/services/database.js` (hideChatMessages, publishEvent)
- `apps/agenda/tests/models.js` (Task.toggle, Model.search)

## Acceptance Criteria
- [ ] `hideChatMessages` covered for both modes (by ids, by sinceMinutes) plus edge case
- [ ] `publishEvent` verified for at least 2 event types
- [ ] `Task.toggle()` tested directly at model level (both directions)
- [ ] FTS5 `Model.search` tested directly (not just through DatabaseService.search)
- [ ] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/database.js` passes
- [ ] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/models.js` passes
- [ ] `bun run test` clean
