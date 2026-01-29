# Simulabra Process Manager (SPM) — Specification + Implementation Plan

## Problem
Coding agents (and humans) currently start long‑running dev services by forking commands in a shell with `&`. In practice these processes:

- die when the spawning shell exits (or when an agent command finishes)
- are hard to discover/stop later (no consistent pid/state)
- scatter logs (or lose logs entirely)
- require “tribal knowledge” of which command starts which service

We want a Simulabra-native process manager with a simple CLI for local development services in this repo/workspace.

## Goals
- **Single obvious interface**: `simulabractl list|start|stop|restart|logfile …`
- **Reliable backgrounding**: services survive the launching shell/agent command.
- **Idempotent ops**: `start` on a running service is a no-op (or returns a clear status).
- **Consistent logs**: stable log location per service; printable for `tail -f`.
- **Discoverable state**: list shows what is available and what is running.
- **Simulabra style**: service + manager as reified objects; CLI uses the module system.

## Non-goals (for MVP)
- Full system init replacement (systemd/launchd)
- Multi-host orchestration
- Container management
- Privileged ports / sudo workflows

## Core Concept
SPM is built around **per-service runners**:

- `simulabractl start <svc>` spawns a detached **runner process** for that service.
- The runner owns the actual service subprocess (the thing we care about).
- The runner writes a small **state file** and maintains a stable **log file**.
- `simulabractl stop|restart|list` operates via state files + signals to the runner.

This avoids a single global daemon (and a port/socket), while still giving reliable lifecycle management and the option to implement restart policies later.

---

## CLI Specification

### Command name
`simulabractl` (Bun script in `bin/`).

### Global options
- `--config <path>`: explicit service registry file.
- `--pm-dir <path>`: override state dir (default: `tmp/pm`).
- `--log-dir <path>`: override log dir (default: `logs/pm`).
- `--json`: machine-readable output for `list` (and optionally others).
- `--quiet`: suppress non-essential output.

### `list`
**Usage**
- `simulabractl list`
- `simulabractl ls`

**Output (default)**
Table with columns:
- `name`
- `status` (`running` | `stopped` | `stale`)
- `pid` (runner pid)
- `servicePid` (child pid if known)
- `uptime`
- `logfile`

`stale` means a state file exists but the runner pid is not alive.

### `start`
**Usage**
- `simulabractl start <service>`
- `simulabractl start <service>...`
- `simulabractl start --all` (optional, if registry supports `autostart`)

**Behavior**
- If the service runner is already alive: exit 0 and print “already running” (unless `--quiet`).
- Otherwise: start a detached runner, wait briefly (configurable, default ~250–500ms) for it to write state, then exit 0.
- If a stale state file exists: replace it.

### `stop`
**Usage**
- `simulabractl stop <service>`

**Behavior**
- Send `SIGTERM` to the runner (not the child directly).
- Wait up to `--timeout-ms` (default 3000ms) for clean shutdown.
- If still alive: send `SIGKILL` (or `--force`).
- Runner is responsible for terminating the child process group.

### `restart`
**Usage**
- `simulabractl restart <service>`

**Behavior**
- Equivalent to `stop` then `start`.
- Future extension: `restart` can request an in-runner restart to preserve log continuity.

### `logfile`
**Usage**
- `simulabractl logfile <service>`

**Output**
- Print the absolute path of the current log file, with no decoration.

**Example**
- `tail -f "$(simulabractl logfile agenda)"`

---

## Service Registry Specification

### Registry source resolution order
1. `--config <path>`
2. `SIMULABRA_PM_CONFIG`
3. Default: `misc/pm/services.js` (committed, repo-local)

### Registry format (MVP)
`misc/pm/services.js` exports a plain array of service definitions:

```js
export default [
  {
    name: 'agenda',
    command: ['bun', 'run', 'apps/agenda/run.js'],
    cwd: '.',
    env: { AGENDA_PORT: '3030' },
    log: { file: 'logs/pm/agenda.log' },
    stop: { timeoutMs: 3000, signal: 'SIGTERM' },
  }
];
```

Notes:
- `command` is an argv array (no shell string by default).
- `cwd` is relative to repo root (resolved by the manager).
- `log.file` may be omitted; default is `logs/pm/<name>.log`.
- Keep the registry intentionally boring; it’s the “interface for humans”.

### Service naming
- `name` is the CLI handle (lowercase, hyphen/underscore allowed).
- Names must be unique across the registry.

