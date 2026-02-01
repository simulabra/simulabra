# Phase 7: UI Project Context Panel

Add a collapsible context panel that displays and allows editing of the selected project's context markdown.

## Dependencies
Phase 6 (UI project selector and projects signal).

## Files to modify

- `apps/agenda/src/ui/app.js` — Add ProjectContextPanel component, integrate into TodosView

## Changes

### New ProjectContextPanel component

Signals: `expanded` (bool), `editing` (bool), `editText` (string), `saving` (bool)

Methods:
- `currentProject()` — look up active project from app.projects(). Returns null for "All" or "Inbox".
- `toggleExpand()` — toggle expanded, load editText from project.context when expanding
- `startEdit()` — set editText from project.context, enter editing mode
- `cancelEdit()` — exit editing mode
- `saveContext()` — call app.api().updateProject({ id, context: editText }), reload projects, exit editing

Render logic:
- If no currentProject → render nothing (empty div)
- Collapsed: show header with ▶ toggle, project name
- Expanded read mode: show context text (or "(no context set)"), edit button
- Expanded edit mode: textarea bound to editText, save and cancel buttons

**Important**: All reactive attributes must be functions per CLAUDE.md.

### Integrate into TodosView

Place ProjectContextPanel between the view-header and the task-list:
```
${_.ProjectContextPanel.new({ app: this.app() })}
```

Panel only shows content when a specific project is selected.

## Testing

UI testing via `bun run test-ui`:
- Select project with context → header appears
- Click to expand → context text displayed
- Click edit → textarea with current content
- Modify and save → project context updated
- Cancel → returns to read mode
- Select "All" or "Inbox" → panel hidden

## Acceptance criteria
- Context panel appears only when a specific project is selected
- Collapsible with toggle
- Edit mode with textarea, save/cancel
- Save persists via API and refreshes project data
- Hidden for "All" and "Inbox"
