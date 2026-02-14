# eval-providers Worklog

## 2026-02-08

### Research

Explored the full architecture of GeistService, eval framework, trace capture, and tool definitions.

Key findings:

**Anthropic-specific coupling points in GeistService (services/geist.js):**
- `new Anthropic({ apiKey })` in init
- `this.client().messages.create(params)` — Anthropic SDK call shape
- Request format: `{ model, max_tokens, system, tools, messages }` where `system` is a top-level string and `tools` use `{ name, description, input_schema }` shape
- Response format: `response.content` is an array of `{ type: 'text' | 'tool_use', ... }` blocks
- `response.stop_reason === 'tool_use'` for detecting tool calls
- Tool use blocks: `{ type: 'tool_use', id, name, input }` — args are already parsed objects
- Tool results sent back as `{ type: 'tool_result', tool_use_id, content }` in messages

**OpenRouter/OpenAI format differences:**
- Request: `tools` use `{ type: 'function', function: { name, description, parameters } }` wrapper shape
- Request: `system` prompt goes in messages as `{ role: 'system', content: '...' }`, not top-level
- Response: tool calls are in `response.choices[0].message.tool_calls` array with `{ id, type: 'function', function: { name, arguments } }` — args are JSON strings, not objects
- Response: `finish_reason === 'tool_calls'` (vs Anthropic's `stop_reason === 'tool_use'`)
- Tool results: `{ role: 'tool', tool_call_id, content }` messages (vs Anthropic's `tool_result` content blocks)
- OpenRouter requires `tools` in every request (including follow-up)

**Eval framework coupling (evals/framework.js + trace.js):**
- TraceCapture wraps `client.messages.create()` specifically
- EvalCase hardcodes `new Anthropic({ apiKey })` and `ANTHROPIC_API_KEY`
- Result extraction assumes Anthropic response shape (`response.content` blocks with `type: 'tool_use'`)

**Tool definition format (src/tools.js):**
- `Tool.definition()` returns `{ name, description, input_schema }` — Anthropic format
- OpenAI format wraps this in `{ type: 'function', function: { name, description, parameters } }`
- The `input_schema` → `parameters` rename is trivial