---

## State + Logs Specification

### Directories (defaults)
- **State dir**: `tmp/pm/`
- **Log dir**: `logs/pm/`

Both are already ignored by `.gitignore` in this repo.

### Files per service
For service `<name>`:
- `tmp/pm/<name>.json` — last known state written by the runner
- `tmp/pm/<name>.lock` — optional lock to prevent concurrent starts
- `logs/pm/<name>.log` — stdout/stderr capture of the runner + child

### State file schema (v1)
```json
{
  "schema": 1,
  "name": "agenda",
  "runnerPid": 12345,
  "servicePid": 12367,
  "status": "running",
  "startedAt": "2026-01-21T12:34:56.789Z",
  "cwd": "/abs/path/to/repo",
  "command": ["bun", "run", "apps/agenda/run.js"],
  "logFile": "/abs/path/to/repo/logs/pm/agenda.log",
  "lastExit": { "code": null, "signal": null, "at": null }
}
```

If the runner exits, it should update `lastExit` and set `status` to `stopped`.

---

## Runner Specification

### Responsibilities
- Load the registry and resolve the selected service definition.
- Open/append the service log file and redirect all stdout/stderr there.
- Spawn the service subprocess in its own process group.
- Write/update the state file:
  - on start
  - on child exit
  - on runner shutdown
- Handle signals:
  - `SIGTERM`/`SIGINT`: terminate child, write stopped state, exit 0
  - (optional) `SIGHUP` or `SIGUSR1`: restart child

### Backgrounding / detaching
The runner must be started in a way that survives the invoking shell/agent:

- Preferred: `Bun.spawn([...], { detached: true, stdio: 'ignore' })` with an explicit log redirection strategy.
- Fallback: `setsid` + redirection via `sh -c` (Linux/macOS), ensuring the runner is in a new session/process group.

The CLI should treat backgrounding as an implementation detail; users should never type `&`.

---

## Error Handling + Exit Codes (MVP)
- `0`: success (including “already running” for `start`)
- `2`: unknown service name
- `3`: requested service is not running (`stop`/`restart` when stopped)
- `4`: start failed (runner failed to come up / write state)
- `5`: stop timed out and escalation failed

Errors should be short and actionable; `logfile` should remain decoration-free.

---

## Implementation Plan

### Phase 1 — MVP (repo-local, per-service runners)
1. **Add a new library module**: `src/pm.js`
   - `PMPaths` (computes repo root, state/log dirs)
   - `PMService` (validated service definition)
   - `PMRegistry` (loads `misc/pm/services.js`)
   - `PMState` (read/write state file schema v1)
   - `PMRunner` (owns child lifecycle + state updates)
   - `PMController` (used by CLI: list/start/stop/restart/logfile)
2. **Add runner entrypoint**: `bin/pm-runner.js`
   - `bun run bin/pm-runner.js <service>`
   - Writes state + logs and stays alive until stopped or child exits
3. **Add CLI entrypoint**: `bin/simulabractl.js`
   - Subcommands: `list`, `start`, `stop`, `restart`, `logfile`
   - `start` spawns `pm-runner.js` detached
4. **Add default registry**: `misc/pm/services.js`
   - Start with 2–3 concrete repo services (at minimum: `agenda`)
5. **Add tests** (built-in test framework)
   - `tests/bin/simulabractl.js`: start/stop a tiny “sleep” service and validate:
     - state file created
     - list shows running
     - logfile path exists
     - stop removes/updates running state
   - Ensure tests clean up: stop services they start and delete `tmp/pm/*` they created.
6. **Run `bun run test`** (and keep it green).

### Phase 2 — Quality + Usability
- Add `simulabractl status <svc>` with a stable, script-friendly output.
- Add `simulabractl tail <svc>` as a convenience wrapper around `tail -f`.
- Add `--all` to operate on all services, with `autostart: true` support.
- Add `dependsOn` and ordered start (topological order).
- Add log rotation policy (size/time) while keeping `logfile` stable (symlink to “current”).
- Add restart policies in the runner (`always`, `on_failure`, backoff).

### Phase 3 — Integration with existing Simulabra “live” supervisor (optional)
If valuable, integrate with `src/live.js` concepts:
- allow a service to declare a `healthCheck` command or RPC method
- surface “healthy/unhealthy” in `list`

The MVP should not require any RPC integration.

