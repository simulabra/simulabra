# Agenda Compost Report

## Overview
Extract reusable modules from `apps/agenda/` into the core Simulabra library by extending existing files where possible. This includes implementing missing Redis search/indexing functionality.

## Extraction Phases

### Phase 1: Leaf Modules (no internal dependencies)

#### 1.1 Redis Persistence → extend `src/db.js` ✓
**Source**: `apps/agenda/src/redis.js`
**Extract**: `RedisVar`, `RedisClient`, `RedisPersisted`
**Target**: Add to `src/db.js` alongside the existing SQLite/`DBVar`/`Persisted` classes
**Consolidation**: Mirrors the SQLite pattern - `RedisVar` parallels `DBVar`, `RedisPersisted` parallels `Persisted`
**Status**: Complete - `RedisVar`, `RedisClient`, `RedisPersisted` in `src/db.js`, tests in `tests/db.js`, agenda re-exports with `agenda:` keyPrefix
**Implemented**:
  - `RedisVar.searchable` - full-text search via Redis Search (`FT.CREATE`/`FT.SEARCH`)
  - `RedisVar.indexed` - secondary indexes using Redis SETs with `findByIndex()` lookups
  - `RedisPersisted.search(query)` and `RedisPersisted.findByIndex(field, value)` methods
  - Sorted set operations (`zAdd`, `zRem`, `zRangeByScore`) for range queries

#### 1.2 Time Utilities → new `src/time.js` ✓
**Source**: `apps/agenda/src/time.js`
**Extract**: `TimePolicy`
**Target**: New file `src/time.js` (no existing time module to extend)
**Consolidation**: None needed, standalone utility
**Status**: Complete - `src/time.js` created, tests in `tests/time.js`, agenda re-exports from core

#### 1.3 LLM Tools → new `src/tools.js` ✓
**Source**: `apps/agenda/src/tools.js`
**Extract**: `Tool`, `ToolRegistry` (base classes only, not Agenda-specific tools)
**Target**: New file `src/tools.js`
**Consolidation**: None needed, clean abstraction layer for LLM function calling
**Status**: Complete - `Tool`, `ToolRegistry` in `src/tools.js`, tests in `tests/tools.js`, agenda re-exports from core

#### 1.4 Log Streaming → new `src/logs.js` ✓
**Source**: `apps/agenda/src/logs.js`
**Extract**: `FileTail`, `LogFormatter`, `LogStreamer`
**Target**: New file `src/logs.js`
**Consolidation**: None needed, standalone devtools utility
**Status**: Complete - `FileTail`, `LogFormatter`, `LogStreamer` in `src/logs.js`, tests in `tests/logs.js`, agenda re-exports with `AgendaLogFormatter` and `AgendaLogStreamer`

### Phase 2: Service Infrastructure (depends on live.js)

#### 2.1 Supervisor → extend `src/live.js` ✓
**Source**: `apps/agenda/src/supervisor.js`
**Extract**: `ServiceSpec`, `ManagedService`, `HealthCheck`, `NodeRegistry`, `HandshakeHandler`, `Supervisor`
**Target**: Add to `src/live.js` (completes the server side of the RPC system)
**Consolidation**: Heavy - integrates with existing `NodeClient`, `RPCHandler`, `MessageDispatcher`, `LiveMessage`
**Also extract**: `AgendaService` → generalize as `EnvService` (maps environment variables to uid)
**Status**: Complete - `EnvService`, `ServiceSpec`, `NodeRegistry`, `HealthCheck`, `ManagedService`, `HandshakeHandler`, `Supervisor` in `src/live.js`, tests in `tests/live.js`, agenda uses `AGENDA_SERVICE_NAME` via `AgendaService`, `AgendaManagedService`, and `AgendaSupervisor`

### Phase 3: Scheduling (depends on Phase 1)

#### 3.1 Recurrence → extend `src/time.js` ✓
**Source**: `apps/agenda/src/models.js`
**Extract**: `RecurrenceRule` only (not the Agenda-specific `Log`, `Task`, `Reminder` models)
**Target**: Add to `src/time.js` created in Phase 1.2
**Consolidation**: Uses `TimePolicy` for date arithmetic
**Status**: Complete - `RecurrenceRule` added to `src/time.js` with `nextOccurrence()`, `toJSON()`, `fromJSON()` methods; tests in `tests/time.js`; agenda `Reminder.recurrence` field updated to use `$time.RecurrenceRule`

### Phase 4: Browser Client (depends on html.js)

#### 4.1 Browser RPC Client → extend `src/html.js` ✓
**Source**: `apps/agenda/src/ui/app.js` (extract only the WebSocket/RPC wrapper)
**Extract**: Browser-side RPC client (WebSocket connect, request/response tracking, reconnection)
**Target**: Add to `src/html.js` as `LiveBrowserClient` - keeps browser-specific code with the HTML/component system
**Consolidation**: None needed, new capability for html.js
**Status**: Complete - `LiveBrowserClient` in `src/html.js` with `connect()`, `disconnect()`, `rpcCall()`, `serviceProxy()`, auto-reconnect with exponential backoff; tests in `tests/html.js`; agenda `AgendaApp` composes `LiveBrowserClient` mixin

## Dependency Graph
```
Phase 1 (parallel, no deps)     Phase 2          Phase 3          Phase 4
┌─────────────────────────┐    ┌──────────┐    ┌─────────────┐   ┌─────────────┐
│ 1.1 redis → db.js       │    │          │    │             │   │             │
│ 1.2 time  → time.js     │───▶│ 2.1 sup  │───▶│ 3.1 recur   │   │ 4.1 browser │
│ 1.3 tools → tools.js    │    │ → live.js│    │ → time.js   │   │ → html.js   │
│ 1.4 logs  → logs.js     │    │          │    │             │   │             │
└─────────────────────────┘    └──────────┘    └─────────────┘   └─────────────┘
                                                                  (independent)
```

## Implementation Notes

### Redis Search Integration (Phase 1.1)
When extracting `RedisVar`, implement the `searchable` and `indexed` flags:
- `searchable: true` → Create Redis Search index, enable FT.SEARCH queries
- `indexed: true` → Create secondary index (Redis SET or ZSET) for fast lookups
- Add `RedisPersisted.search(query)` and `RedisPersisted.findByIndex(field, value)` methods

### Supervisor Consolidation (Phase 2.1)
The supervisor currently re-implements some patterns from `live.js`:
- `HandshakeHandler` extends `MessageHandler` from live.js ✓
- `NodeRegistry` tracks connected clients (similar to potential live.js server component)
- Consolidate by making `Supervisor` the canonical "server" counterpart to `NodeClient`

## What Stays in Agenda
- `Log`, `Task`, `Reminder` models (domain-specific)
- All concrete tool implementations (`CreateLogTool`, `CreateTaskTool`, etc.)
- UI components (`TaskItem`, `JournalView`, `ChatView`, etc.)
- SMS/Twilio integration
- Service startup scripts
