# Simulabra

Simulabra is a metaobject system for JavaScript: its “classes” are runtime objects, and “slots” (vars, methods, modifiers, mixins) are also objects. A program is primarily an object graph built by composing slots into classes and classes into modules.

This document is written from the actual sources in this repo, primarily `src/base.js` plus the exported libraries in `src/` and their tests in `tests/`.

## Historical Context (as evidenced in this repo)

Simulabra reads like an attempt to take the “everything is an object” mindset seriously in JavaScript while staying practical for small tools and full apps:

- **Metaobject lineage.** The core idea resembles a MOP (metaobject protocol): classes are constructed and reified at runtime; method combination (Before/After) is baked in. There are clear echoes of Smalltalk/CLOS style message dispatch and reflective class objects.
- **Lisp-y experimentation.** `misc/lisp.txt` and `misc/doc/syntax.txt`/`misc/doc/simulabra-x.jsx` show experimentation with a symbolic syntax layer (S-expr / JSX-like DSL) where “slots as objects” becomes a convenient literal format.
- **From core runtime → reactive UI → tooling.** The commit history and current tree show an evolution from the core system (`src/base.js`) into:
  - reactive state and dependency tracking (`Signal`, `Effect`, `Reactor`)
  - a template + component library (`src/html.js`) used by the Loom demos
  - live WebSocket RPC (`src/live.js`) for multi-process/service graphs
  - bin tools (`bin/lister.js`, `bin/finder.js`, `bin/gen-exports.js`) for introspection and maintenance
- **Multiple “Agenda”s.** There is an older `demos/agenda.js` (SQLite + Commands) and a newer `apps/agenda/` (Redis + live services). That split is useful for understanding the system’s direction: from in-process OO scripting toward supervised distributed objects.

Simulabra is opinionated: it expects you to gradually shed procedural “script style” and instead reify concepts as objects that can be inherited, composed, inspected, and tested.

## The Core Mental Model

### 1) Everything is a slot

In Simulabra, a class is defined as:

- a **name**
- a list of **slots** (objects) in `slots: [...]`

Slots include:

- **State slots**: `$.Var`, `$.Signal`, `$.Property` (stateful fields / reactive fields / JS properties)
- **Behavior slots**: `$.Method`, `$.Static`, `$.Command`
- **Method combination slots**: `$.Before`, `$.After`, `$.AsyncBefore`, `$.AsyncAfter`
- **Interface slots**: `$.Virtual` (a required selector)
- **Mixins / inheritance**: other classes can appear in the `slots` list, forming single or multiple inheritance via slot composition
- **Marker mixins**: `$.Configurable`, `$.History`, `$.JSON`, `$.Clone`, etc

Slots are not syntax sugar; they are objects with logic. Their job is to combine into a per-selector “implementation” and then “reify” onto a prototype.

### 2) Slot combination is first-class OO

When you define multiple slots with the same selector, Simulabra combines them into one call path:

- `$.Method` defines the primary implementation of a selector.
- `$.Before`/`$.After` wrap it.
- When a method is overridden, the previous method implementation is linked as `_next`, and you can call it explicitly via `this.next('methodName', ...)` (from `src/base.js`).

This is a core OO idiom in Simulabra: prefer small behavior objects and compose them with modifiers over hand-written wrapper functions or deep conditional logic.

### 3) “Vars” are methods (and also properties)

A `$.Var.new({ name: 'x' })` produces:

- an accessor method `x()` / `x(value)`
- and a JS property `._x` that forwards to `x()` (via `SlotImpl.__properties` and `Object.defineProperty`)

So code can be written either in “message passing” style (`p.x(3)`) or JS-ish property style (`p._x = 3`) depending on ergonomics.

### 4) Modules are object scopes

A Simulabra module is an object that:

- owns a **registry** of instances created inside it (and can chain to a parent module)
- owns class repositories (`repos`) keyed by class type and name
- can **import** other modules and access their classes through proxies

The canonical pattern is:

```js
import { __, base } from 'simulabra';
import html from 'simulabra/html';

export default await async function (_, $, $html) {
  $.Class.new({
    name: 'App',
    slots: [
      $html.Component,
      $.Signal.new({ name: 'count', default: 0 }),
      $.Method.new({ name: 'inc', do() { this.count(this.count() + 1); } }),
      $.Method.new({
        name: 'render',
        do() {
          return $html.HTML.t`<button onclick=${() => this.inc()}>
            clicked ${() => this.count()} times
          </button>`;
        }
      }),
    ]
  });
}.module({
  name: 'my.app',
  imports: [base, html],
}).load();
```

Inside a module function, the conventional parameters mean:

- `_` → proxy for **local** classes you define in the module (by name)
- `$` → proxy for **base** classes from `src/base.js`
- `$html`, `$live`, `$db`, `$llm`, `$http`, … → proxies for imported modules’ classes

This is the Simulabra way to keep namespaces explicit without giving up runtime reflection.

## Core Runtime Abstractions (`src/base.js`)

### Bootstrap, `__`, and the global object graph

`src/base.js` bootstraps the whole system via `bootstrap()` and exports:

