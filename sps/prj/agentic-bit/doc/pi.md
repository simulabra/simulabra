# pi-agent-core: guide to understanding & reverse engineering

All file references in this doc are **relative to** `~/prog/checkouts/pi-mono/` (unless explicitly marked otherwise).

## What pi-agent-core is (and is not)

`@mariozechner/pi-agent-core` is the minimal “agent runtime” layer that sits between:

- `@mariozechner/pi-ai` (LLM models + streaming + base message/tool types), and
- app shells (CLI, web UI, Slack bot) that want: state, tool execution, and a UI-friendly event stream.

It is intentionally small:

- The **core loop** is in `packages/agent/src/agent-loop.ts`.
- The **ergonomic wrapper** with in-memory state + queues is `packages/agent/src/agent.ts`.
- Everything else in the monorepo extends it by:
  - adding **custom message types**, and/or
  - providing **tools**, and/or
  - wrapping it with a higher-level “session” object that adds persistence, retries, compaction, etc.

## Key mental model (the whole system in one picture)

The important boundary is: **AgentMessage stays app-level until the LLM call**, then becomes `pi-ai` `Message[]`.

```
app/UI
  │
  │ AgentMessage[]  (superset: LLM messages + custom app messages)
  ▼
agentLoop(...) / runLoop(...)
  │
  ├─ (optional) transformContext(AgentMessage[])
  │
  ├─ convertToLlm(AgentMessage[]) => Message[]     ← hard boundary into LLM-compatible context
  │
  ├─ streamFn(model, Context{systemPrompt, messages, tools}, options)  ← default: pi-ai streamSimple()
  │      emits AssistantMessageEvent (start/text_delta/toolcall_delta/done/...)
  │
  ├─ executeToolCalls() for each toolCall chunk
  │      AgentTool.execute() returns { content, details } (+ optional streaming updates)
  │
  └─ emits AgentEvent stream for UIs/loggers
         (message_start/update/end, tool_execution_start/update/end, turn_start/end, agent_start/end)
```

If you remember only one thing: **pi-agent-core is mostly an evented state machine around a streaming LLM call + tool execution.**

## The core abstractions (what to read first)

### 1) `AgentMessage`: “messages we store” vs “messages the LLM sees”

- `CustomAgentMessages` is an *empty* interface meant for TypeScript module augmentation (`declare module ... { interface CustomAgentMessages { ... } }`). `packages/agent/src/types.ts:120`
- `AgentMessage` is the union: `Message | CustomAgentMessages[keyof CustomAgentMessages]`. `packages/agent/src/types.ts:129`

This is the main extensibility mechanism. It lets apps add message types that are:

- strongly typed (at compile time),
- persisted and rendered in UIs,
- but **not necessarily sent to the LLM**.

The bridge is `convertToLlm` (required at the loop boundary). `packages/agent/src/types.ts:22`

### 2) `AgentTool`: tools have *LLM content* and *UI details*

`AgentTool` extends `pi-ai` `Tool` and adds:

- a `label` for UI display, and
- an `execute()` function that returns `{ content, details }`. `packages/agent/src/types.ts:157`

Key design choice: tools return two channels:

- `content`: what the LLM should see (`TextContent | ImageContent`) `packages/agent/src/types.ts:146`
- `details`: structured metadata for UI/logging (opaque to the core loop)

Tools can also stream progress via `onUpdate`, surfaced as `tool_execution_update` events. `packages/agent/src/types.ts:154`

### 3) `AgentEvent`: a UI-first event stream

The agent loop emits a **single, ordered stream** of events that describes:

- agent lifecycle, turns, message streaming, and tool execution. `packages/agent/src/types.ts:179`

If you’re building a UI, this is the “public API” you should think in.

### 4) `AgentLoopConfig`: extension points that matter

The loop is configured by `AgentLoopConfig`. `packages/agent/src/types.ts:22`

Most important knobs:

- `convertToLlm(messages)` (required) `packages/agent/src/types.ts:25`
- `transformContext(messages)` (optional, pre-conversion) `packages/agent/src/types.ts:50`
- `getApiKey(provider)` (optional, per-request key resolution) `packages/agent/src/types.ts:69`
- `getSteeringMessages()` and `getFollowUpMessages()` (optional, for queueing behavior) `packages/agent/src/types.ts:77`

## How the loop actually runs (read `agent-loop.ts` like a state machine)

### Entry points

- `agentLoop(prompts, context, config, ...)` starts a run by appending prompts and emitting `message_start/end` for them. `packages/agent/src/agent-loop.ts:28`
- `agentLoopContinue(context, config, ...)` continues from existing context (retry patterns); last message must not be assistant. `packages/agent/src/agent-loop.ts:65`

