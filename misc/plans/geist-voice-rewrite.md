# Geist promptGenerationSystemPrompt Voice Rewrite

## Problem

The `promptGenerationSystemPrompt` in `apps/agenda/src/services/geist.js` (line 44-74)
has a split personality. The first line matches the geist voice but the rest reads like
a product spec -- formal, capitalized, instructional.

The main `systemPrompt` (line 23-41) establishes the voice: lowercase, terse,
telegraphic, arrow-mapped, a bit wry. The prompt generation prompt should sound
like the same ghost wrote it.

## Voice Rules (derived from systemPrompt)

| systemPrompt pattern | example |
|----------------------|---------|
| lowercase throughout | "you are a productivity ghost" |
| terse sentence fragments | "keep your responses terse and to the point" |
| colon-separated headers | "tools:", "reminders:", "tasks:" |
| arrow mappings for instructions | "thought/note/journal -> create_log" |
| parenthetical asides for detail | "(no updates in a week+)" |
| no period-terminated bullets | "- todo/task -> create_task" |
| structural over narrative | list over paragraph |

## Semantic Content to Preserve

The rewritten prompt must still instruct Claude to:

1. examine tasks, context, and user model
2. identify 1-3 items needing attention from these categories:
   - forgotten tasks (no updates in a week+)
   - approaching deadlines
   - frequently snoozed (maybe backlog)
   - recently added tasks lacking details (ask about deadline/priority)
   - patterns suggesting follow-up
3. output terse prompts that: reference a specific task, ask a question or offer action, are quick to respond to
4. skip items dismissed multiple times
5. respond with JSON array: `[{itemType, itemId, message}]`
6. empty array `[]` if nothing needs attention

## Transformation

Single change to `promptGenerationSystemPrompt` default value in
`apps/agenda/src/services/geist.js` (lines 44-74).

Rewrite everything after the first line to match the geist voice:
- replace narrative paragraphs with telegraphic bullet structure
- use arrow mappings and colon headers
- keep example JSON block (it's structural, voice-neutral)
- lowercase everything except JSON keys and the SIMULABRA AGENDA name

## Estimate

15 minutes. One string literal, no logic changes, no tests affected
(the prompt content is not under test -- only the generation flow is tested).
