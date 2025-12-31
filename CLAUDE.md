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
 - for core framework functionality, write tests using the built-in testing framework
 - run `bun run test` after each change in src/
 - run `bun run test-ui` after html changes (like loom.js)
 - run `bun run test-bin` after bin/ changes (like lister.js)
</Testing>

## where to start
 - src/base.js: the core implementation
 - tests/core.js: core framework tests
 - demos/loom.js: reactive html prototype
 - src/live.js and demos/dummy/: rpc system prototype
