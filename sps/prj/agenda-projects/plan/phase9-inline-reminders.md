# Phase 9: Inline Prompt Reminders

## Goal

Prompt reminders should appear chronologically interleaved with chat messages, not grouped at the bottom after all messages.

## Problem

In `ChatView.render()` (`src/ui/app.js:801-808`), three separate reactive blocks render sequentially:

1. `messages().map(...)` — all chat messages
2. `pendingPrompts().map(...)` — all pending prompts
3. Loading indicator

This pins prompts below all messages regardless of when they were created.

## Approach: Extracted Timeline Method

Add a `chatTimeline` Method to ChatView that merges `messages()` and `pendingPrompts()` into a single chronologically sorted array with a `kind` discriminator.

### Why this approach

- Reads both signals → reactive automatically in templates
- Matches existing pattern of `filteredReminders()` (line 674) and similar extracted computed methods
- Avoids extra Signal/Effect synchronization — derives view on every render (cheap for ~15 items)
- Testable as a standalone method

### chatTimeline Method

Responsibilities:
- Tag each message as `{ kind: 'message', ts: m.timestamp || m.createdAt, item: m }`
- Tag each prompt as `{ kind: 'prompt', ts: p.createdAt, item: p }`
- Merge and sort by timestamp ascending
- Items without timestamps (local system messages, pending user messages) sort to end, preserving relative order

Add to ChatView slots, alongside `inputText` and `generating` signals (after line ~754).

### Template update

Replace the two separate reactive blocks (lines 806-807) with a single block:

```
${() => this.chatTimeline().map(entry =>
  entry.kind === 'message'
    ? _.ChatMessage.new({ message: entry.item })
    : _.PromptMessage.new({ app: this.app(), prompt: entry.item })
)}
```

### What stays unchanged

- `ChatMessage` and `PromptMessage` components — no changes
- Auto-scroll effect (lines 793-797) — already watches both signals
- All data loading methods (`loadChatHistory`, `loadPendingPrompts`, `startSyncLoop`)
- `actionPrompt` behavior — system message (no timestamp) appears at end, acted prompt disappears from timeline

## Files

- **Modify:** `apps/agenda/src/ui/app.js` — add `chatTimeline` Method to ChatView, update render template
- **Modify:** `apps/agenda/tests/geist-prompts.js` — add test cases for merge ordering

## Tests

Unit test the `chatTimeline` merge logic:
- Messages at T+0, T+2, T+4 with prompts at T+1, T+3 → interleaved correctly
- Messages without timestamps sort to end
- Empty prompts array → messages only
- Empty messages array → prompts only

## Acceptance Criteria

- Prompts appear at their `createdAt` position in the chat timeline
- Messages without timestamps still appear at the end
- Prompt actions (done/backlog/later/dismiss) still work correctly
- Auto-scroll fires when either signal changes
- `bun run test` passes
