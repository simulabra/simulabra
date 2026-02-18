# Phase 12: GeistService Caching and HauntAction Isolation Tests

## Goal
Cover the Anthropic caching helpers (`isAnthropicProvider`, `cachedSystem`, `cachedTools`) and add isolated unit tests for `HauntAction` subclasses and `HauntItem` dispatch.

## Tests to Add

### Caching methods (in `apps/agenda/tests/services/geist.js`)

Source: `GeistService` methods in `src/services/geist.js`:
- `isAnthropicProvider()`: checks `client()?.provider?.() === 'anthropic'`
- `cachedSystem(prompt)`: wraps prompt with `cache_control` for Anthropic, passthrough otherwise
- `cachedTools()`: adds `cache_control` to last tool definition for Anthropic

| Test Name | Scenario |
|---|---|
| `GeistServiceIsAnthropicProviderTrue` | Set client with `provider()` returning `'anthropic'`. Assert true. |
| `GeistServiceIsAnthropicProviderFalse` | Set client with `provider()` returning `'openrouter'`. Assert false. |
| `GeistServiceIsAnthropicProviderNoClient` | `client()` is undefined. Assert false (no crash). |
| `GeistServiceCachedSystemAnthropicWraps` | Anthropic provider → `cachedSystem('prompt')` returns array with `cache_control`. |
| `GeistServiceCachedSystemNonAnthropicPassthrough` | Non-Anthropic → `cachedSystem('prompt')` returns raw string. |
| `GeistServiceCachedToolsAnthropicAddsCache` | Anthropic → last tool has `cache_control`, others don't. |
| `GeistServiceCachedToolsNonAnthropicClean` | Non-Anthropic → no tools have `cache_control`. |

### HauntAction isolation (in `apps/agenda/tests/services/geist.js`)

Source: Classes in `src/services/geist.js`:
- `DoneAction:73-86` — calls `item.onDone(db)`, returns `{ status: 'actioned' }`
- `BacklogAction:88-101` — calls `item.onBacklog(db)`, returns `{ status: 'actioned' }`
- `SnoozeAction:103-118` — returns `{ status: 'pending', snoozeUntil: <24h from now> }`
- `DismissAction:120-132` — returns `{ status: 'dismissed' }`
- `TaskHauntItem:32-51` — `onDone` calls db.completeTask, `onBacklog` calls db.updateTask with priority 5

| Test Name | Scenario |
|---|---|
| `DoneActionExecute` | Create `DoneAction`, call `execute(mockItem, mockDb)`. Assert returns `{ status: 'actioned' }` and `item.onDone` was called. |
| `BacklogActionExecute` | Same for `BacklogAction`. |
| `SnoozeActionExecute` | Assert returns `{ status: 'pending', snoozeUntil: <ISO string> }` approximately 24h in future. |
| `DismissActionExecute` | Assert returns `{ status: 'dismissed' }`. |
| `TaskHauntItemOnDone` | Use real DatabaseService, create a task, call `TaskHauntItem.new({ itemId }).onDone(dbService)`. Assert task is now completed. |
| `TaskHauntItemOnBacklog` | Same setup, call `onBacklog(dbService)`. Assert task priority changed to 5. |

## Implementation Notes

- For caching tests, create a mock client: `{ provider: () => 'anthropic' }` or `{ provider: () => 'openrouter' }`. Set via `geistService.client(mockClient)`.
- For HauntAction tests, mock items can be simple objects: `{ onDone: (db) => { ... }, onBacklog: (db) => { ... } }`.
- For TaskHauntItem tests, use a real DatabaseService with in-memory SQLite for proper integration verification.
- The existing `geist-prompts.js` tests cover `actionHaunt()` end-to-end. These Phase 12 tests verify each class in isolation.

## Files to Modify
- `apps/agenda/tests/services/geist.js`

## Acceptance Criteria
- [ ] All caching methods tested for both Anthropic and non-Anthropic providers
- [ ] Null client edge case does not crash `isAnthropicProvider`
- [ ] Each HauntAction subclass has an isolated unit test for `execute()`
- [ ] `TaskHauntItem.onDone()` and `onBacklog()` tested with real DB
- [ ] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` passes
- [ ] `bun run test` clean
