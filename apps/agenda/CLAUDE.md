# CLAUDE.md - Agenda Application

<AgendaOverview>
Personal productivity system with three coordinated microservices: data persistence (Redis), natural language processing (Claude API), and time-based notifications. Supports HTML, SMS, and CLI interfaces.
</AgendaOverview>

<Architecture>
```
run.js (Supervisor) ──┬── DatabaseService  ──── Redis
                      ├── GeistService     ──── Claude API + Tools
                      └── ReminderService  ──── Notification handlers
```

Services communicate via RPC over WebSocket (port 3030). The supervisor manages lifecycle, health checks, and service registration through `NodeRegistry`.
</Architecture>

<LaunchPoints>
- `run.js` - Bootstrap supervisor and register services
- `src/supervisor.js` - NodeRegistry, HealthCheck, ManagedService, Supervisor
- `src/models.js` - Log, Task, Reminder, RecurrenceRule (RedisPersisted)
- `src/tools.js` - Tool, ToolRegistry, AgendaToolRegistry with concrete tools
- `src/time.js` - TimePolicy for UTC-only date arithmetic
- `src/services/database.js` - DatabaseService (Redis persistence layer)
- `src/services/geist.js` - GeistService (Claude API + tool execution)
- `src/services/reminder.js` - ReminderService (polling + notifications)
- `bin/agenda.js` - CLI interface
- `bin/logs.js` - Stream service logs
- `index.html` - Web interface entry point
</LaunchPoints>

<Testing>
From core directory:
- `bun run test` - Runs all tests including agenda

Test files:
- `tests/models.js` - Log, Task, Reminder, RecurrenceRule
- `tests/tools.js` - Tool registry and execution
- `tests/time.js` - TimePolicy UTC arithmetic
- `tests/supervisor.js` - Service management
- `tests/redis.js` - Redis persistence patterns
- `tests/integration.js` - Cross-service scenarios

Tests use isolated Redis keyspaces via `client.keyPrefix()` to avoid collision.
</Testing>

<Debugging>
- Service logs: `apps/agenda/logs/*.log` (supervisor, DatabaseService, GeistService, ReminderService)
- Stream logs: `bun run apps/agenda/bin/logs.js`
- Supervisor status: `supervisor.status()` returns all service health states
- RPC debugging: WebSocket on port 3030 (default)
- Health states: `healthy`, `unhealthy`, `starting`
</Debugging>

<Development>
Key patterns:
- Services compose `AgendaService` mixin for identity and RPC registration
- Tools are reified objects: `Tool.new({ toolName, doc, inputSchema, execute })`
- Time arithmetic MUST use `TimePolicy` static methods (UTC-only, no local time)
- Models use `RedisPersisted` mixin with `RedisVar` for fields
- Null/undefined fields clear properly in Redis (Phase 2 complete)
- Recurrence uses `RecurrenceRule.nextOccurrence()` for trigger calculation

Gotchas:
- Don't use native Date methods for arithmetic; use TimePolicy
- Service specs require `healthCheckMethod` for RPC health checks
- WebSocket connections auto-reconnect via supervisor restart policy
</Development>

<Services>
| Service | Port | Purpose |
|---------|------|---------|
| DatabaseService | RPC | Redis CRUD for Log, Task, Reminder; event streaming |
| GeistService | RPC | Claude API interpretation; tool registry execution |
| ReminderService | RPC | Polls due reminders; triggers notifications |

All services connect through supervisor's WebSocket server on port 3030.
</Services>

<RefactoringContext>
See `misc/plans/agenda.md` for ongoing refactoring work and architectural decisions.
</RefactoringContext>
