# Phase 13: Haunts — UI Dynamic Actions

## Goal
Render dynamic action buttons from each haunt's `actions` array. When clicked, send the action's `message` to Geist's chat. Rename all UI prompt nomenclature to haunt. Update CSS. Dismiss is the only implicit button.

## Context
After Phases 11-12, haunts are generated with `actions: [{label, message}]` and the API returns `actionMessage` when an action is taken. Now the UI needs to:
1. Render N dynamic buttons per haunt (from the actions array) + dismiss
2. On action click: call actionHaunt API, then send the returned `actionMessage` to Geist chat
3. Rename all prompt→haunt in UI code and CSS

## Component Changes — `apps/agenda/src/ui/app.js`

### HauntMessage (replaces PromptMessage, lines 181-229)

Rename class `PromptMessage` → `HauntMessage`. Update doc to: "Haunt rendered inline with context-specific action buttons".

**Var renames**:
- `prompt` → `haunt`

**Updated `handleAction(actionIndex)`**:
The signature changes from `handleAction(action)` (string) to `handleAction(actionIndex)` (integer).

Flow:
1. Guard with `acting()` signal (same as before)
2. Call `this.app().actionHaunt(this.haunt().id, actionIndex)`
3. The app method handles sending the message to Geist

**New `renderActions()` method**:
Generates buttons dynamically from the haunt's actions array:

```
const actions = this.haunt().actions || [];
const buttons = actions.map((action, index) =>
  <button class="haunt-btn action" onclick={handleAction(index)}>{action.label}</button>
);
// Always append dismiss
buttons.push(
  <button class="haunt-btn dismiss" onclick={handleAction(-1)}>dismiss</button>
);
return buttons;
```

**Updated `render()`**:
- CSS class: `chat-message assistant haunt` (was `prompt`)
- Actions div class: `haunt-actions` (was `prompt-actions`)
- Calls `renderActions()` instead of hardcoded 4 buttons
- Source label stays "geist" (it's the ghost speaking)

### AgendaApiClient

Rename methods:
- `getPendingPrompts` → `getPendingHaunts` (path: `/api/v1/haunts/pending`)
- `actionPrompt` → `actionHaunt` (path: `/api/v1/haunts/action`)
- `generatePrompts` → `generateHaunts` (path: `/api/v1/haunts/generate`)

The `actionHaunt` method sends `{ id, actionIndex }` instead of `{ id, action }`.

### AgendaApp

**Signal rename**: `pendingPrompts` → `pendingHaunts`

**Method renames**:
- `loadPendingPrompts` → `loadPendingHaunts`
- `generatePrompts` → `generateHaunts`

**Updated `actionHaunt` (replaces `actionPrompt`)**:

New signature: `actionHaunt(id, actionIndex)`

Flow:
1. Call `this.api().actionHaunt({ id, actionIndex })` — gets back result with `actionMessage`
2. If actionIndex >= 0 (not dismiss) and result has `actionMessage`:
   - Add the action message as a user message in chat: `this.addMessage({ role: 'user', content: result.actionMessage })`
   - Send it to Geist: `this.sendMessage(result.actionMessage)` (this triggers Geist's agentic interpretation loop)
3. If actionIndex === -1 (dismiss):
   - Show system message: `dismissed: "snippet..."`
4. Reload haunts: `this.loadPendingHaunts()`
5. On error: show system message with error

**Note on `sendMessage`**: The existing `sendMessage` method (used by ChatView's input) sends a user message to Geist and processes the response. Reuse it directly — the haunt action just becomes a user message that triggers the normal Geist conversation flow.

### ChatView

In `chatTimeline()`:
- Rename `pendingPrompts` → `pendingHaunts`
- Tag kind: `'prompt'` → `'haunt'`

In render template:
- `entry.kind === 'haunt'` → `_.HauntMessage.new({ app: this.app(), haunt: entry.item })`

The "nudge" button (if present) should call `generateHaunts()` instead of `generatePrompts()`.

## CSS Changes — `apps/agenda/src/style.css:655-707`

Rename all selectors from `.prompt` to `.haunt`:

```css
/* Inline Haunt Messages */
.chat-message.haunt { border: 1px dashed var(--ocean); }

.chat-message.haunt .haunt-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.chat-message.haunt .haunt-btn {
  /* base button styles (same as current .prompt-btn) */
}

/* First action button gets primary emphasis */
.chat-message.haunt .haunt-btn.action:first-child {
  background: var(--grass);
  color: var(--seashell);
}

/* Other action buttons */
.chat-message.haunt .haunt-btn.action {
  background: var(--sand);
  color: var(--seaweed);
}

/* Dismiss always muted */
.chat-message.haunt .haunt-btn.dismiss {
  background: var(--sand);
  color: var(--charcoal);
  opacity: 0.7;
}
```

Remove the old `.prompt-btn.done`, `.prompt-btn.backlog`, `.prompt-btn.later` specific styles. Replace with two classes: `.haunt-btn.action` (dynamic, from LLM) and `.haunt-btn.dismiss` (implicit). The first `.action` button gets highlighted as the primary suggestion.

## Files to Modify

| File | Change |
|------|--------|
| `apps/agenda/src/ui/app.js` | HauntMessage component, API client renames, app signal/method renames, actionHaunt sends message to Geist |
| `apps/agenda/src/style.css` | Rename .prompt → .haunt selectors, simplify button styles to action/dismiss |
| `apps/agenda/tests/ui/app.js` | Rename prompt tests, add dynamic button rendering test, add action→Geist message test |

## UX Flow (end-to-end)

1. Geist generates haunts with actions: `"you have 2 house tasks idle"` with actions `[{label: "create project", message: "create a project called house and move my house tasks into it"}, {label: "snooze", message: "snooze task abc for 3 days"}]`
2. UI renders haunt card with buttons: `[create project] [snooze] [dismiss]`
3. User clicks "create project"
4. UI calls `POST /api/v1/haunts/action {id, actionIndex: 0}` → haunt marked actioned, returns `{actionMessage: "create a project called house..."}`
5. UI adds "create a project called house..." as a user message in chat
6. UI sends that message to Geist via the normal `sendMessage` flow
7. Geist processes: calls `create_project` tool, calls `move_to_project` tool, responds with confirmation
8. Chat shows the full conversation naturally

## Acceptance Criteria

- [ ] HauntMessage renders dynamic buttons from `actions` array
- [ ] Haunts with null/empty actions render with dismiss only
- [ ] Clicking an action button sends `actionIndex` to API
- [ ] After action, the `actionMessage` is sent to Geist as a user message
- [ ] Geist processes the message through its normal agentic loop
- [ ] Dismiss works without sending a message to Geist
- [ ] System messages reflect the chosen action's label
- [ ] CSS uses `haunt` nomenclature throughout
- [ ] First action button visually emphasized (primary suggestion)
- [ ] "nudge" button triggers haunt generation
- [ ] `bun run test-ui` green (targeted: `bun run src/runner.js apps/agenda/tests/ui/app.js`)
- [ ] `bun run test` green
