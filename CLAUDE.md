# CLAUDE.md

<InfiniteSoftware>
Simulabra is, most simply, a metaobject system for javascript. On top of this a whole world of objects and agents is constructed.

<Spirit>
Simulabra builds on itself. Every new tool, script, or analysis should be a Simulabra module — reusable classes with slots, not throwaway code. When you need a utility, make it a class. When you need a script, give it `import.meta.main`. When you see a pattern repeating, reify it.

This is kaizen: continuous improvement through small, composable steps. Each change should leave the system more capable than before. Prefer extending what exists over replacing it. Prefer building infrastructure that future work can stand on over solving only the immediate problem. The codebase is a living system — tend it.
</Spirit>

<CodingStandards>
 - be consistent with naming  - do not use overly short names in public interfaces
 - DO NOT ADD COMMENTS unless they are necessary, prefer doc strings and readable code
 - the shortest solution is generally best, but it is most important to handle complexity
 - consider different approaches and tradeoffs when encountering difficult problems
 - try to always do things the simulabra way, in style and idiom
 - always read the whole file a change is in and all the modules it depends on
 - start with the interface, think like the caller
 - NEVER use `name` as a Var or DBVar slot — it is a reserved built-in property on all Simulabra objects (holds the identity string). Use `title` or a more specific alternative instead.
 - fail fast: never silently degrade on missing dependencies. Crash and let the supervisor restart. Do not return soft errors when the real problem is a missing connection or prerequisite.
</CodingStandards>

<Patterns>
These patterns apply to all Simulabra code. Reach for them by default.

REIFY EVERYTHING: if a concept has identity, gets passed between methods, or appears in more than one place — make it a class with slots. Plain objects `{}` are for throwaway local data only.

```js
// WRONG: returning a plain object that represents a domain concept
$.Method.new({
  name: 'getResult',
  do() {
    return { tool: this.toolName(), input: args, result: output };
  }
})

// RIGHT: define a class for the concept
$.Class.new({
  name: 'ToolResult',
  slots: [
    $.Var.new({ name: 'tool' }),
    $.Var.new({ name: 'input' }),
    $.Var.new({ name: 'result' }),
    $.Method.new({
      name: 'description',
      do() { return `${this.tool()}: ${JSON.stringify(this.result())}`; }
    }),
  ]
})
```

EnumVar — use when a slot has a fixed set of valid values. Inherits from Var, adds `choices` (required array). The setter throws if the value isn't in the list.

```js
// WRONG: plain Var accepts any string — typos silently succeed
$.Var.new({ name: 'status', default: 'pending' })

// RIGHT: EnumVar validates at runtime and documents the contract
$.EnumVar.new({
  name: 'status',
  choices: ['pending', 'active', 'done', 'cancelled'],
  default: 'pending',
})
```

Use for: status fields, type discriminators, mode selectors — any slot with a closed set of values. Already used by ServiceSpec.restartPolicy and RecurrenceRule.pattern.

Virtual — declare methods that subclasses MUST implement. Throws "not implemented" if called without an override.

```js
// In a mixin, declare what implementors must provide
$.Class.new({
  name: 'NotificationHandler',
  slots: [
    $.Virtual.new({ name: 'handle', doc: 'process a notification' }),
    $.Virtual.new({ name: 'canHandle', doc: 'whether this handler applies' }),
  ]
})
```

Use for: service contracts, handler interfaces, abstract base classes. Already used by Tool.execute, MessageHandler.topic/handle, RequestHandler.match/handle.

Before/After beyond init — use for cross-cutting concerns like logging, validation, and event emission. Don't limit them to After.init.

```js
// Automatic trace logging on tool execution
$.After.new({
  name: 'executeTool',
  do(toolName, args) {
    this.tlog(`tool: ${toolName}(${JSON.stringify(args)})`);
  }
})
```

Use for: audit logging, automatic event emission, validation guards, metrics.

Static methods over standalone functions — NEVER define module-level `function` declarations for logic that belongs to a class. Static methods are discoverable through `__.classes()`, documentable with `doc:`, and overridable by subclasses.

```js
// WRONG: bare function outside the class system
function formatDate(d) { return d.toISOString().split('T')[0]; }

// RIGHT: Static method on the appropriate class
$.Static.new({
  name: 'formatDate',
  doc: 'format a Date as YYYY-MM-DD',
  do(d) { return d.toISOString().split('T')[0]; }
})
```

