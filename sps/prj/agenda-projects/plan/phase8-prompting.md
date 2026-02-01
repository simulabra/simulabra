# Phase 8: Prompting System Integration

Extend the prompt generation system to include project data, group items by project, and use project context when generating nudges.

## Dependencies
Phase 2 (DatabaseService project methods), Phase 5 (Geist project resolution).

## Files to modify

- `apps/agenda/src/services/geist.js` — Extend analyzeContext and generatePrompts

## Changes

### Extend analyzeContext

Add `db.listProjects({ archived: false })` to the parallel Promise.all fetch. Build derived data:

- `projectMap` — `{ [id]: project }` lookup
- `tasksByProject` — `{ [projectId|'inbox']: [tasks] }` grouping

Return shape adds: `projects`, `projectMap`, `tasksByProject`.

### Update generatePrompts user message

Replace the flat tasks listing with a project-grouped format when projects exist:

```
ProjectName:
  context: first 150 chars of project context...
  - [id] task title (P3, due: 2026-03-01)
  - [id] another task (P2)

Inbox (unassigned):
  - [id] ungrouped task (P3)
```

When no projects exist, fall back to the current flat listing (backward compatible).

Also add a projects listing section:
```
Active projects (N):
- [id] Name (slug)
```

### Update promptGenerationSystemPrompt

Add to the attention categories:
- Project context relevance: tasks that may need updates relative to their project's goals
- Cross-project awareness: surface the most neglected project

Add optional `projectId` to the prompt object format.

### Pass projectId through to created prompts

When Claude includes `projectId` in generated prompt objects, store it in the prompt's context field:
```
context: { generatedFrom: context, projectId: promptData.projectId || null }
```

## Testing

- **AnalyzeContextIncludesProjects**: Add projects and tasks with projectIds. Call analyzeContext. Assert result includes projects, projectMap, tasksByProject.
- **AnalyzeContextGroupsCorrectly**: 2 projects + unassigned tasks. Assert tasksByProject has correct keys and items.
- **AnalyzeContextNoProjects**: With no projects, assert works (backward compatible), everything under 'inbox'.

Run: `bun run test`

## Acceptance criteria
- analyzeContext returns projects, projectMap, and tasksByProject
- generatePrompts formats tasks grouped by project
- Project context included in prompt generation input
- Works correctly with zero projects (backward compatible)
- Generated prompts can carry project context