- `base`: the base module (contains all intrinsic “core classes”)
- `__`: the global `SIMULABRA` object (an instance of `$.SimulabraGlobal`)

`__` is the glue:

- current module (`__.mod()`) and module stack
- the debug/trace stack for calls
- global registry access
- the reactive reactor (`__.reactor()`)
- utilities (`__.stringify`, `__.display`, `__.sleep`, etc)

### `Class`, prototypes, and “reification”

The defining mechanism is:

- each selector gets a `SlotImpl` that holds:
  - the primary method
  - befores/afters (sync and async)
  - debug metadata
  - property forwards (for `._x`)
- a `ClassPrototype` holds selector → `SlotImpl` mappings
- “reification” writes actual JS functions/properties onto the prototype object

Practically: defining a class is building these `SlotImpl`s by combining slot objects, then reifying into an executable prototype.

### Intrinsics (the “kernel” slot types)

These are the main building blocks you use constantly:

- `$.Var`: per-instance state with defaulting; accessor is a method and also creates `._name` property
- `$.Property`: like `Var` but installed as a JS property rather than a method (still stored under `__name`)
- `$.Method`: a method slot; supports method override chaining (`this.next(...)`)
- `$.Static`: a static function installed on the class object
- `$.Before` / `$.After`: synchronous method modifiers
- `$.AsyncBefore` / `$.AsyncAfter`: async method modifiers
- `$.Virtual`: declares a selector that must be implemented (throws if called)
- `$.Constant`: a selector that always returns a constant value
- `$.EnumVar`: a `Var` restricted to a choice set (validated at write and default init)

The common OO pattern is: define a small base class for a “role”, then extend by adding more slots and modifiers rather than rewriting logic.

### Object identity, inspection, and JSON

Every object has base behavior from `$BaseSlots`:

- identity: `id()`, `uid()`, `uri()`, `title()`, `ident()`
- introspection: `state()` (var states), `description()`, `toString()`
- logging: `log(...)`, `tlog(...)`, `dlog(...)`
- JSON: `jsonify()` calls the class’ `jsonify(object)` which serializes vars into `{ $class, $module, ... }`

There are also mixins:

- `$.JSON`: instance method `json()` that walks stored `__slot` fields and JSON-ifies nested objects/arrays/uris
- `$.Clone`: instance method `clone(deep = true)` that clones var state (with WeakMap cycle handling)

### Registries and module-level reflection

`$.ObjectRegistry` and `$.Module` combine into a reflective environment:

- objects register themselves in the current module during init
- registries track instances by class name, stored as weak refs keyed by `uri()`
- you can ask a module for `instances(SomeClass)`

This is how the test runner works: it loads modules, then queries each module for `instances($test.Case)` and runs them.

### Reactivity: `Signal`, `Effect`, and `Reactor`

Simulabra’s reactive system is small but foundational:

- `$.Signal` is like `Var` plus dependency tracking and scheduling.
  - reads register dependencies into the current `Reactor` stack
  - writes schedule dependent effects via microtasks
- `$.Effect.create(fn)` runs a function and re-runs it when dependent signals change
- `__.reactor().flush()` is a microtask-based “wait for the batch to apply” helper (used in `tests/html.js`)

Two useful higher-level mixins build on this:

- `$.Configurable` + `$.ConfigSignal` / `$.ConfigVar` for serializable configuration blobs
- `$.History` + `$.HistorySignal` for undo/redo via snapshots of marked fields

### Commands: reified verbs and call-site convenience

`$.Command` is a slot that installs a method on the prototype that returns a `$.CommandContext`, and a convenience method that immediately runs it.

In practice (see `demos/agenda.js`), this supports an OO style where:

- “pure verbs” exist as command objects that can be queued, logged, replayed, or inspected
- the receiving object (`runcommand`) decides how and when commands execute

The Command system is an example of “Simulabra style”: instead of free functions or closures, reify verbs so they can participate in composition and introspection.

## Included Libraries (exported from `package.json`)

Simulabra is a monorepo of small libraries that share the same object model.

### `simulabra` (core) — `src/base.js`

Provides:

- the metaobject system (Class + Slot composition)
- modules/registries
- core mixins (Clone, JSON, Configurable, History)
- reactivity primitives (Signal/Effect/Reactor)
- command system and misc utilities

### `simulabra/html` — `src/html.js`

Provides:

- a template literal tag `HTML.t` that parses and compiles a minimal HTML-ish template language into VNodes/components
- `VNode.h(tag, props, ...children)` for programmatic node construction
- `Component` base class with `render` virtual, and `mount()` convenience
- `ComponentInstance` wrapper that creates an `Effect` to re-render and patch the DOM

Key idiom: **reactive values are functions**.

- For attributes: if an attribute value is a function, it becomes reactive and is re-evaluated by an Effect.
- For children: if a child is a function, it becomes a reactive region (anchors + patching).

This is why templates must use `class=${() => ...}` rather than `class=${"..." + fn}`: non-functions are treated as static.

### `simulabra/live` — `src/live.js`

Provides:

