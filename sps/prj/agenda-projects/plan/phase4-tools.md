# Phase 4: Project Tools for Geist

Add new tool classes for project management and extend existing tools with optional projectId.

## Dependencies
Phase 2 (DatabaseService project CRUD methods).

## Files to modify

- `apps/agenda/src/tools.js` — Add 4 new tool classes, extend existing tool schemas, register in AgendaToolRegistry

## Changes

### New tool classes

#### CreateProjectTool (`create_project`)
- **doc**: Create a new project for organizing tasks, logs, and reminders
- **inputSchema**: `name` (required string), `slug` (optional string), `context` (optional string)
- **execute**: `services.db.createProject({ name, slug, context })`

#### ListProjectsTool (`list_projects`)
- **doc**: List all projects, optionally filtering by archived status
- **inputSchema**: `archived` (optional boolean)
- **execute**: `services.db.listProjects(args)`

#### UpdateProjectTool (`update_project`)
- **doc**: Update a project name, slug, context, or archived status
- **inputSchema**: `id` (required string), `name`, `slug`, `context`, `archived` (all optional)
- **execute**: `services.db.updateProject(args)`

#### MoveToProjectTool (`move_to_project`)
- **doc**: Move a task, log, or reminder to a project (or to Inbox by passing null)
- **inputSchema**: `itemType` (required, enum: task/log/reminder), `itemId` (required string), `projectId` (optional string|null), `projectSlug` (optional string)
- **execute**:
  1. If `projectSlug` provided and no `projectId`, look up via `services.db.getProjectBySlug({ slug })`
  2. Resolve target projectId (null = Inbox)
  3. Dispatch to `services.db.updateTask/updateLog/updateReminder({ id: itemId, projectId })`

### Extend existing tools

Add optional `projectId` (string) to inputSchema.properties for:
- **CreateTaskTool** — pass through in execute
- **CreateLogTool** — pass through in execute
- **CreateReminderTool** — pass through in execute
- **ListTasksTool** — already passes args through to db.listTasks
- **ListLogsTool** — same
- **ListRemindersTool** — same

### Register in AgendaToolRegistry

Add to init():
```
this.register(_.CreateProjectTool.new());
this.register(_.ListProjectsTool.new());
this.register(_.UpdateProjectTool.new());
this.register(_.MoveToProjectTool.new());
```

Total tools: 9 → 13.

## Testing

- **ToolRegistryCount**: Assert 13 tools registered. Assert new tool names present.
- **CreateProjectToolSchema**: Assert name required, slug and context optional.
- **MoveToProjectToolSchema**: Assert itemType and itemId required, projectId and projectSlug optional.
- **CreateTaskToolSchemaExtended**: Assert create_task inputSchema now includes projectId.
- **ToolExecuteCreateProject**: Execute with mocked services, assert db.createProject called.
- **ToolExecuteMoveToProjectBySlug**: Execute with mocked services including getProjectBySlug, assert correct dispatch.

Run: `bun run test`

## Acceptance criteria
- 13 tools registered in AgendaToolRegistry
- All new tool definitions conform to Anthropic API format
- Existing tools accept optional projectId without breaking
- move_to_project supports both projectId and projectSlug lookup

## Review

**Verdict: Approved** with one bug fix applied.

### Bug fixed
- `ListLogsTool.execute` was hardcoding `{ limit: args.limit || 50 }`, discarding `projectId` even though the schema declared it. The plan says "ListLogsTool — same" (as ListTasksTool which passes args through). Fixed to `{ ...args, limit: args.limit || 50 }` which spreads all args (including projectId) then applies the limit default.

### Code quality
- New tool classes are structurally identical to the existing tools. Consistent Simulabra idiom: `$tools.Tool` mixin, `toolName`/`doc`/`inputSchema` Vars, `execute` Method.
- `MoveToProjectTool.execute` is the most complex method in the file. The `?? null` / slug-lookup / switch dispatch logic is clean and readable. Error handling for missing project and unknown itemType is correct.
- The `name` → `title` rename from Phase 1 is applied consistently throughout.
- Doc strings on all 4 new Classes are present and match existing style.

### Style
- The `|| null` pattern for optional projectId in create tools is consistent with existing patterns (e.g., `dueDate: args.dueDate || null`).
- Schema descriptions are clear and consistent across all tools.

### Test quality
- 7 new test cases cover schemas, execution, and slug resolution.
- Pre-existing mock bug fix (positional → object args) is a legitimate fix.
- `ToolRegistryCount` partially overlaps with `AgendaToolRegistryDefaults` on the count assertion, but they test different name sets — acceptable.
- `ToolDefinitionsMatchAnthropicFormat` test (pre-existing) now validates all 13 tools automatically.

### No issues found
All acceptance criteria are met. 15 agenda tools tests pass, all core tests pass.
