# Workspace Split: Design Document

## Goal

Split the simulabra monorepo (`core/`) into independent git repositories under the existing `~/projects/simulabra/` parent directory, linked by a bun workspace at the top level. Each repo has its own git history, agent config, and identity — while imports remain unchanged (`from 'simulabra'`) thanks to workspace resolution.

## Target Layout

```
~/projects/simulabra/
├── package.json             ← bun workspace root: { "workspaces": ["core", "demos", "agenda", "swyperloom"] }
├── CLAUDE.md                ← top-level agent overview, skill routing
├── sgit                     ← multi-repo git helper (Simulabra module)
│
├── core/                    ← git repo: metaobject system
│   ├── src/                 ← base.js, html.js, db.js, llm.js, etc.
│   ├── tests/               ← core framework tests only
│   ├── bin/                 ← core-specific tooling (gen-exports, build, tree, lister, etc.)
│   ├── .claude/skills/      ← core-scoped skills (list-classes, find-slot-impls, tree, inspector)
│   ├── .claude/agents/      ← core-scoped agents
│   ├── CLAUDE.md            ← core-specific coding standards, patterns, anti-patterns
│   └── package.json         ← name: "simulabra", exports: { ".": "./src/base.js", ... }
│
├── demos/                   ← git repo: demonstrations and prototypes
│   ├── loom.js, loom.html   ← branching LLM interface
│   ├── counter.js/html      ← reactive counter demo
│   ├── dummy/               ← RPC system prototype (client + service)
│   ├── index.js/html        ← demo index
│   ├── .claude/skills/
│   ├── CLAUDE.md
│   └── package.json         ← name: "demos", dependencies: { "simulabra": "workspace:*" }
│
├── agenda/                  ← git repo: personal productivity app
│   ├── src/                 ← models, services, tools, sqlite, provider, etc.
│   ├── tests/               ← all agenda tests
│   ├── evals/               ← geist eval framework
│   ├── bin/                 ← agenda CLI scripts
│   ├── .claude/skills/      ← agenda-scoped skills (simulabractl, evals, operator)
│   ├── CLAUDE.md            ← agenda architecture, models, tools, services docs
│   └── package.json         ← name: "agenda", dependencies: { "simulabra": "workspace:*" }
│
├── swyperloom/              ← git repo: mobile loom interface
│   ├── src/
│   ├── tests/
│   ├── dist/
│   ├── .claude/skills/
│   ├── CLAUDE.md
│   └── package.json         ← name: "swyperloom", dependencies: { "simulabra": "workspace:*" }
│
└── sps/                     ← git repo: agent work products (not a workspace member)
    ├── prj/                 ← project plans, design docs
    └── projects.jsonl
```

## Non-Goals

- Publishing core to npm (all resolution is local via workspace linking)
- Deploying agenda remotely (local-only for now)
- Moving non-app directories (cad, extra, operat, prompts, pyserver, site, yard) — they stay as-is

## Challenges

### 1. Git History Preservation

**Problem:** Apps currently live in `core/apps/agenda/` and `core/apps/swyperloom/`. We want their git history (blame, log) to survive the split.

**Approach:** Use `git filter-repo` to extract each app's subdirectory into a new repo with rewritten paths. The core repo then removes `apps/` and `sps/` from its tree (but old history remains in the log, just no longer at HEAD).

**Steps per app:**
1. Clone core into a temp directory
2. `git filter-repo --subdirectory-filter apps/agenda` — rewrites history so `apps/agenda/` becomes root
3. Move the resulting repo to `~/projects/simulabra/agenda/`
4. Repeat for swyperloom, demos, sps

**Risk:** Shared commits that touched both core and apps will appear in both repos with different hashes. This is cosmetic — the file-level history is preserved.

### 1b. Demos Import Rewriting

**Problem:** Demos currently use relative imports (`../src/base.js`, `../src/html.js`) and HTML `<script src="../src/...">` tags pointing into core's source tree. After extraction, these paths break.

