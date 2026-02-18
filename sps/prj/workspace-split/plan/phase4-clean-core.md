# Phase 4: Clean Core

## Goal
Remove the now-extracted directories from core's tree. This is the only destructive phase — it runs only after Phase 3 verification passes. A backup branch is created first.

## Precondition
Phase 3 acceptance criteria are ALL met. All tests pass from extracted repo locations. This is a hard gate — do not proceed if any test fails.

## Steps

### 4.1 Create backup branch
```bash
cd ~/projects/simulabra/core
git checkout -b pre-workspace-split
git checkout main
```
This preserves the complete pre-split state on a named branch. If anything goes wrong, `git checkout pre-workspace-split` restores everything.

### 4.2 Remove extracted directories
```bash
cd ~/projects/simulabra/core
rm -rf apps/
rm -rf demos/
rm -rf sps/
```

### 4.3 Clean up stale root-level artifacts
Verify and remove stale files that belonged to apps:
```bash
# Check if these are stale (they should be — agenda has its own copy)
ls -la agenda.db todos.db
# If stale, remove:
rm -f agenda.db todos.db
```

### 4.4 Update core's package.json
- Remove the `"workspaces"` field (already done in Phase 1)
- Remove test scripts that reference apps:
  - `"test-ui"` if it pointed to apps
  - `"test-swyperloom"` — remove entirely
- Keep `"test"` pointing to core's own test suite
- Keep all exports intact

### 4.5 Update core's .gitignore
Add entries for workspace-level artifacts that shouldn't be tracked:
```
# These are at the workspace root level now
agenda.db
todos.db
```

### 4.6 Commit
```bash
cd ~/projects/simulabra/core
git add -A
git commit -m "remove extracted directories (apps/, demos/, sps/) — now sibling repos in simulabra-world workspace"
```

### 4.7 Verify core tests
```bash
cd ~/projects/simulabra/core
bun run test
```
Core's own tests (tests/core.js, tests/simple.js, etc.) should not reference anything in apps/ or demos/. If any test fails, it means there's an unexpected dependency.

### 4.8 Re-verify workspace
```bash
cd ~/projects/simulabra
bun install
cd agenda && bun run test
cd ../swyperloom && bun run test
```
Make sure removing apps/ from core didn't break workspace resolution.

## Potential Issues
- **Core tests that import from apps**: If any core test imports from `apps/`, it will break. Scan first:
  ```bash
  grep -r 'apps/' core/tests/ core/src/
  ```
  Any hits need to be addressed before deletion.
- **Scripts in bin/ that reference apps/**: `bin/build` may reference `apps/swyperloom`. Check and update.
- **The sps project we're working from**: After this phase, the workspace-split project files in `core/sps/` are gone. The canonical copy is now in `~/projects/simulabra/sps/`. Make sure Phase 2's sps extraction captured the latest files, or copy them over before deleting.
- **CLAUDE.md references**: Core's CLAUDE.md references `apps/agenda/`, `demos/loom.js`, etc. These paths are now wrong. This will be fixed in Phase 6 (CLAUDE.md decomposition), but note the temporary inconsistency.

## Key Files
- `core/apps/` (deleted)
- `core/demos/` (deleted)
- `core/sps/` (deleted)
- `core/package.json` (test scripts cleaned)
- `core/agenda.db`, `core/todos.db` (deleted if stale)

## Rollback
```bash
cd ~/projects/simulabra/core
git checkout pre-workspace-split
```
This restores the complete pre-split state instantly.

## Acceptance Criteria
- `core/apps/`, `core/demos/`, `core/sps/` no longer exist
- `pre-workspace-split` branch exists as safety net
- `bun run test` in core passes (core's own tests)
- `bun run test` in agenda passes (workspace resolution still works)
- `bun run test` in swyperloom passes
- No stale `.db` files in core root
