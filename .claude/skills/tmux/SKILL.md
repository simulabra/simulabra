---
name: tmux
description: Use tmux to run long-running commands in managed tmux sessions. Start background processes, check their output, and manage their lifecycle.
allowed-tools: Bash
---

<Introduction>
The teemux script manages tmux sessions for long-running commands. All sessions are prefixed with `cc-` to avoid collisions with user sessions. Use this when you need to run something in the background (servers, test watchers, builds) and check on it later.
</Introduction>

<Commands>
```bash
# Run a command in a new session (auto-names from command)
bin/teemux start <command...>

# Run with a custom session name
bin/teemux start --name myserver node server.js

# Show all cc- sessions
bin/teemux list

# Capture last 80 lines of output
bin/teemux check <session>

# Kill a session
bin/teemux stop <session>

# Send input to a running session
bin/teemux send <session> <keys...>

# Continuously watch output (loops capture-pane)
bin/teemux tail <session>

# Attach interactively (not for agent use)
bin/teemux attach <session>
```
</Commands>

<ExampleOutput>
```
> bin/teemux start bun run test
started cc-test

> bin/teemux list
SESSION              CREATED      WINDOWS  STATE
cc-test              14:23:01     1        detached

> bin/teemux check test
✓ base.js core object system
✓ inheritance chain
✓ method dispatch
42 tests passed

> bin/teemux stop test
stopped cc-test
```
</ExampleOutput>

<Tips>
- Use `check` for a quick snapshot of recent output; use `tail` when you need to watch output over time
- Session names resolve flexibly: `test` and `cc-test` both work for check/stop/send
- `start` auto-derives names: `bun run test` → `cc-test`, `node server.js` → `cc-server`
- Collisions get suffixed: if `cc-test` exists, next one becomes `cc-test-2`
- `attach` drops into the real tmux session — mention `tmux attach -t <session>` to the user if they want to attach manually
- Exit codes: 0=success, 1=usage error, 2=session not found, 3=session already exists
</Tips>