**Approach:** As part of the demos extraction, rewrite all imports to use the package name:
- JS: `from '../src/base.js'` → `from 'simulabra'`
- JS: `from '../src/html.js'` → `from 'simulabra/html'`
- HTML `<script>` tags: these need a bundled entry point or a dev server that resolves workspace imports. Demos will need a package.json with `"simulabra": "workspace:*"` and a build step (like swyperloom already has).

**Affected files:** loom.js, counter.js, index.js, dummy/client.js, dummy/service.js, plus all HTML entry points.

### 2. Test Runner Location

**Problem:** The test runner (`src/runner.js`) lives in core. Apps currently run tests via `cd ../.. && bun run src/runner.js apps/agenda/tests/`. After the split, this path breaks.

**Approach:** Core exports the runner as a package entry point:
```json
// core/package.json
"exports": {
  "./runner": "./src/runner.js"
}
```
Apps invoke it via:
```json
// agenda/package.json
"scripts": {
  "test": "bun run node_modules/simulabra/src/runner.js tests/"
}
```
Or better: a thin wrapper script in each app that imports and runs it:
```js
// agenda/bin/test.js
import { __, base } from 'simulabra';
import runner from 'simulabra/runner';
// runner handles the rest
```

### 3. Multi-Repo Git Operations (sgit)

**Problem:** Operating on 4+ repos individually is tedious. Need a unified tool for status, pull, push, diff, branch, commit across all repos.

**Location:** `core/bin/sgit.js` — lives in core so it ships with simulabra and anyone can use it. Installed as a bin entry point via core's package.json.

**Configuration:** `sgit.json` in the workspace root (world dir). Declares the repos sgit manages, their paths, and any per-repo settings.

