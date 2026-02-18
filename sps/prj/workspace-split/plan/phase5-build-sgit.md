# Phase 5: Build sgit

## Goal
Build the multi-repo git helper as a Simulabra module in `core/bin/sgit.js`. Configurable via `sgit.json` in the workspace root. Exposed as a bin entry point so it's available on PATH after `bun install`.

## Design

### Classes

**SgitConfig** — loads and validates sgit.json
- Walks up from cwd to find `sgit.json` (like `.git/` discovery)
- Resolves repo paths relative to the config file's directory
- Slots: `configPath` (Var), `repos` (Var, array of SgitRepo)
- Static: `find()` — walks up cwd, returns SgitConfig instance

**SgitRepo** — wraps a single git repo
- Slots: `path` (Var), `label` (Var)
- Methods: `exec(args)` — runs `git <args>` in this repo's directory, returns stdout/stderr/exitCode
- Methods: `exists()` — checks if path is a valid git repo

**Sgit** — top-level orchestrator
- Slots: `config` (Var, SgitConfig)
- Methods: `run(args)` — dispatches to built-in command or passthrough
- Built-in commands with custom formatting: `status`, `diff`, `branch`
- Passthrough: any unrecognized subcommand runs `git <subcommand> <args>` in each repo

### Built-in Commands

**status** — compact overview:
```
core        clean
demos       clean
agenda      2 modified
swyperloom  clean
sps         1 untracked
```

**diff** — labeled output per repo:
```
── core ──────────────────────
(no changes)
── agenda ────────────────────
diff --git a/src/models.js b/src/models.js
...
```

**branch** — show current branch per repo:
```
core        main
demos       main
agenda      feature/x
swyperloom  main
sps         main
```

With args (e.g. `sgit branch feature/new`): create/switch in all repos.

**pull** — fetch and pull each repo, show result:
```
core        Already up to date.
agenda      Fast-forward: 3 files changed
...
```

**commit** — only operates on repos with staged changes:
```
sgit commit -m "message"
# runs git commit -m "message" in each repo that has staged changes
# skips repos with nothing staged
# reports what was committed where
```

### Passthrough
Any command not in the built-in list is forwarded verbatim:
```bash
sgit log --oneline -5
# runs: git log --oneline -5 in each repo, with repo labels
```

### Entry Point
`core/bin/sgit.js` with `import.meta.main` block:
```js
if (import.meta.main) {
  const args = process.argv.slice(2);
  const config = $.SgitConfig.find();
  const sgit = $.Sgit.new({ config });
  await sgit.run(args);
}
```

### Package.json Integration
Add to `core/package.json`:
```json
"bin": {
  "sgit": "./bin/sgit.js"
}
```
After `bun install` at workspace root, `sgit` is in `node_modules/.bin/` and available on PATH.

## Key Files
- `core/bin/sgit.js` (new)
- `core/package.json` (add bin entry)
- `~/projects/simulabra/sgit.json` (already created in Phase 1)

## Testing
Add `tests/sgit.js` in core:
- Test SgitConfig.find() with a temp directory structure
- Test SgitRepo.exec() against a real git repo (use tmp)
- Test Sgit.run(['status']) output formatting
- Test passthrough command forwarding

## Potential Issues
- **Bun subprocess spawning**: `Bun.spawn` or `child_process.execSync` for git commands. Bun.spawn is async and returns streams — need to collect stdout. May want `Bun.spawnSync` for simplicity since git commands are fast.
- **Color output**: git commands may or may not output ANSI colors depending on whether stdout is a TTY. May want `--color=always` for passthrough commands to preserve colors.
- **Error handling**: A repo that doesn't exist (not yet cloned) should warn, not crash. `SgitRepo.exists()` checks this.
- **PATH availability**: The `bin` field in package.json makes sgit available via `npx sgit` or `bun run sgit`. For bare `sgit` on PATH, the user may need to add `node_modules/.bin` to their PATH or alias it.

## Acceptance Criteria
- `sgit status` shows all 5 repos with dirty/clean state
- `sgit diff` shows labeled diffs per repo
- `sgit branch` shows current branch per repo
- `sgit log --oneline -3` (passthrough) shows logs per repo
- `sgit.json` is found from any subdirectory within the workspace
- Tests pass in core