Both create an `EventStream` that ends on `agent_end`. `packages/agent/src/agent-loop.ts:94`

### The “turn” model: one LLM call + N tools

`runLoop()` is the orchestrator. `packages/agent/src/agent-loop.ts:104`

It has two nested loops:

- **Inner loop**: keep going while
  - the last assistant message had tool calls, or
  - there are pending steering messages to inject. `packages/agent/src/agent-loop.ts:121`
- **Outer loop**: after the agent would stop, check `getFollowUpMessages()` and keep going if any exist. `packages/agent/src/agent-loop.ts:184`

This makes “agent continues itself” a first-class concept without needing external orchestration.

### The LLM boundary (the critical place to reverse engineer)

`streamAssistantResponse()` is where `AgentMessage[]` becomes `pi-ai` `Message[]`. `packages/agent/src/agent-loop.ts:204`

In order:

1. `transformContext` (optional) runs on `AgentMessage[]`. `packages/agent/src/agent-loop.ts:211`
2. `convertToLlm` runs and must return only LLM-compatible message types. `packages/agent/src/agent-loop.ts:217`
3. A `pi-ai` `Context` is built and sent to `streamFn` (default: `streamSimple`). `packages/agent/src/agent-loop.ts:220`
4. The streaming events are re-emitted as `AgentEvent`:
   - `message_start` at provider `start` `packages/agent/src/agent-loop.ts:248`
   - `message_update` for deltas `packages/agent/src/agent-loop.ts:263`
   - `message_end` on `done`/`error` with the final assistant message `packages/agent/src/agent-loop.ts:282`

### Tool execution

Tools are executed directly from assistant `toolCall` chunks:

- `executeToolCalls()` enumerates tool calls and emits `tool_execution_start/update/end`. `packages/agent/src/agent-loop.ts:294`
- Arguments are validated with `pi-ai`’s `validateToolArguments()` before running the tool. `packages/agent/src/agent-loop.ts:319`
- A `toolResult` message is constructed and emitted as a normal message (`message_start/end`). `packages/agent/src/agent-loop.ts:349`

### Steering: “interrupt tool execution”

Steering is implemented as “poll for queued user messages after each tool execution”.

- After each tool, `getSteeringMessages()` is called. `packages/agent/src/agent-loop.ts:363`
- If any are returned:
  - remaining tools in the current assistant message are converted into **skipped tool results** (`isError: true`) `packages/agent/src/agent-loop.ts:368`
  - the steering messages are injected before the next assistant response. `packages/agent/src/agent-loop.ts:129`

This behavior is pinned by a unit test: `packages/agent/test/agent-loop.test.ts:310`.

## The `Agent` class: state + queues on top of the loop

The `Agent` class is an in-memory orchestrator that:

- stores a mutable `AgentState` (messages, tools, streaming flags),
- creates the `AgentLoopConfig` from options,
- offers user-friendly methods (`prompt`, `continue`, `abort`, `waitForIdle`),
- and mirrors loop events into state updates and subscriber callbacks.

Key places:

- Default state and options wiring: `packages/agent/src/agent.ts:90`
- `prompt()` normalizes input into `AgentMessage[]` (including optional images). `packages/agent/src/agent.ts:277`
- `continue()` enforces “last message is not assistant”. `packages/agent/src/agent.ts:313`
- `_runLoop()` builds config, installs queue callbacks, and updates `streamMessage` / `pendingToolCalls`. `packages/agent/src/agent.ts:335`

Two important “queue semantics” are implemented here (not in the loop):

- `steer()` enqueues; `_runLoop()` drains via `getSteeringMessages`. `packages/agent/src/agent.ts:230`, `packages/agent/src/agent.ts:365`
- `followUp()` enqueues; `_runLoop()` drains via `getFollowUpMessages`. `packages/agent/src/agent.ts:238`, `packages/agent/src/agent.ts:379`

## Proxy streaming: how to swap transports cleanly

pi used to have a transport abstraction; the current design is: **swap the stream function**.

`packages/agent/src/types.ts:14` defines `StreamFn` to match `pi-ai` `streamSimple`’s signature.

`streamProxy()` is a concrete alternative stream function that:

- calls a backend SSE endpoint (`/api/stream`),
- reconstructs the partial assistant message client-side,
- emits standard `AssistantMessageEvent`s so the rest of the agent loop doesn’t change.

Key locations:

