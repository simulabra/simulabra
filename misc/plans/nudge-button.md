# Nudge Button Fix Plan

## Problem Statement

The nudge button in the agenda chat view is not working as expected. The button exists in the DOM and is clickable, but pressing it does not produce visible results for the user.

## Investigation Findings

### Component Map

```
ChatView.handleNudge()
  -> AgendaApp.generatePrompts()
       -> AgendaApiClient.generatePrompts()
            -> fetch POST /api/v1/prompts/generate
                 -> run.js apiHandler
                      -> GeistService.generatePrompts() [via RPC proxy, 120s timeout]
                           -> analyzeContext() -> Claude API -> createPrompt()
       -> AgendaApp.loadPendingPrompts()
            -> AgendaApiClient.getPendingPrompts()
            -> this.pendingPrompts(prompts)  [Signal updates UI]
```

### Files Involved

| File | Role |
|------|------|
| `apps/agenda/src/ui/app.js:466-476` | ChatView.handleNudge - click handler |
| `apps/agenda/src/ui/app.js:814-826` | AgendaApp.generatePrompts - client orchestration |
| `apps/agenda/src/ui/app.js:114-118` | AgendaApiClient.generatePrompts - HTTP call |
| `apps/agenda/src/ui/app.js:17-36` | AgendaApiClient.apiCall - base HTTP method |
| `apps/agenda/run.js:177-181` | Server-side HTTP route handler |
| `apps/agenda/src/services/geist.js:418-506` | GeistService.generatePrompts - prompt generation logic |
| `apps/agenda/src/ui/app.js:777-788` | AgendaApp.loadPendingPrompts - refresh prompts |

### Root Causes Identified

**1. Silent failure when server returns soft errors (PRIMARY)**

The server-side `generatePrompts` returns `{ success: false, error: '...' }` for several conditions (no Claude API key, no database connection, Claude API errors). The ApiRouter wraps this as `{ ok: true, value: { success: false, ... } }`. The client's `apiCall` sees `ok: true` and does not throw. The AgendaApp's `generatePrompts` method (line 820) discards the return value entirely -- it never checks `result.success`. So the user clicks nudge, the button shows "..." briefly, then reverts to "nudge" with no feedback.

**2. Silent bail-out when disconnected**

Both `AgendaApp.generatePrompts` (line 818) and `loadPendingPrompts` (line 781) silently return if `!this.connected()`. If the connection drops, nudge does nothing with no user feedback.

**3. No feedback for duplicate-only results**

When all prompts are duplicates of existing pending prompts (a common case after first nudge), the server returns `{ success: true, promptsCreated: 0, promptsSkipped: N }`. The UI shows no new prompts and gives no feedback that the nudge was processed.

**4. No error boundary in handleNudge**

`handleNudge` has a `try/finally` but no `catch`. If `generatePrompts` throws an unhandled error, it becomes an unhandled promise rejection with no UI feedback. The finally block does correctly reset `generating(false)`, but the user sees no error message.

### Secondary Issue: Missing `shouldPoll` method

The test file `tests/geist-prompts.js` references `geistService.shouldPoll()` but this method does not exist in `src/services/geist.js`. This test would fail.

## Fix Plan

### 1. AgendaApp.generatePrompts: check server result and provide feedback

The `generatePrompts` method on AgendaApp should:
- Capture the return value from `this.api().generatePrompts()`
- Check `result.success` -- if false, display `result.error` as a system message
- If success but `promptsCreated === 0`, display a message like "no new prompts" so the user knows the nudge was processed
- If success with prompts created, the existing `loadPendingPrompts()` call handles display

### 2. ChatView.handleNudge: add error handling with catch

Add a `catch` block to `handleNudge` that displays the error as a system message via `this.app().addMessage()`. This catches network failures, timeouts, and any other unexpected exceptions.

### 3. Connection state feedback

When `generatePrompts` bails due to `!this.connected()`, display a system message: "Not connected - try reconnecting" (matching the pattern from `sendMessage` on line 730).

### 4. Remove or fix shouldPoll test

Either implement `shouldPoll` on GeistService (if it was removed during a refactor) or update the test to match the current API. The test `ShouldPoll` at line 491 of `tests/geist-prompts.js` will currently fail.

## Test Plan

### Unit Tests (in `tests/geist-prompts.js`)

1. **GeneratePromptsReturnsResult** - verify that `generatePrompts` returns a result object with `success`, `promptsCreated`, `promptsSkipped` fields
2. **GeneratePromptsDuplicatesOnly** - verify that when all prompts are duplicates, `promptsCreated` is 0 and `promptsSkipped` > 0
3. Fix or remove the **ShouldPoll** test

### UI Tests (in `tests/ui/app.js`)

4. **NudgeButtonShowsFeedback** - with a mock server that returns `{ ok: true, value: { success: true, promptsCreated: 0, promptsSkipped: 2 } }` for `/api/v1/prompts/generate`, verify a system message appears in chat
5. **NudgeButtonShowsError** - with a mock server that returns `{ ok: true, value: { success: false, error: 'test error' } }`, verify an error system message appears
6. **NudgeButtonDisabledDuringGeneration** - click nudge, verify button becomes disabled (shows "..."), wait for response, verify it re-enables

### Manual Verification

- Start the agenda app, click nudge, verify feedback appears in chat
- Disconnect network, click nudge, verify "not connected" message
- Click nudge when no tasks exist, verify "no new prompts" feedback

## Estimate

This is a small fix: ~30 minutes of implementation. The changes are localized to two methods (`handleNudge` and `AgendaApp.generatePrompts`) plus one test cleanup. No architectural changes needed.
