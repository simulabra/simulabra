# Phase 2: Extract Repos with git filter-repo

## Goal
Create four new git repos (agenda, swyperloom, demos, sps) by extracting subdirectories from core with full git history preserved. Core remains completely intact — this phase is purely additive.

## Steps

### 2.1 Extract agenda
```bash
cd /tmp
git clone ~/projects/simulabra/core simulabra-agenda-extract
cd simulabra-agenda-extract
git filter-repo --subdirectory-filter apps/agenda
```
This rewrites history so `apps/agenda/` becomes the repo root. All commits that never touched `apps/agenda/` are removed. Files that were at `apps/agenda/src/models.js` become `src/models.js`.

Move into place:
```bash
mv /tmp/simulabra-agenda-extract ~/projects/simulabra/agenda
```

### 2.2 Extract swyperloom
```bash
cd /tmp
git clone ~/projects/simulabra/core simulabra-swyperloom-extract
cd simulabra-swyperloom-extract
git filter-repo --subdirectory-filter apps/swyperloom
mv /tmp/simulabra-swyperloom-extract ~/projects/simulabra/swyperloom
```

### 2.3 Extract demos
```bash
cd /tmp
git clone ~/projects/simulabra/core simulabra-demos-extract
cd simulabra-demos-extract
git filter-repo --subdirectory-filter demos
mv /tmp/simulabra-demos-extract ~/projects/simulabra/demos
```

### 2.4 Extract sps
```bash
cd /tmp
git clone ~/projects/simulabra/core simulabra-sps-extract
cd simulabra-sps-extract
git filter-repo --subdirectory-filter sps
mv /tmp/simulabra-sps-extract ~/projects/simulabra/sps
```
Note: sps is NOT a workspace member (no package.json, no code imports). It's just a data repo.

### 2.5 Update agenda package.json
In `~/projects/simulabra/agenda/package.json`, change:
```json
"simulabra": "file:../.."
```
to:
```json
"simulabra": "workspace:*"
```
Remove the `cd ../..` prefix from test scripts — these will be fixed in Phase 3.

### 2.6 Update swyperloom package.json
Same `file:../..` → `workspace:*` change.
Same test script prefix cleanup.

### 2.7 Create demos package.json
Demos doesn't have one yet. Create `~/projects/simulabra/demos/package.json`:
```json
{
  "name": "demos",
  "version": "0.0.1",
  "type": "module",
  "dependencies": {
    "simulabra": "workspace:*"
  }
}
```

### 2.8 Set up git remotes for new repos
Each extracted repo needs its own remote (create GitHub repos or defer).
For now, remove the origin remote pointing to the core repo:
```bash
cd ~/projects/simulabra/agenda && git remote remove origin
cd ~/projects/simulabra/swyperloom && git remote remove origin
cd ~/projects/simulabra/demos && git remote remove origin
cd ~/projects/simulabra/sps && git remote remove origin
```

## Potential Issues
- **filter-repo requires a fresh clone**: It refuses to run on a repo with an `origin` remote (safety measure). That's why we clone to /tmp first.
- **Commits that span apps/ and src/**: These appear in both core and the extracted repo, but with different hashes (since the tree is rewritten). This is cosmetic — file-level blame is preserved.
- **sps contains the workspace-split project itself**: The extracted sps will have the design.md and phase files we're writing right now. That's fine — it's correct for sps to own this. But any changes we make to sps AFTER extraction will only be in core's copy until we switch over.
- **Large clone size**: If the repo has large binary blobs, the /tmp clones may be large. Unlikely to be an issue here.
- **demos filter-repo path**: demos/ is a top-level directory in core (not under apps/), so `--subdirectory-filter demos` works directly.

## Key Files
- `~/projects/simulabra/agenda/` (new repo)
- `~/projects/simulabra/swyperloom/` (new repo)
- `~/projects/simulabra/demos/` (new repo)
- `~/projects/simulabra/sps/` (new repo)
- Each repo's `package.json` (updated or created)

## Acceptance Criteria
- Four new directories exist as independent git repos
- `git log` in each repo shows relevant history with correct file paths
- `git log --oneline agenda/src/models.js` (from the agenda repo) shows commit history
- agenda and swyperloom package.json use `workspace:*` dep
- demos has a package.json with `workspace:*` dep
- No changes were made to `~/projects/simulabra/core/`
