# Phase 7: Dead Code Audit and Yard Migration

## Goal
Move confirmed dead and legacy-only code out of the core repo tree into `../../yard/` (i.e. `/home/ras/projects/simulabra/yard/`), preserving directory structure. Clean up dangling references.

## Research (complete)
Full audit at `docs/dead-code.md`. Import graph traced from all entry points.

## Yard Moves (preserving directory structure under yard/)

### Section 1 — Confirmed Dead
1. `contexts/master.js` — dead WebSocket server
2. `misc/protobench.js` — old-API benchmark
3. `misc/doc/simulabra-x.jsx` — JSX syntax sketch
4. `misc/doc/syntax.txt` — sigil syntax sketch
5. `misc/lisp.txt` — completor sketch
6. `misc/live.txt` — distributed objects notes
7. `misc/prompts/` (all 7 files) — old prompt templates
8. `bin/pm-runner.js` — vestigial runner

### Section 2 — Legacy (test-only, no production use)
9. `demos/agenda.js` — superseded todo prototype
10. `tests/agenda.js` — tests for above
11. `tests/bf.js` — brainfuck novelty test
12. `apps/agenda/src/redis.js` — vestigial Redis adapter

## Fixups After Moves
- Remove `"agent"` and `"serve"` scripts from `package.json` (reference nonexistent `src/agent.js`)
- Check `src/pm.js:487` pm-runner path reference — update or remove
- Audit agenda test files importing `redis.js` — remove import or update tests
- Run `bun run test` to confirm nothing breaks

## Acceptance Criteria
- All listed files moved to yard with structure preserved
- `bun run test` passes
- No dangling imports remain
- package.json cleaned of dead script entries
