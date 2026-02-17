# Dead Code Audit — Simulabra Core

Conducted 2026-02-16. Maps all entry points, traces the import graph, and identifies code unreachable from any live path.

Disposition: move to `/home/ras/projects/simulabra/yard/` (outside the core repo tree).

---

## 1. Confirmed Dead Code (tracked in git, unreachable)

### contexts/master.js (131 lines)
Standalone WebSocket server for routing messages between `live` nodes. Defines `WebsocketServer` and `HandshakeHandler`. Not imported by anything. The live/RPC system moved to `demos/dummy/` and the agenda app uses its own supervisor WebSocket.

### misc/protobench.js (179 lines)
Benchmark comparing Simulabra dispatch against native JS. Uses the *old* API (`components` instead of `slots`, lowercase `$.class`). Would not run against current `src/base.js`.

### misc/doc/simulabra-x.jsx (19 lines)
JSX syntax exploration for defining Simulabra classes. Never implemented.

### misc/doc/syntax.txt (15 lines)
Terse lisp-influenced sigil notation sketch (`~class`, `!type`, `%arg`). Never implemented.

### misc/lisp.txt (~30 lines)
Sketch for a lisp-like completor-fetch command system. References a dead server address.

### misc/live.txt (~20 lines)
Design notes for distributed live objects (`simulabra://palace.simulabra.com/`). Predates current RPC.

### misc/prompts/ (7 files, ~200 lines total)
Old LLM prompt templates: `completion.md`, `crc.txt`, `jsxconvert.md`, `miaow.txt`, `module.md`, `test.md`, `tut.md`. Predates the CLAUDE.md/skill system. Not referenced by any code.

### bin/pm-runner.js (31 lines)
Per-service runner entry point. Referenced by `src/pm.js` PMManager.start path, but `simulabractl` now uses `Bun.spawn` directly. Likely vestigial.

### package.json: dead script entries
- `"agent"` and `"serve"` both reference `src/agent.js` which does not exist.

---

## 2. Legacy Code (alive through tests only, no production use)

### demos/agenda.js (189 lines)
Original todo/agenda prototype with `Todo`, `Note`, `Journal`, `ScheduleMemo`, `Agenda`. Uses old `$db.Persisted` mixin. Completely superseded by `apps/agenda/`. Only imported by `tests/agenda.js`.

### tests/agenda.js (~40 lines)
Tests for `demos/agenda.js`. Exercises the old model. Validates nothing that matters now.

### tests/bf.js (153 lines)
Brainfuck interpreter as a Simulabra class with 5 test cases. Purely a novelty/stress test. Not used by anything.

### apps/agenda/src/redis.js (28 lines)
Re-exports `RedisVar`, `RedisClient`, `RedisPersisted` from core `db.js` with `agenda:` prefix. No production agenda code imports it — only test files (`tests/redis.js`, `tests/integration.js`, `tests/chat.js`, `tests/services/geist.js`, `tests/services/reminder.js`).

---

## Yard Manifest

Files to move to `yard/`, preserving directory structure:

```
yard/
  contexts/master.js
  misc/protobench.js
  misc/doc/simulabra-x.jsx
  misc/doc/syntax.txt
  misc/lisp.txt
  misc/live.txt
  misc/prompts/completion.md
  misc/prompts/crc.txt
  misc/prompts/jsxconvert.md
  misc/prompts/miaow.txt
  misc/prompts/module.md
  misc/prompts/test.md
  misc/prompts/tut.md
  bin/pm-runner.js
  demos/agenda.js
  tests/agenda.js
  tests/bf.js
  apps/agenda/src/redis.js
```

Fixups required after move:
- Remove `tests/agenda.js` and `tests/bf.js` from test suite (runner auto-discovers, so just removing the files suffices)
- Remove dead `"agent"` and `"serve"` scripts from `package.json`
- Audit agenda test files that import `redis.js` — they will need the import removed or the tests updated
- Verify `bin/pm-runner.js` path reference in `src/pm.js:487` is truly unused before yarding