DBVar vs Var:
 - DBVar: persisted to database, has toSQL/fromSQL converters, indexed/searchable flags
 - Var: in-memory only, for runtime state, config, computed values
 - use DBVar for anything that must survive a restart; Var for everything else

FTS5 search — when using SQLitePersisted with `searchable: true` fields, use the built-in `Model.search(db, query)` static method instead of loading all rows and filtering in JS. The FTS5 virtual tables and sync triggers are maintained automatically.

```js
// WRONG: load every row, filter in memory
const all = MyModel.findAll(db);
const matches = all.filter(m => m.content().toLowerCase().includes(q));

// RIGHT: use the FTS5 index
const matches = MyModel.search(db, query);
```

Configurable mixin — for classes with many environment-driven settings, consider the Configurable mixin with ConfigVar slots. Enables config serialization and introspection. See src/llm.js for an example.
</Patterns>

<AntiPatterns>
 - PLAIN OBJECTS FOR DOMAIN CONCEPTS: if you're building `{ field1, field2, ... }` with 3+ fields and passing it between methods, make it a class
 - DUPLICATE METHOD BODIES: if two methods share >50% of their code, extract the shared logic into a core method and wrap it
 - CLIENT-SIDE FILTERING: don't `findAll()` then `.filter()` when database indexes or FTS5 exist for those criteria
 - STANDALONE FUNCTIONS: don't put conversion or utility logic in bare `function` declarations — use Static methods
 - AD-HOC MIDDLEWARE: don't write closures that generate handlers — use the handler class hierarchy or create a new handler class
</AntiPatterns>

<Testing>
 - test ALL permanent code using the built-in testing framework
 - read `./tests/simple.js` for a contrived example of the testing framework
 - run `bun run test` after each change in src/
 - run `bun run test-ui` after html changes (like loom.js)
 - run `bun run test-bin` after bin/ changes (like lister.js)
</Testing>

<Developing>
 - ALWAYS use Simulabra for new scripts and functionality
 - when refactoring, form an understanding of the component parts of a problem and properly rearrange them using inheritance and composition
 - before you start changing things, ask if there is a better way
 - keep command outputs short — pipe through `tail`, use filters, or suppress verbose logging. The user reads the output in a terminal.
 - NEVER use `git -C <path>` — it breaks permission caching. Always run git commands from the repo root.
</Developing>

<HTML>
 - in $html.HTML.t templates, reactive attribute values MUST be functions
 - WRONG: class=${"base " + (this.active() ? "active" : "")} - concatenates string with function object
 - RIGHT: class=${() => "base " + (this.active() ? "active" : "")} - function returns computed string
 - the template system calls functions to get reactive values; non-functions are treated as static
 - run `bash bin/build` to bundle HTML apps for production (outputs to out/)
 - HTML entry points should use relative paths to source files (e.g. ./src/app.js), not dist/
</HTML>

<Navigating>
 - use the list-classes skill to get a quick overview of a file without reading all of it
 - use the find-slot-impls skill to find all the implementations across files of a given slot name
 </Navigating>

<LaunchPoints>
 - src/base.js: the core implementation
 - tests/core.js: core framework tests
 - demos/loom.js: reactive html prototype of a branching interface for llms
 - src/live.js and demos/dummy/: rpc system prototype
 - apps/agenda/ - personal productivity system with html/sms/cli clients
 - app/swyperloom/ - loom variant tailored for mobile
</LaunchPoints>

<DoYourJob>
THIS IS THE MOST IMPORTANT SECTION. Do not skip it.

- For ANY non-trivial task, your FIRST action MUST be to invoke the foreman skill.
- Do NOT start writing code, reading files, or making plans on your own. The foreman delegates.
- Plans are written to `sps/prj/{name}/plan/` by the architect during plan mode, BEFORE calling ExitPlanMode.
- If a project already exists in `sps/prj/`, the foreman will pick up where it left off.
- If the user pastes a plan inline, the foreman writes it to the project directory first, then delegates.
- The workflow is: foreman → architect (plan to disk) → carpenter (build from disk) → inspector → operator.
- Be very attentive to the triggering conditions in skill descriptions.
</DoYourJob>
