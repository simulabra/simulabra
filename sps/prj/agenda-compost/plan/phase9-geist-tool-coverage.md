# Phase 9: GeistService executeTool Coverage for Remaining Tools

## Goal
Add `executeTool` integration tests for the 6 tools missing from `tests/services/geist.js`: `update_task`, `create_project`, `list_projects`, `update_project`, `move_to_project`, `trigger_webhook`.

## Rationale
The existing tests cover 8 of 14 tools through `executeTool`. The remaining 6 have schema tests in `tests/tools.js` (via mocked services) but no integration tests exercising the full path: GeistService → ToolRegistry → Tool.execute → DatabaseService.

## Existing Pattern
The test file already has helpers at the top:
```
createDbService() → DatabaseService.new({ dbPath: ':memory:' }), initDatabase()
createGeistService(dbService) → GeistService.new(), set dbService
```
Each test creates its own in-memory DB, executes a tool, asserts the result, closes the DB.

## Tests to Add

### update_task
- `GeistServiceExecuteUpdateTask`: Create task, then `executeTool('update_task', { id, title: 'new title', priority: 2 })`. Assert result.success and modified fields match.

### create_project / list_projects / update_project
- `GeistServiceExecuteCreateProject`: `executeTool('create_project', { title: 'My Project', slug: 'my-project' })`. Assert result.data has correct title, slug, $class.
- `GeistServiceExecuteListProjects`: Create 2 projects, `executeTool('list_projects', {})`. Assert result.data.length >= 2.
- `GeistServiceExecuteUpdateProject`: Create project, `executeTool('update_project', { id, title: 'Updated', context: 'new context' })`. Assert updated fields.

### move_to_project
- `GeistServiceExecuteMoveToProject`: Create task + project, `executeTool('move_to_project', { itemType: 'task', itemId, projectId })`. Assert task now has projectId.
- `GeistServiceExecuteMoveToProjectBySlug`: Create task + project with slug, move via projectSlug. Assert slug resolved correctly.
- `GeistServiceExecuteMoveLogToProject`: Create log + project, move log. Assert log.projectId changed.
- `GeistServiceExecuteMoveToProjectUnknownType`: `move_to_project` with `itemType: 'invalid'`. Assert `success: false`.

### trigger_webhook
- `GeistServiceExecuteTriggerWebhook`: Use `Bun.serve({ port: 0, fetch: ... })` to create a temporary HTTP server, capture the received POST body. Call `executeTool('trigger_webhook', { url: serverUrl, payload: { test: true } })`. Assert server received the correct payload. Tear down server in finally block.

## Source References
- Tool definitions: `apps/agenda/src/tools.js`
  - UpdateTaskTool:447-479
  - CreateProjectTool:305-338
  - ListProjectsTool:340-366
  - UpdateProjectTool:368-399
  - MoveToProjectTool:401-445
  - TriggerWebhookTool:266-303 (uses geistService.executeWebhook internally)
- GeistService.executeTool: `apps/agenda/src/services/geist.js`
- GeistService.executeWebhook: `apps/agenda/src/services/geist.js` — does HTTP POST via fetch()

## Files to Modify
- `apps/agenda/tests/services/geist.js`

## Acceptance Criteria
- [ ] All 14 tools have at least one `executeTool` integration test through GeistService
- [ ] `trigger_webhook` test uses a real HTTP server (not mocked fetch)
- [ ] Error cases covered (unknown item type in move_to_project)
- [ ] `TIMEOUT=30 bun run src/runner.js apps/agenda/tests/services/geist.js` passes
- [ ] `bun run test` clean
