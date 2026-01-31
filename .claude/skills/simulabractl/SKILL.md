---
name: simulabractl
description: Use simulabractl when managing or debugging Simulabra processes. Start, stop, restart services, check their status, or tail their logs.
allowed-tools: Bash
---

<Introduction>
The Simulabra Process Manager (SPM) manages local dev services. Each service runs in a detached runner process that handles lifecycle, logging, and graceful shutdown. Use this skill to start/stop services, check status, or debug issues.
</Introduction>

<Commands>
```bash
# List all services and their status
bun run bin/simulabractl.js list

# List with JSON output (for parsing)
bun run bin/simulabractl.js list --json

# Start a service
bun run bin/simulabractl.js start <service>

# Stop a service
bun run bin/simulabractl.js stop <service>

# Force stop (SIGKILL after timeout)
bun run bin/simulabractl.js stop <service> --force

# Restart a service
bun run bin/simulabractl.js restart <service>

# Get the log file path
bun run bin/simulabractl.js logfile <service>

# Tail the logs in real-time
tail -f "$(bun run bin/simulabractl.js logfile <service>)"
```
</Commands>

<ExampleOutput>
```
> bun run bin/simulabractl.js list
SERVICE         STATUS      PID     UPTIME
agenda          running     12345   5m32s

> bun run bin/simulabractl.js list --json
[
  {
    "name": "agenda",
    "status": "running",
    "pid": 12345,
    "runnerPid": 12340,
    "uptime": 332000,
    "logFile": "/home/user/simulabra/core/logs/pm/agenda.log"
  }
]

> bun run bin/simulabractl.js start agenda
Started agenda (pid 12345)

> bun run bin/simulabractl.js stop agenda
Stopped agenda
```
</ExampleOutput>

<ServiceStatuses>
- `stopped` - Service is not running
- `running` - Service is running normally
- `starting` - Service is in the process of starting
- `stale` - State file says running but process is dead (will be cleaned up on stop)
</ServiceStatuses>

<ExitCodes>
- 0: Success
- 2: Unknown service
- 3: Service not running (for stop command)
- 4: Start failed
- 5: Stop timeout
</ExitCodes>

<DebuggingTips>
1. **Service won't start**: Check the log file with `tail -f "$(bun run bin/simulabractl.js logfile <service>)"`
2. **Stale status**: Run `stop` to clean up, then `start` again
3. **Logs location**: `logs/pm/<service>.log`
4. **State files**: `tmp/pm/<service>.json`
</DebuggingTips>

<AvailableServices>
Services are defined in `misc/pm/services.js`. Currently available:
- `agenda` - Personal productivity system (port 3030, production database)
- `agenda-test` - Agenda test instance for operator testing (port 3031, separate database)
</AvailableServices>