```json
// ~/projects/simulabra/sgit.json
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

sgit walks up from cwd to find `sgit.json` (like how git walks up to find `.git/`). Paths in the config are relative to the json file's directory.

**Architecture:** Simulabra module with Configurable mixin. Key classes:
- `SgitConfig` — loads and validates sgit.json, resolves repo paths
- `SgitRepo` — wraps a single repo: path, label, exec git commands against it
- `Sgit` — top-level orchestrator, iterates repos, formats combined output

**Scope (initial):**
- `sgit status` — show dirty/clean state of each repo
- `sgit pull` — fetch + pull all repos
- `sgit diff` — show diffs across all repos
- `sgit branch` — list/create/switch branches across repos
- `sgit commit` — coordinated commit across repos that have staged changes

**Growth path:** Encompass all git operations over time. Any unrecognized subcommand is forwarded to git in each repo: `sgit log --oneline -5` runs `git log --oneline -5` in every repo. Custom formatting/aggregation for known commands, passthrough for everything else.

**Package integration:**
```json
// core/package.json
"bin": {
  "sgit": "./bin/sgit.js"
}
```
After `bun install` at the workspace root, `sgit` is available on PATH from `node_modules/.bin/`.

### 4. Agent Config Distribution

**Problem:** Skills, hooks, and CLAUDE.md currently live in `core/.claude/`. After the split, each repo needs its own agent config, but some skills are cross-cutting (foreman, architect, carpenter) and some are repo-specific (simulabractl for agenda, evals for agenda).

**Approach:** Each repo owns its own `.claude/` directory with skills relevant to it. A build script assembles/links cross-cutting skills into each repo's `.claude/skills/` so the agent sees them when launched from that directory.

**Skill distribution:**
| Skill | Owner | Shared to |
|-------|-------|-----------|
| list-classes | core | all repos |
| find-slot-impls | core | all repos |
| tree | core | all repos |
| inspector | core | all repos |
| architect | core | all repos |
| carpenter | core | all repos |
| foreman | core | all repos |
| simulabractl | agenda | — |
| evals | agenda | — |
| tmux | core | all repos |
| operator | core | all repos |

**Build script** (`build-skills` or similar): symlinks or copies shared skills from core into each app's `.claude/skills/`. Run after cloning or when skills change.

### 5. Workspace Dependency Wiring

**Problem:** Apps currently use `"simulabra": "file:../.."`. After the split, the relationship is through the workspace root.

**Approach:** Use bun's `workspace:*` protocol:
```json
// agenda/package.json
"dependencies": {
  "simulabra": "workspace:*"
}
```
The workspace root's `package.json` lists all members:
```json
// ~/projects/simulabra/package.json
"workspaces": ["core", "demos", "agenda", "swyperloom"]
```
Bun resolves `import 'simulabra'` to `../core/` automatically. No source code changes needed.

### 6. Build Output Location

**Problem:** `bin/build` currently outputs to `core/out/`. Swyperloom builds to `core/out/swyperloom/`. After the split, each app should own its own build output.

**Approach:** Each app has its own `dist/` or `out/` directory. The build script in each app writes there. Swyperloom already has `dist/` — just update the build script paths.

### 7. CLAUDE.md Decomposition

**Problem:** The current CLAUDE.md in core describes the entire system: metaobject patterns, coding standards, app architecture, testing, skills, launch points. This needs to split into repo-appropriate pieces.

**Approach:**
- **Top-level CLAUDE.md:** System overview, workspace layout, sgit usage, cross-repo conventions, kaizen spirit. Points agents to the right repo for each task.
- **core/CLAUDE.md:** Metaobject system, coding standards, patterns/anti-patterns, testing framework, base.js internals.
- **agenda/CLAUDE.md:** Already exists and is comprehensive. Minor path updates needed.
- **swyperloom/CLAUDE.md:** Already exists. Minor updates.
- **sps/CLAUDE.md:** Minimal — describes project structure conventions.

### 8. Database Files and Runtime Artifacts

**Problem:** `agenda.db`, `todos.db`, `logs/` currently live in core root. After the split, they should live in their respective app directories.

**Approach:** agenda.db moves with agenda (it's already duplicated in `apps/agenda/agenda.db`). Core's root-level `.db` files are likely stale artifacts — verify and remove. Each repo's `.gitignore` covers its own runtime artifacts.

### 9. sps as Non-Workspace Data Repo

**Problem:** sps holds agent project data (plans, design docs). It has no package.json and no code imports. But agents need to read/write it.

**Approach:** sps is a plain git repo at `~/projects/simulabra/sps/`, not listed in the workspace. Agents access it by path convention. The top-level CLAUDE.md documents this convention. If agents are launched from an app repo, they find sps at `../../sps/` or via an environment variable / config.

**Alternative:** Keep sps inside core (it's really agent infrastructure). But separating it keeps core's git log focused on code.

## Migration Order

1. **Prepare core** — export test runner, clean up root-level db files
2. **Create workspace root** — package.json, CLAUDE.md at `~/projects/simulabra/`
3. **Extract agenda** — git filter-repo from core, move to sibling, update package.json deps
4. **Extract swyperloom** — same process
5. **Extract demos** — git filter-repo, rewrite relative imports to package names, add package.json + build step
6. **Extract sps** — simpler (no package.json needed, just git filter-repo the directory)
7. **Clean core** — remove apps/, demos/, sps/ from core's tree, update core's workspace/package.json
8. **Wire workspace** — `bun install` at workspace root, verify all imports resolve
9. **Build sgit** — multi-repo git helper
10. **Build skill distribution** — build-skills script for shared agent config
11. **Decompose CLAUDE.md** — split into per-repo docs
12. **Update .claude/settings** — permission paths reference new repo structure
13. **Verify** — run all tests from workspace root, run from each app, check agent launch

## Decisions

- **Top-level package name:** `simulabra-world`
- **Directory structure:** stays as `~/projects/simulabra/` — no renaming
- **Core package name:** stays `simulabra` (will publish as simulabra/simulabra)
- **sgit location:** `core/bin/sgit.js` — ships with simulabra, reusable by anyone
- **sgit config:** `sgit.json` in the workspace root, walked up from cwd

## Open Questions

- **Deployment path for swyperloom:** When the time comes, build from workspace or from swyperloom repo independently?
- **Other sibling directories** (cad, extra, operat, prompts, pyserver, site, yard): do any of these become workspace members eventually?
