# Phase 12: Haunts — Generation Prompt & Action Execution

## Goal
Update the LLM generation prompt to produce haunts with context-specific action choices. Replace the hardcoded `actionPrompt` switch with a send-to-Geist execution model. Rename API paths from `/prompts/*` to `/haunts/*`.

## Context
After Phase 11, the data model supports `actions: [{label, message}]` on each Haunt. Now we need:
1. The LLM to generate those actions during haunt generation
2. A way to execute actions by sending pre-composed messages to Geist
3. Updated API paths

**Key design decision**: Clicking a haunt action sends its `message` to Geist's chat as a user message. Geist then processes it through its normal agentic loop (tool calls, etc). This is more natural than direct tool execution — the haunt suggests, Geist acts.

**Only "dismiss" is implicit**. The LLM generates all other actions (including snooze when appropriate). Each haunt gets exactly the actions that make sense for it.

## Generation Changes — `apps/agenda/src/services/geist.js`

### Rename Vars
- `promptGenerationSystemPrompt` → `hauntGenerationSystemPrompt`
- `promptTimes` → `hauntTimes`
- `promptDays` → `hauntDays`

### Updated System Prompt (`hauntGenerationSystemPrompt`)

The key addition is instructing Claude to generate an `actions` array with each haunt. Each action has a `label` (button text) and `message` (what to send to Geist when clicked).

The prompt should specify:
- Each haunt should have 2-3 actions (not counting dismiss, which is implicit)
- Actions should be concrete instructions that Geist can execute with its tools
- The `message` field should read like something the user would type in chat
- Actions should be varied and specific to the situation

Updated response format:
```json
[
  {
    "itemType": "task",
    "itemId": "abc123",
    "message": "you have 2 house project tasks sitting idle — want to organize them?",
    "projectId": "proj456",
    "actions": [
      {"label": "create project", "message": "create a project called 'house' and move my house-related tasks into it"},
      {"label": "merge tasks", "message": "combine my house project tasks into one task with subtasks in the description"},
      {"label": "snooze 3 days", "message": "snooze the task abc123 for 3 days"}
    ]
  }
]
```

Include the available tool capabilities in the system prompt so the LLM knows what actions are possible:
- complete_task, create_task, update_task, create_project, move_to_project, list_projects, create_reminder, etc.

### Updated `generateHaunts` (replaces `generatePrompts`)

The main loop change: store `actions` when creating haunt records.

```
for each hauntData in parsed response:
  validate: itemType, itemId, message required
  check hasActivePendingHaunt (skip duplicates)
  validate actions: must be array of {label, message} objects, strip malformed entries
  createHaunt({ ..., actions: validatedActions || null })
```

Add a `validateHauntActions` method:
- Filter to only objects with both `label` (string) and `message` (string)
- Cap at 4 actions max per haunt
- Return null if no valid actions remain

### Rename other methods
- `generatePrompts` → `generateHaunts`
- `getPendingPrompts` → `getPendingHaunts`
- `actionPrompt` → `actionHaunt`
- `recordPromptResponse` → `recordHauntResponse`
- `initScheduler` job name: `'generatePrompts'` → `'generateHaunts'`

### Updated `actionHaunt` (replaces `actionPrompt`)

The old method had a hardcoded switch (done/backlog/snooze/dismiss). The new method:

**Parameters**: `{ id, actionIndex }` where `actionIndex` is:
- `-1` → dismiss (the only implicit action)
- `0..N` → index into the haunt's `actions` array

**Dismiss handling** (actionIndex === -1):
- Set status='dismissed', action='dismiss', actionedAt=now
- Record response history
- Return updated haunt

**Action handling** (actionIndex >= 0):
- Look up `haunt.actions[actionIndex]`
- Validate index bounds
- The actual tool execution happens on the UI side (sends message to Geist chat)
- Mark haunt as actioned: status='actioned', action=the label, actionedAt=now
- Record response history with the action label
- Return `{ ...updatedHaunt, actionMessage: action.message }` so the API caller gets the message to send

Note: The `actionHaunt` RPC does NOT execute the action's message itself. It just marks the haunt as actioned and returns the message. The UI is responsible for sending that message to Geist's chat. This keeps the service layer simple — it's a data update, not an orchestration point.

### Updated `recordHauntResponse`
Same as `recordPromptResponse` but with `hauntId` instead of `promptId`. Store `action` as the label text.

## API Changes — `apps/agenda/run.js`

Replace the three prompt endpoints:

| Old | New |
|-----|-----|
| `POST /api/v1/prompts/pending` | `POST /api/v1/haunts/pending` |
| `POST /api/v1/prompts/action` | `POST /api/v1/haunts/action` |
| `POST /api/v1/prompts/generate` | `POST /api/v1/haunts/generate` |

The `/haunts/action` endpoint changes its validation:
- Old: validates `action` against `['done', 'backlog', 'snooze', 'dismiss']`
- New: validates `id` (required) and `actionIndex` (required, must be integer, >= -1)

Remove the old `validActions` whitelist.

## Files to Modify

| File | Change |
|------|--------|
| `apps/agenda/src/services/geist.js` | Rename all prompt methods/vars to haunt, update system prompt with actions format, rewrite actionHaunt, add validateHauntActions |
| `apps/agenda/run.js` | Rename API paths, update action validation |
| `apps/agenda/tests/geist-prompts.js` | Update all tests: generation with actions, actionHaunt with actionIndex, validateHauntActions tests |

## Acceptance Criteria

- [ ] `hauntGenerationSystemPrompt` instructs Claude to generate actions array
- [ ] `generateHaunts` stores validated actions on created haunts
- [ ] `validateHauntActions` strips malformed entries, caps at 4
- [ ] `actionHaunt({id, actionIndex: -1})` dismisses
- [ ] `actionHaunt({id, actionIndex: 0})` marks actioned, returns actionMessage
- [ ] Invalid actionIndex throws error
- [ ] API paths use `/haunts/*`
- [ ] Action endpoint validates id + actionIndex (integer >= -1)
- [ ] Scheduler uses renamed methods
- [ ] All tests renamed and passing with new semantics
- [ ] New tests for action validation and execution
- [ ] `bun run test` green
