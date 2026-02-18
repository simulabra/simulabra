# Phase 1: Prerequisites and Workspace Foundation

## Goal
Set up everything needed before extraction begins. Install tools, create the workspace root, export the test runner. After this phase, core is unchanged except for a new export in package.json.

## Steps

### 1.1 Install git-filter-repo
```bash
pip install git-filter-repo
# or: pacman -S git-filter-repo (if on Arch)
```
Verify: `git filter-repo --help` runs without error.

### 1.2 Ensure core is pushed
All current work should be committed and pushed. The `e983e8f about to split` commit is the baseline. Any dirty files (modified tests, sps project files) should be committed first.

### 1.3 Create workspace root package.json
Write `~/projects/simulabra/package.json`:
```json
{
  "name": "simulabra-world",
  "version": "0.0.1",
  "private": true,
  "workspaces": [
    "core",
    "demos",
    "agenda",
    "swyperloom"
  ]
}
```
Note: `private: true` prevents accidental publishing of the workspace root. The workspace members won't exist yet (except core) — that's fine, bun handles missing members gracefully during install.

### 1.4 Create sgit.json stub
Write `~/projects/simulabra/sgit.json`:
```json
{
  "repos": [
    { "path": "core", "label": "core" },
    { "path": "demos", "label": "demos" },
    { "path": "agenda", "label": "agenda" },
    { "path": "swyperloom", "label": "swyperloom" },
    { "path": "sps", "label": "sps" }
  ]
}
```

### 1.5 Export test runner from core
Add to core's `package.json` exports:
```json
"./runner": "./src/runner.js"
```
The runner uses relative imports (`./base.js`, `./test.js`) which resolve correctly since it lives in `src/`. No changes to runner.js itself.

### 1.6 Remove workspace config from core's package.json
Core currently has `"workspaces": ["apps/*"]` because it IS the workspace root today. This conflicts with the parent becoming the workspace root. Remove it from core's package.json. The `file:../..` dependency in apps still resolves during the transition because the apps are about to be extracted anyway.

## Potential Issues
- **bun workspace conflict**: Having workspaces declared in both the parent and core could confuse bun. Removing core's workspace config in this phase (before extraction) means apps/agenda and apps/swyperloom temporarily lose their workspace linking. Since we're about to extract them, this is acceptable — but don't run `bun install` in core between this step and Phase 3.
- **Dirty working tree**: The git status shows modified test files and sps project files. These need to be committed before extraction or they'll be lost in the filter-repo clones.

## Key Files
- `~/projects/simulabra/package.json` (new)
- `~/projects/simulabra/sgit.json` (new)
- `core/package.json` (modified: add runner export, remove workspaces)

## Acceptance Criteria
- `git filter-repo --help` succeeds
- `~/projects/simulabra/package.json` exists with correct workspaces list
- `~/projects/simulabra/sgit.json` exists with all 5 repos
- core's package.json exports `./runner` and no longer has `workspaces`
- core's working tree is clean (everything committed)
