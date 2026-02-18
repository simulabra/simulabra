# Phase 6: Agent Config and CLAUDE.md Decomposition

## Goal
Distribute agent configuration (skills, CLAUDE.md, settings) across repos. Build the skill distribution script. Each repo becomes a self-contained agent launch point.

## Steps

### 6.1 Decompose CLAUDE.md

**Top-level (`~/projects/simulabra/CLAUDE.md`):**
- InfiniteSoftware tagline and Spirit section
- Workspace layout description (what's in each repo)
- sgit usage
- Cross-repo conventions (how to make changes that span repos)
- Pointer to core/CLAUDE.md for coding standards
- sps project system conventions
- DoYourJob section routing to appropriate repos

**Core (`core/CLAUDE.md`):**
- CodingStandards (as-is)
- Patterns / AntiPatterns (as-is)
- Testing section (updated: core tests only, not app tests)
- Developing section (updated: no references to apps/)
- HTML section (as-is, it's about the core html.js module)
- Navigating section (as-is)
- LaunchPoints (updated: core-only entry points)

**Agenda (`agenda/CLAUDE.md`):**
- Already comprehensive and accurate
- Update: remove `cd ../..` references in testing commands
- Update: any path references from `apps/agenda/` to root-relative

**Swyperloom (`swyperloom/CLAUDE.md`):**
- Already exists
- Update: build path references

**Demos (`demos/CLAUDE.md`):**
- New, minimal: list the demos, how to build, how to run
- Note that demos import from `'simulabra'` via workspace linking

### 6.2 Categorize skills by owner

Skills to audit (read each skill's prompt file to understand what it references):

**Core-owned (shared to all repos):**
- `list-classes` — reads Simulabra source files, no app-specific paths
- `find-slot-impls` — grep-based, works in any repo
- `tree` — reads file structure, works anywhere
- `inspector` — reviews code changes, generic
- `architect` — writes plans to sps/, references project system
- `carpenter` — builds from plans, generic
- `foreman` — orchestrates skills, generic
- `tmux` — session management, generic
- `operator` — drives and breaks software, generic

**Agenda-owned:**
- `simulabractl` — manages agenda services specifically
- `evals` — runs agenda geist evals

### 6.3 Build skill distribution script

Create `core/bin/build-skills.js` — a Simulabra module that:
1. Reads a manifest declaring which skills each repo needs
2. Symlinks shared skills from core's `.claude/skills/` into target repos
3. Preserves repo-owned skills (doesn't overwrite)

Manifest could be in `sgit.json` (extend it) or a separate file.

Alternatively, simpler approach: a shell script that symlinks:
```bash
#!/bin/bash
# build-skills.sh — run from workspace root
CORE=core/.claude/skills
SHARED=(list-classes find-slot-impls tree inspector architect carpenter foreman tmux operator)

for repo in agenda swyperloom demos; do
  mkdir -p $repo/.claude/skills
  for skill in "${SHARED[@]}"; do
    ln -sfn ../../../core/.claude/skills/$skill $repo/.claude/skills/$skill
  done
done
```

The Simulabra module version is better long-term (discoverable, testable, extensible) but the shell script works now.

### 6.4 Distribute .claude/settings.local.json

Each repo needs its own settings with:
- Permission patterns updated for new paths (no more `git -C /home/ras/projects/simulabra/core`)
- Skill permissions matching available skills
- Output style preference

The top-level `~/projects/simulabra/.claude/settings.local.json` should have broad permissions for sgit and cross-repo operations.

### 6.5 Set up .claude/agents/ per repo
Move or create agent configurations appropriate to each repo. Core's current `.claude/agents/` may have agents that reference app-specific files — these move to the appropriate repo.

### 6.6 Initialize git repos for workspace root and demos
```bash
# Workspace root
cd ~/projects/simulabra
git init
echo "node_modules/" > .gitignore
echo "bun.lockb" >> .gitignore
git add package.json sgit.json CLAUDE.md .gitignore
git commit -m "initialize simulabra-world workspace"

# Demos (already has git from filter-repo, just commit the import changes)
cd ~/projects/simulabra/demos
git add -A
git commit -m "rewrite imports from relative paths to simulabra package names"
```

## Potential Issues
- **Symlink depth**: Skills symlinked as `../../../core/.claude/skills/foo` are relative — they break if the directory structure changes. Absolute symlinks are more robust but less portable.
- **Skill prompt content**: Some skills may hardcode paths like `sps/prj/` relative to core. After the split, sps is a sibling. Skills need to reference sps via `../../sps/` or dynamically resolve it. Read each skill's prompt to check.
- **Agent context**: When claude code launches in `agenda/`, it reads `agenda/CLAUDE.md`. If that CLAUDE.md says "use the foreman", the foreman skill (symlinked from core) may reference paths that don't exist in agenda's tree. The foreman's prompt needs to be workspace-aware.
- **Settings permissions**: The current settings have very specific `Bash()` patterns with full paths. These all need updating.

## Key Files
- `~/projects/simulabra/CLAUDE.md` (new)
- `core/CLAUDE.md` (rewritten)
- `demos/CLAUDE.md` (new)
- `core/bin/build-skills.js` or `build-skills.sh` (new)
- `*/.claude/settings.local.json` (updated per repo)

## Acceptance Criteria
- Each repo has a CLAUDE.md appropriate to its scope
- `agenda/.claude/skills/` contains symlinks to core's shared skills plus its own
- `swyperloom/.claude/skills/` contains symlinks to shared skills
- `demos/.claude/skills/` contains symlinks to shared skills
- Agent launched from any repo sees the correct skills
- Workspace root has its own git repo with workspace config committed
- `build-skills` can be re-run to refresh symlinks after changes
