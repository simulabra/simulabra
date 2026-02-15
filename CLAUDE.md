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