- proxy event wire format: `packages/agent/src/proxy.ts:36`
- implementation: `packages/agent/src/proxy.ts:85`
- JSON toolcall argument reconstruction via `parseStreamingJson`: `packages/agent/src/proxy.ts:293`

This is the core “transport extension” story now: the agent loop doesn’t know *how* tokens arrive; it just consumes an `AssistantMessageEventStream`.

## How pi-agent-core is extended in this monorepo (real patterns)

### Pattern A: Custom message types via module augmentation

Coding agent extends messages to include tool logs, compaction summaries, branch summaries, and extension-injected messages:

- `declare module "@mariozechner/pi-agent-core" { interface CustomAgentMessages { ... } }`
- `packages/coding-agent/src/core/messages.ts:69`

Web UI extends messages for attachments and artifacts:

- `packages/web-ui/src/components/Messages.ts:35`

### Pattern B: Convert custom messages into LLM context with `convertToLlm`

The design is: store rich messages, but project them down at the LLM boundary.

Example (coding-agent):

- `convertToLlm()` converts `bashExecution` into a user message, filters some messages, and passes through standard roles. `packages/coding-agent/src/core/messages.ts:148`

### Pattern C: Transform context pre-conversion (`transformContext`)

In coding-agent, `transformContext` is used as an extension hook to mutate context before each LLM call:

- agent construction: `packages/coding-agent/src/core/sdk.ts:281`
- extension runner integration: `packages/coding-agent/src/core/sdk.ts:290`

If you’re reverse engineering “where does extra context come from?”, search for `transformContext:` in the consuming app.

### Pattern D: Tools are standard `AgentTool`s, but can be wrapped/intercepted

The extension system wraps tools to:

- block tool execution (`tool_call`),
- observe/modify tool results (`tool_result`),
- pass a stable extension context into tools.

See `wrapToolWithExtensions()` in `packages/coding-agent/src/core/extensions/wrapper.ts:38`.

### Pattern E: Higher-level “session” wrappers consume AgentEvents

pi-agent-core is deliberately not a persistence layer. Apps build that on top by subscribing to events.

Example (coding-agent `AgentSession`):

- subscribes to the underlying agent once in the constructor `packages/coding-agent/src/core/agent-session.ts:279`
- processes events for queue UI, persistence, retry logic, compaction, etc. `packages/coding-agent/src/core/agent-session.ts:307`

Example (mom / Slack bot):

- creates an Agent + AgentSession per channel and subscribes once for Slack updates. `packages/mom/src/agent.ts:411`

## Reverse engineering checklist (practical)

If you’re coming in cold and want to “map the system” fast:

1. Start with types:
   - `packages/agent/src/types.ts:22` (AgentLoopConfig + extension points)
   - `packages/agent/src/types.ts:120` (CustomAgentMessages + AgentMessage)
   - `packages/agent/src/types.ts:157` (AgentTool)
   - `packages/agent/src/types.ts:179` (AgentEvent)
2. Read the loop as a state machine:
   - `packages/agent/src/agent-loop.ts:104` (runLoop nested loops)
   - `packages/agent/src/agent-loop.ts:204` (LLM boundary)
   - `packages/agent/src/agent-loop.ts:294` (tool execution)
3. Read `Agent` as an “adapter”:
   - `packages/agent/src/agent.ts:277` (prompt normalization)
   - `packages/agent/src/agent.ts:335` (queue wiring, state mirroring)
4. Find how apps extend messages:
   - search: `declare module "@mariozechner/pi-agent-core"`
   - good examples: `packages/coding-agent/src/core/messages.ts:69`, `packages/web-ui/src/components/Messages.ts:35`
5. Find how apps build higher-level behavior:
   - search: `.subscribe(` on Agent/AgentSession
   - good examples: `packages/coding-agent/src/core/agent-session.ts:279`, `packages/mom/src/agent.ts:499`
6. Confirm tricky behaviors in tests:
   - steering/skip semantics: `packages/agent/test/agent-loop.test.ts:310`
   - sessionId forwarding: `packages/agent/test/agent.test.ts:233`

## A few invariants/gotchas worth knowing

- `convertToLlm` must never emit non-LLM roles. The provider call only happens once per turn, so some invalid states won’t be caught until runtime. See warning in `packages/agent/src/agent-loop.ts:57`.
- `continue()` only works if the last stored message is not assistant. `packages/agent/src/agent.ts:313`
- Tool arguments are schema-validated right before tool execution. `packages/agent/src/agent-loop.ts:319`
- Steering skips remaining tool calls by emitting error tool results; downstream code should expect `isError: true` toolResult messages even for skipped calls. `packages/agent/src/agent-loop.ts:380`
