# Geist Proactive Prompting System - Plan

## Goal

Add proactive prompting to the GeistService that periodically surfaces actionable items, generating friendly prompts like "playwright tests for agenda - did you get to creating them? is that still a priority?" Prompts appear as in-app notifications with actions: done, backlog, snooze, dismiss.

## Design Decisions

- **Consolidate into GeistService** - No new microservice; prompts are just another way for the geist to communicate
- **"Done" action** - Completes the related task
- **"Backlog" action** - Sets task priority to 5 (lowest)
- **Smart selection** - Claude analyzes context to pick actionable items
- **Response tracking** - Store history to improve future prompt selection

## Data Model

### Prompt (new model in models.js)

| Field | Type | Description |
|-------|------|-------------|
| itemType | string (indexed) | task/log/reminder |
| itemId | string | related item id |
| message | string (searchable) | prompt text to display |
| context | JSON | context used for generation |
| status | string (indexed) | pending/shown/actioned/dismissed |
| action | string | user action: done/backlog/snooze/dismiss |
| generatedAt | Date (indexed) | when generated |
| shownAt | Date | when shown to user |
| actionedAt | Date | when user responded |
| snoozeUntil | Date | for snoozed prompts |

### PromptConfig (new model in models.js)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| key | string | "main" | singleton identifier |
| promptFrequencyHours | number | 8 | hours between generation cycles |
| maxPromptsPerCycle | number | 3 | max prompts per generation |
| taskStalenessDays | number | 7 | days before task is "stale" |
| lastGenerationAt | Date | null | last generation time |
| responseHistory | JSON array | [] | recent responses for learning |

## Architecture

```
GeistService (extended)
├── Existing: chat(), health()
├── New: Prompt generation & polling
│   ├── generatePrompts()     → RPC method, manual trigger
│   ├── getPendingPrompts()   → RPC method, fetch for UI
│   ├── actionPrompt()        → RPC method, handle user action
│   └── pollForPrompts()      → internal, periodic check
│
└── New: Prompt analysis (uses existing Anthropic client)
    ├── analyzeContext()      → gather tasks/logs/reminders
    ├── scoreItems()          → rank by urgency/staleness
    └── createPrompts()       → call Claude to generate messages

DatabaseService (extended)
├── createPrompt(fields)
├── listPrompts({ status, limit })
├── updatePrompt(id, fields)
├── getPromptConfig()
└── updatePromptConfig(fields)

HTTP API (new endpoints in run.js)
├── POST /api/v1/prompts/pending   → get pending prompts
├── POST /api/v1/prompts/action    → done/backlog/snooze/dismiss
└── POST /api/v1/prompts/generate  → manual trigger

UI Components (in ui/app.js)
├── NotificationBanner   → container at top of app
└── PromptCard           → individual prompt with action buttons
```

## Implementation Phases

### Phase 1: Data Model
- Add migration `005_create_prompts` with tables for Prompt and PromptConfig
- Add Prompt and PromptConfig classes to models.js
- Add DatabaseService methods: createPrompt, listPrompts, updatePrompt, getPromptConfig, updatePromptConfig

### Phase 2: GeistService Extensions
- Add `generatePrompts()` RPC method
  - Calls analyzeContext() to gather current state
  - Calls Claude with system prompt for smart selection
  - Creates Prompt records via DatabaseService
  - Updates lastGenerationAt in PromptConfig
- Add `getPendingPrompts({ limit })` RPC method
- Add `actionPrompt({ id, action })` RPC method
  - Updates prompt status and action
  - Records response in PromptConfig.responseHistory
  - If action=done: complete the related task
  - If action=backlog: set task priority to 5
  - If action=snooze: set snoozeUntil to +24 hours
- Add `pollForPrompts()` internal method
  - Check if enough time has passed since lastGenerationAt
  - If so, call generatePrompts()
- Start polling on service init

### Phase 3: HTTP API
- Add POST /api/v1/prompts/pending endpoint
- Add POST /api/v1/prompts/action endpoint (validates id and action)
- Add POST /api/v1/prompts/generate endpoint

### Phase 4: Web UI
- Add `pendingPrompts` signal to AgendaApp
- Add `loadPendingPrompts()`, `actionPrompt()`, `generatePrompts()` methods to AgendaApp
- Add API client methods: getPendingPrompts, actionPrompt, generatePrompts
- Create PromptCard component with message and action buttons
- Create NotificationBanner component showing prompts or "nudge me" button
- Add NotificationBanner to main app render, below TopBar
- Add CSS styling for prompt cards

### Phase 5: Analytics & Learning
- On each actionPrompt call, append to responseHistory (keep last 100)
- Include responseHistory in Claude prompt for smart selection
- Claude should avoid items user frequently dismisses
- Claude should favor patterns that lead to completions

### Phase 6: Testing
- Unit tests for Prompt model CRUD
- Unit tests for PromptConfig model
- Integration test for full generation cycle
- Test actionPrompt side effects (task completion, priority change)
- UI tests via playwright-skill

## Claude System Prompt for Generation

```
You are analyzing a user's productivity state to generate helpful prompts.

Given their tasks, recent activity, and past response patterns, identify 1-3 items that need attention:
- Tasks that may have been forgotten (no updates in a week+)
- Tasks approaching deadlines
- Tasks the user frequently snoozes (maybe should be backlogged)
- Patterns suggesting follow-up questions

Generate concise, friendly prompts. Each should:
- Reference a specific task by name
- Ask a natural question or offer an action
- Be easy to respond to (yes/no or quick update)

Avoid prompting about items the user has previously dismissed multiple times.
```

## Open Questions

1. **Prompt timing**: Fixed times (9am, 1pm, 6pm) vs interval-based? Fixed may feel more natural.
2. **Real-time delivery**: Poll on UI load, or push via SSE/websocket?
3. **Prompt deduplication**: Avoid similar prompts for same task within N days?

## Estimate

| Phase | Description | Estimate |
|-------|-------------|----------|
| 1 | Data model + persistence | 1-2 hours |
| 2 | GeistService extensions | 2-3 hours |
| 3 | HTTP endpoints | 30 min |
| 4 | Web UI components | 2-3 hours |
| 5 | Analytics/learning | 1 hour |
| 6 | Testing | 2 hours |

**Total: 9-12 hours**
