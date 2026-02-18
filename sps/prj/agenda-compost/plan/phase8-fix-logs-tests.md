# Phase 8: Fix logs.js Tests and Add Agenda Log Coverage

## Goal
Fix the 2 known bugs in `apps/agenda/tests/logs.js` and add direct coverage for `AgendaLogFormatter` and `AgendaLogStreamer` from `apps/agenda/src/logs.js`.

## Bugs to Fix

### Bug 1: LogFormatterColorFor (line 134)
The test creates `$logs.LogFormatter.new()` — the base class from `simulabra/logs` — which has an empty `colors` map and `defaultColor` of `\x1b[37m` (white). But the test asserts `colorFor('supervisor')` returns `\x1b[36m` (cyan), which is an `AgendaLogFormatter`-specific color.

**Root cause:** The test should use `AgendaLogFormatter` for agenda-specific color assertions.

**Fix:** Split into two tests:
- Base `LogFormatter` test: assert `colorFor('anything')` returns the default white.
- `AgendaLogFormatter` test: assert agenda-specific colors (supervisor=cyan, DatabaseService=green, etc.)

### Bug 2: LogStreamerServiceNameFromFile (line 174)
The test calls `streamer.serviceNameFromFile()` but the actual method in `src/logs.js:117` is `sourceNameFromFile()`. This bug was never reached because the runner stops at the first failure (Bug 1).

**Fix:** Change `serviceNameFromFile` → `sourceNameFromFile` in the test.

## Source Files

- `src/logs.js` (core, `simulabra/logs`): `FileTail`, `LogFormatter`, `LogStreamer`
  - `LogFormatter.colors` default: `() => ({})` (empty)
  - `LogFormatter.defaultColor` default: `'\x1b[37m'` (white)
  - `LogFormatter.colorFor(sourceName)`: returns `colors()[sourceName] || defaultColor()`
  - `LogStreamer.sourceNameFromFile(filename)`: strips extension from filename

- `apps/agenda/src/logs.js` (agenda-specific):
  - `AgendaLogFormatter`: extends `LogFormatter`, overrides `colors` default with supervisor=cyan, DatabaseService=green, ReminderService=yellow, GeistService=magenta
  - `AgendaLogStreamer`: extends `LogStreamer`, overrides `formatter` default to use `AgendaLogFormatter`

## New Tests to Add

| Test Name | What It Covers |
|---|---|
| `BaseLogFormatterDefaultColor` | `LogFormatter.new().colorFor('anything')` returns `\x1b[37m` (white default) |
| `AgendaLogFormatterColors` | `AgendaLogFormatter` maps supervisor→cyan, DatabaseService→green, ReminderService→yellow, GeistService→magenta, unknown→white |
| `AgendaLogFormatterFormat` | `AgendaLogFormatter.format('GeistService', 'msg')` includes magenta |
| `AgendaLogStreamerDefaultFormatter` | `AgendaLogStreamer.new()` creates an `AgendaLogFormatter` as its default formatter |

## Files to Modify
- `apps/agenda/tests/logs.js`

## Acceptance Criteria
- [ ] All existing log tests pass (the 2 bugs are fixed)
- [ ] Base LogFormatter color behavior tested separately from AgendaLogFormatter
- [ ] AgendaLogFormatter and AgendaLogStreamer have direct tests
- [ ] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/logs.js` passes
- [ ] `bun run test` clean
