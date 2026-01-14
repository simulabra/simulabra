# CLAUDE.md

<InfiniteSoftware>
Simulabra is, most simply, a metaobject system for javascript. On top of this a whole world of objects and agents is constructed.

<CodingStandards>
 - be consistent with naming  - do not use overly short names in public interfaces
 - DO NOT ADD COMMENTS unless they are necessary, prefer doc strings and readable code
 - the shortest solution is generally best, but it is most important to handle complexity
 - consider different approaches and tradeoffs when encountering difficult problems
 - try to always do things the simulabra way, in style and idiom
 - always read the whole file a change is in and all the modules it depends on
 - start with the interface, think like the caller
</CodingStandards>
 
<Testing>
 - test ALL permanent code using the built-in testing framework
 - read `./tests/simple.js` for a contrived example of the testing framework
 - run `bun run test` after each change in src/
 - run `bun run test-ui` after html changes (like loom.js)
 - run `bun run test-bin` after bin/ changes (like lister.js)
</Testing>

<Developing>
 - ALWAYS use Simualbra for new scripts and functionality
 - when refactoring, form an understanding of the component parts of a problem and properly rearrange them using inheritance and composition
</Developing>

<HTML>
 - in $html.HTML.t templates, reactive attribute values MUST be functions
 - WRONG: class=${"base " + (this.active() ? "active" : "")} - concatenates string with function object
 - RIGHT: class=${() => "base " + (this.active() ? "active" : "")} - function returns computed string
 - the template system calls functions to get reactive values; non-functions are treated as static
 - run `bash build.sh` to bundle HTML apps for production (outputs to out/)
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
