# Agenda Compost Report

## Candidates to extract into the base library
- `apps/agenda/src/redis.js`: `RedisVar`, `RedisClient`, and `RedisPersisted` are a general Redis persistence adapter with slot-level transforms, indexing flags, and CRUD helpers. This fits as a base persistence module (for example `simulabra/redis` or a generic storage adapter alongside `src/db.js`).
- `apps/agenda/src/time.js`: `TimePolicy` provides UTC-safe date arithmetic and day boundary helpers that are broadly useful for scheduling and recurrence logic.
- `apps/agenda/src/models.js`: `RecurrenceRule` is a reusable recurrence/scheduling model that could live in a base `time` or `schedule` module.
- `apps/agenda/src/tools.js`: `Tool` and `ToolRegistry` are general LLM tool definitions + dispatch that could belong in `simulabra/llm` or a shared tooling module, with Agenda-specific tools layered on top.
- `apps/agenda/src/logs.js`: `FileTail`, `LogFormatter`, and `LogStreamer` form a reusable log tailing/streaming utility that could be a base devtools module.
- `apps/agenda/src/supervisor.js`: `ServiceSpec`, `ManagedService`, `HealthCheck`, `NodeRegistry`, `HandshakeHandler`, and `Supervisor` implement a general service supervisor on top of `simulabra/live`. This looks suitable for a core `simulabra/supervisor` module, with `AgendaService` as a generic `EnvUidService` mixin.
- `apps/agenda/src/ui/app.js`: the browser-side RPC wrapper (WebSocket, request/response map) is reusable as a base `LiveBrowserClient` or `LiveRPCClient` so other web apps do not reimplement it.

## Existing base classes that already cover similar problems
- `src/db.js`: `DBVar` and `Persisted` already implement slot-based persistence and CRUD semantics similar to `RedisVar`/`RedisPersisted`. If Redis is optional, the Agenda models could use the base DB module instead.
- `src/live.js`: `NodeClient`, `RPCHandler`, `MessageDispatcher`, and `LiveMessage` solve the RPC and routing pieces that Agenda re-implements on the server side. Extending `live` with a supervisor/server component would reduce duplication.
- `src/http.js`: `HTTPRequestCommand` provides a reusable HTTP client command that can replace the raw `fetch` in `TriggerWebhookTool` if you want consistent transport and logging.
- `src/llm.js`: `LLMClient` is a base client for OpenAI-compatible APIs; if Geist migrates to that style of API, it can reuse the base client and keep the tool registry as the extension point.

## Notes on consolidation opportunities
- `RedisVar.searchable` and `indexed` are defined but not implemented in Agenda. If moved into base, they could pair with a Redis Search or secondary index helper so the flags are functional.
- `AgendaService` is a thin mixin that maps env to `uid`. This can be generalized for any service that needs stable process naming via environment.