- `LiveMessage` (Clone + JSON) with `{ from, to, topic, data, mid }`
- a `MessageHandler` interface and a `MessageDispatcher`
- RPC by convention:
  - `RPCHandler` handles topic `rpc`, calls `client[method](...args)` and replies with a `response` message
  - `NodeClient.serviceProxy({ name, timeout })` returns a JS Proxy: property access becomes an async RPC call
- `NodeClient.connect()` opens a WebSocket, handshakes with `to: 'master'`

This is a “distributed object” layer: you keep thinking in selectors/method calls, but the call can cross process boundaries.

### `simulabra/test` — `src/test.js` (+ `src/runner.js`)

Provides:

- `Case` and `AsyncCase` with a small assertion library
- `BrowserCase` which uses Playwright (see `tests/ui/loom.js`)
- a runner (`src/runner.js`) that loads modules and runs all `Case` instances registered in them

Tests in this repo treat modules as reflective containers: load module → list instances → run them.

### `simulabra/http` — `src/http.js`

Provides:

- `HTTPServer` wrapping Node’s `http.createServer`
- `RequestHandler` interface plus concrete handlers:
  - `PathRequestHandler` for exact path match
  - `FiletypeRequestHandler` for static file serving by extension
  - `HandlerLogger` as an After modifier for logging
- `HTTPRequestCommand` as a reified HTTP request verb using `fetch`

This library demonstrates a Simulabra pattern: handlers are objects, so composition (like logging) is done via mixins/modifiers.

### `simulabra/llm` — `src/llm.js`

Provides:

- `LLMClient`: a “pure client” for OpenAI-compatible completion APIs
  - configurable via `Configurable` + `ConfigSignal`
  - supports logprobs
  - supports an alternate multimodal endpoint used by some llama.cpp servers (see `imageMode`)
- `CompletionConfig`: small cloneable config object for per-request parameters
- `LogprobParser`: normalizes logprob formats across providers

The Loom demo composes `LLMClient` with the HTML component system to produce a configurable UI.

### `simulabra/db` — `src/db.js`

Provides:

- `SQLite.createDatabase(dbName)` (bun:sqlite)
- `DBVar`: a persisted field slot with SQL type metadata and transforms
- `Persisted` mixin: table creation, save/update, and `loadAll()`

The older `demos/agenda.js` demonstrates how `Persisted` and `Command` combine into an “OO app” without services.

## Included Tooling (`bin/`)

These aren’t exported as libraries, but they are part of the Simulabra “way” of working:

- `bin/lister.js`: introspects a module file and prints class definitions and slots (used as a navigation skill and tested in `tests/bin/lister.js`)
- `bin/finder.js`: searches for slot implementations across the repo by name, by piping `rg` + `lister` (tested in `tests/bin/finder.js`)
- `bin/gen-exports.js`: regenerates `package.json` `exports` from `src/*.js` (tested in `tests/bin/gen-exports.js`)
- `bin/domshim.js`: a minimal DOM+storage shim so browser-ish modules can load under Bun/Node without crashing (used by tooling)

## Simulabra Style Guidelines (what the codebase encourages)

### Think like a caller

In Simulabra, “good abstraction” usually means:

- your concept is a class with named slots
- its boundary effects are behind a small number of selectors
- it can be extended by adding slots rather than rewriting method bodies

If you find yourself writing a pile of helper functions, consider reifying:

- a “policy” object (time policy, retry policy, formatting policy)
- a “registry” object
- a “tool”/“command” object
- a “handler” object

### Prefer modifiers over manual wrappers

If you need logging, validation, metrics, caching, instrumentation:

- use `$.Before`/`$.After`/`$.AsyncBefore`/`$.AsyncAfter`
- call `this.next('method', ...)` to preserve composition

This keeps behavior orthogonal and makes inheritance/mixins work for you.

### Use `Signal` for reactive state, `Var` for inert state

- `Var`: state you read/write but that should not trigger dependent effects
- `Signal`: state that should participate in reactive updates (HTML, derived state, etc)

### Keep module boundaries explicit

Prefer to import modules and use `$moduleProxy.ClassName` rather than reaching into globals. The module system is the intended namespace boundary and introspection layer.

## Gaps, Edges, and Current “Truth”

This doc reflects the code as it exists today:

- `package.json` scripts reference `src/agent.js` / `serve` that is not present in `src/` in the current tree; the Loom demos are served via `serve.sh` instead.
- There are two separate “DOM shims” (`bin/domshim.js` and the inline shim in `tests/html.js`), reflecting multiple approaches to “run HTML-ish code under Bun”.

Those are not criticisms; they are markers of an evolving system. In Simulabra terms, they are opportunities for further reification and consolidation.

## Where to look next

- `src/base.js`: the full metaobject runtime (slots, modules, signals/effects, mixins)
- `tests/core.js` and `tests/modules.js`: idiomatic class/mixin/modifier/module usage
- `src/html.js` and `tests/html.js`: reactive templates and components
- `src/live.js`: live RPC object graphs and service proxies
- `demos/loom.js`: a large example of the style, combining HTML + LLM + configuration

