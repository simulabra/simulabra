# Phase 6: Use FTS5 for Search

## Goal
Replace the brute-force in-memory search in DatabaseService with the existing FTS5 `Model.search(db, query)` static method.

## Context
The FTS5 infrastructure is fully built:
- Migrations 003, 005, 006, 007 create FTS5 virtual tables with sync triggers for all models
- `src/db.js:325-336` provides `SQLitePersisted.search(db, query)` static method
- But `DatabaseService.search` at `database.js:275-303` ignores all of this and does `findAll().filter()` with JavaScript string matching

This loads every row into memory, hydrates Simulabra objects, then does `.includes()` — the FTS5 tables are maintained on every write for zero benefit.

## Design

### Replace DatabaseService search RpcMethod

**Location:** `apps/agenda/src/services/database.js`, approximately line 275

Current approach:
```
load all logs → filter by .includes(query)
load all tasks → filter by .includes(query)
load all reminders → filter by .includes(query)
```

New approach:
```
$models.Log.search(db, query)
$models.Task.search(db, query)
$models.Reminder.search(db, query)
```

The `search()` static method returns hydrated Simulabra objects, same as `findAll()`, so the return format stays the same.

### Handle edge cases
- Empty query: return empty results (or all items — match current behavior)
- FTS5 special characters: the `search()` method should handle quoting, but verify
- Project filtering: if the search RPC accepts projectId, apply it after FTS5 results

## Key Files
- `apps/agenda/src/services/database.js` — search RpcMethod (~line 275)
- `apps/agenda/tests/services/database.js` — search tests
- `src/db.js` — verify `search()` static method API (line 325)

## Uncertainties
- FTS5 query syntax vs plain text: need to verify whether `search()` expects FTS5 MATCH syntax or plain text
- Whether all models have FTS5 tables (Haunt has one from migration 007, Project from 006)
- Whether to also search Projects and Haunts (current brute-force only searches Log, Task, Reminder)

## Acceptance Criteria
- `DatabaseService.search` uses `Model.search(db, query)` instead of `findAll().filter()`
- Search results are identical or better than before (FTS5 handles stemming, tokenization)
- All existing search-related tests pass
- No `findAll` calls remain in the search method
