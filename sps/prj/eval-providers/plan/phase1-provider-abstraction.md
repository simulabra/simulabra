# Phase 1: Provider Abstraction Layer

Make GeistService and the eval system provider-agnostic by introducing a translation layer between the internal Anthropic message format and external OpenAI-compatible APIs.

## Design

The core insight: GeistService already speaks "Anthropic format" internally. Rather than rewriting GeistService, introduce an **adapter** that sits where the Anthropic SDK client sits today. The adapter translates Anthropic-format requests into OpenAI-format HTTP calls and translates the responses back.

```
GeistService (unchanged)
    │ Anthropic-format request
    ▼
ProviderAdapter
    │ translate request → OpenAI format
    ▼
OpenAI-compatible API (OpenRouter, etc.)
    │ OpenAI-format response
    ▼
ProviderAdapter
    │ translate response → Anthropic format
    ▼
GeistService (unchanged)
```

This approach means:
- GeistService code stays the same — no format branching
- Tool definitions, tool result handling, message building all unchanged
- The adapter is the only new code, and it's testable in isolation
- TraceCapture wraps the adapter the same way it wraps the Anthropic client

## Classes

### `ProviderAdapter` — `apps/agenda/src/provider.js`

Presents the same `client.messages.create(params)` interface as the Anthropic SDK.

Slots:
- `provider` — string: `'anthropic'` (default), `'openrouter'`, or any OpenAI-compatible base URL
- `model` — string: the model ID to use (e.g. `'moonshotai/kimi-k2.5'`)
- `apiKey` — string: the API key for the provider
- `baseUrl` — string: computed from provider or set directly (e.g. `'https://openrouter.ai/api/v1'`)

Methods:
- `messages` — getter that returns `{ create(params) }` — the Anthropic-compatible interface
- `create(params)` — the core method:
  1. If provider is `'anthropic'`, delegate to a real Anthropic SDK client
  2. Otherwise, translate params to OpenAI format, call the API, translate response back

### Translation functions (module-level, not on the class):

**Request translation** (`toOpenAI(params)`):
- `system` string → prepend `{ role: 'system', content: system }` to messages
- `tools` array: `{ name, description, input_schema }` → `{ type: 'function', function: { name, description, parameters } }`
- `max_tokens` → `max_tokens` (same key in OpenAI)
- Messages: Anthropic `tool_result` content blocks → OpenAI `{ role: 'tool', tool_call_id, content }` messages
- Messages: Anthropic assistant `tool_use` content blocks → OpenAI `tool_calls` array on assistant message

**Response translation** (`fromOpenAI(response)`):
- `choices[0].message.content` → `content: [{ type: 'text', text }]`
- `choices[0].message.tool_calls` → append `{ type: 'tool_use', id, name, input }` to content (parse `arguments` JSON string)
- `choices[0].finish_reason === 'tool_calls'` → `stop_reason: 'tool_use'`
- `usage.prompt_tokens` → `usage.input_tokens`, `usage.completion_tokens` → `usage.output_tokens`
- Preserve `model` from response for cost tracking

### Configuration

Environment variables:
- `AGENDA_PROVIDER` — `'anthropic'` (default) or `'openrouter'`
- `AGENDA_MODEL` — model ID (default: current `'claude-sonnet-4-20250514'`)
- `AGENDA_PROVIDER_KEY` — API key (falls back to `ANTHROPIC_API_KEY`)
- `OPENROUTER_API_KEY` — convenience alias for OpenRouter

### Changes to GeistService (`apps/agenda/src/services/geist.js`)

Minimal — the init method changes from:
```
this.client(new Anthropic({ apiKey }))
```
to:
```
this.client(ProviderAdapter.new({ provider, model, apiKey }))
```

The rest of GeistService stays the same because ProviderAdapter presents the same `client.messages.create()` interface.

### Changes to eval framework (`apps/agenda/evals/framework.js`)

EvalCase.run() changes from:
```
new Anthropic({ apiKey })
```
to:
```
ProviderAdapter.new({ provider, model, apiKey })
```

And reads provider/model from env vars so the eval runner can target different providers.

### Changes to TraceCapture (`apps/agenda/evals/trace.js`)

None — it already wraps `client.messages.create()` generically. It will work unchanged with ProviderAdapter since the adapter presents the same interface.

### Changes to Tool.definition() (`src/tools.js`)

None — ProviderAdapter handles the translation. The internal format stays Anthropic.

## Files to Create

| File | Purpose |
|------|---------|
| `apps/agenda/src/provider.js` | ProviderAdapter class + translation functions |
| `apps/agenda/tests/provider.js` | Unit tests for format translation |

## Files to Modify

| File | Change |
|------|--------|
| `apps/agenda/src/services/geist.js` | Import provider.js, use ProviderAdapter in init |
| `apps/agenda/evals/framework.js` | Use ProviderAdapter instead of raw Anthropic client |

## Acceptance Criteria

- [ ] `AGENDA_PROVIDER=anthropic` works identically to current behavior (default)
- [ ] `AGENDA_PROVIDER=openrouter AGENDA_MODEL=moonshotai/kimi-k2.5` successfully runs geist interpret
- [ ] Eval suite can target OpenRouter: `AGENDA_PROVIDER=openrouter bun run evals/run.js`
- [ ] Unit tests verify request/response translation between formats
- [ ] TraceCapture works unchanged with the new adapter
- [ ] Existing Anthropic-targeted evals still pass
