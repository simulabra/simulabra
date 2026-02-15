# Phase 5: Extract Shared Interpret Logic

## Goal
Eliminate ~80 lines of duplication between `interpret()` and `interpretMessage()` in GeistService by extracting a shared core method.

## Context
Both methods follow the same pattern: check client → check DB → build system prompt → API call → tool loop → follow-up call → extract text. The only differences are:
- `interpretMessage` persists messages to the chat stream
- `interpretMessage` builds messages from chat history instead of a single input
- `interpretMessage` attaches metadata to the assistant message

See `docs/audit.md` section 2.3 for the detailed line-by-line comparison.

## Design

### New method: `_processWithTools(systemPrompt, messages)`

A private-by-convention method on GeistService that handles the shared core:
1. Make API call with system prompt and messages
2. Loop while response has tool_use blocks:
   - Execute each tool via registry
   - Collect tool results
   - Make follow-up API call with tool results
3. Extract and return text content from final response
4. Return structured result: `{ text, toolResults, response }`

### Refactored `interpret(input)`
Thin wrapper:
1. Validate client and DB connections
2. Build messages array from single input string
3. Call `_processWithTools(this.systemPrompt(), messages)`
4. Return text result

### Refactored `interpretMessage(message, conversationId)`
Thin wrapper:
1. Validate client and DB connections
2. Persist user message to chat stream
3. Build messages from chat history
4. Add project context to system prompt
5. Call `_processWithTools(systemPrompt, messages)`
6. Persist assistant message with metadata
7. Return result

## Key Files
- `apps/agenda/src/services/geist.js` — primary changes (~lines 233-441)
- `apps/agenda/tests/services/geist.js` — verify existing tests still pass
- `apps/agenda/evals/scenarios/` — eval scenarios exercise interpret paths

## Uncertainties
- The tool execution callback pattern may need slight restructuring — both methods currently share inline tool execution logic but with different logging
- Error handling differs slightly between the two methods — need to preserve both error paths
- The `toolResults` array is built identically in both — this is the clearest extraction target

## Acceptance Criteria
- No duplication between `interpret()` and `interpretMessage()`
- Both methods produce identical behavior to before (same API calls, same tool execution, same persistence)
- All existing GeistService tests pass
- `_processWithTools` is a `$.Method` on GeistService (not a standalone function)
