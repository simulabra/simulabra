# Phase 5: Context-Driven Project Resolution

Add a project resolution step to Geist's interpretMessage flow. Geist determines relevant projects from message context and includes project information in the system prompt dynamically.

## Dependencies
Phase 2 (DatabaseService project methods), Phase 4 (project tools registered).

## Files to modify

- `apps/agenda/src/services/geist.js` — Add resolveProjectContext, buildSystemPrompt; modify interpretMessage and interpret

## Changes

### New resolveProjectContext method

Loads active projects from DatabaseService. Returns null if no projects exist, or:
```
{
  projects: [...],
  projectList: "- [id] Name (slug): context snippet...\n..."
}
```

### New buildSystemPrompt method

Takes optional projectContext. Returns base systemPrompt if no projects. When projects exist, appends:
- Active project listing with ids, names, slugs, context snippets (truncated to 200 chars)
- Project tool mappings: create_project, list_projects, update_project, move_to_project
- Instructions: "when the user mentions a project by name or slug, use the project's id in tool calls. if creating tasks/logs/reminders and a project is clearly implied, set projectId."

### Update systemPrompt default

Add project tool mappings to the existing tools list in the systemPrompt string:
```
- project → create_project / list_projects
- move to project → move_to_project
- archive project → update_project(archived=true)
```

### Modify interpretMessage

Before the Claude API call:
1. `const projectContext = await this.resolveProjectContext();`
2. `const systemPrompt = this.buildSystemPrompt(projectContext);`
3. Replace both occurrences of `system: this.systemPrompt()` with `system: systemPrompt`

The same `systemPrompt` variable is used for both the initial call and the follow-up (after tool execution), ensuring consistent context within a turn.

### Modify interpret (the simpler method)

Same pattern: resolve context, build prompt, use dynamic prompt.

## Design rationale

Geist sees ALL active projects and determines relevance from the message. This means:
- User can say "add a task to taxes-2026" from any view
- No coupling between UI project selection and Geist's understanding
- If no project is mentioned, Geist leaves projectId null (Inbox)
- Cross-project operations work naturally ("move the coin task to house stuff")

## Testing

- **ResolveProjectContextEmpty**: Mock dbService returning empty projects. Assert returns null.
- **ResolveProjectContextWithProjects**: Mock returning 2 projects. Assert returns object with projects array and projectList string.
- **BuildSystemPromptNoProjects**: Call with null. Assert returns base prompt unchanged.
- **BuildSystemPromptWithProjects**: Call with context. Assert contains "active projects:" and project names.
- **ToolDefinitionsIncludeProjectTools**: Assert tools() includes the 4 new project tools.

Note: Full interpretMessage testing requires Claude API key or mocking Anthropic client. The critical testable path is resolveProjectContext and buildSystemPrompt.

Run: `bun run test`

## Acceptance criteria
- resolveProjectContext loads active projects from DatabaseService
- buildSystemPrompt includes project listing when projects exist
- interpretMessage and interpret use dynamic system prompt
- System prompt includes project tool mappings
- No regression when no projects exist

## Review

**Verdict: Approved.**

The implementation is correct, minimal, and follows the plan faithfully.

**Code quality:**
- `resolveProjectContext` and `buildSystemPrompt` are properly factored — one async for data fetching, one sync for string assembly. Clean separation.
- The `systemPrompt` local variable correctly replaces both `this.systemPrompt()` call sites in both `interpret` and `interpretMessage`, ensuring consistent context across initial and follow-up API calls within a turn.
- Doc strings are present and descriptive on both new methods.
- No accidental complexity introduced; the changes are the minimum needed.

**Fixes made during review:**
- Added missing blank line between test cases (style consistency with the rest of the file).
- Added missing `database.close()` in `BuildSystemPromptWithProjects` test.
- Removed unused `proj` variable binding in `ResolveProjectContextExcludesArchived` test.

**Tests:**
- 6 new tests cover all specified scenarios plus an extra archived-exclusion test beyond what the plan called for.
- The plan's `ToolDefinitionsIncludeProjectTools` test was already covered by the Phase 4 `ToolRegistryCount` test in tools.js. The carpenter chose `SystemPromptIncludesProjectToolMappings` instead, which tests the actual integration point (system prompt text) — a better choice.
- All 24 geist-prompts tests pass. No regressions in tools (15) or database (49) tests.

**No issues found.**
