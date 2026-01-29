# Simulabra, Explained: Object-Oriented JavaScript with a Metaobject Protocol

Most JavaScript “frameworks” start with the runtime you already have: prototypes, classes, functions, and plain objects. Simulabra goes one level lower and asks a different question:

What if your *class system itself* were programmable?

Simulabra is a small metaobject system for JavaScript plus a handful of companion libraries (reactivity, HTML templates/components, WebSocket RPC, testing, simple HTTP, and a tiny DB layer). The hook is that **classes are built from “slots”**, and **slots are objects** too.

If that sounds abstract, don’t worry. The payoff is concrete: a way to build applications where composition, extension, and instrumentation are “the default move”, without inventing a new language or compiler.

This post is aimed at a broad technical audience. You don’t need to know Simulabra to follow along.

---

## The One-Sentence Pitch

Simulabra is a metaobject protocol for JavaScript where:

- A *class* is an object built from a list of *slots*.
- A *slot* is an object that knows how to contribute state or behavior to a class.
- Multiple slots can contribute to the same method via built-in **method combination** (“before”, “after”, async variants, and a `next` call).

Once you internalize that, the rest of the ecosystem makes sense: reactive state and UI are slots; RPC and service boundaries preserve the “call methods on objects” style; tests discover and run themselves by asking modules for the objects they contain.

---

## A Quick Tour by Example

### Example 1: A class is a list of slots

Here’s the canonical “Point” example in Simulabra:

```js
import { __, base } from 'simulabra';

export default await async function (_, $) {
  $.Class.new({
    name: 'Point',
    doc: 'a 2d point',
    slots: [
      $.Var.new({ name: 'x', default: 0 }),
      $.Var.new({ name: 'y', default: 0 }),
      $.Method.new({
        name: 'dist',
        do(other) {
          return Math.sqrt((this.x() - other.x())**2 + (this.y() - other.y())**2);
        },
      }),
    ],
  });
}.module({
  name: 'example.point',
  imports: [base],
}).load();
```

What’s unusual isn’t the syntax—it’s the *values*:

- `$.Var.new(...)` produces a slot object that installs a per-instance variable accessor.
- `$.Method.new(...)` produces a slot object that installs a method.
- The class itself (`Point`) is also an object with slots and can be inspected.

“`x` is a var” is not just a declaration; it’s data you can manipulate.

### Example 2: Composition is built in (Before/After + `next`)

If you’ve used decorators, middleware, AOP, or CLOS method combinations, this will feel familiar.

Simulabra supports method modifiers that automatically wrap a method:

```js
$.Class.new({
  name: 'AuditedPoint',
  slots: [
    _.Point,
    $.Before.new({
      name: 'dist',
      do(other) { this.tlog('dist called'); }
    }),
  ],
});
```

And if you override a method, you can call the previous implementation with:

```js
this.next('dist', other);
```

This changes the default refactoring move. Instead of “copy/paste the method and add a conditional”, you often add a slot:

- add a `Before` slot to validate inputs
- add an `After` slot to record metrics
- add an override `Method` slot that calls `next` then post-processes

Small orthogonal behaviors compose cleanly.

### Example 3: Reactive state is a slot (`Signal` + `Effect`)

Simulabra includes a small fine-grained reactive system:

- `Signal` behaves like a variable accessor, but reads/writes participate in dependency tracking.
- `Effect` re-runs when the signals it read last time change.

```js
$.Class.new({
  name: 'Counter',
  slots: [
    $.Signal.new({ name: 'count', default: 0 }),
    $.Method.new({
      name: 'inc',
      do() { this.count(this.count() + 1); }
    }),
  ],
});
```

Now your app can be “objects + signals” rather than “objects + event bus + derived state glue”.

### Example 4: HTML templates that speak Signal

`simulabra/html` provides:

- `HTML.t` tagged templates (parsed/compiled once and cached)
- a `Component` base class
- automatic re-rendering via reactive effects

The key design choice: **reactive values are functions**.

```js
import html from 'simulabra/html';

$.Class.new({
  name: 'CounterView',
  slots: [
    $html.Component,
    _.Counter,
    $.Method.new({
      name: 'render',
      do() {
        return $html.HTML.t`<button onclick=${() => this.inc()}>
          clicked ${() => this.count()} times
        </button>`;
      }
    }),
  ],
});
```

If you’ve used React, think “fine-grained reactive values” rather than “re-render the world.” If you’ve used Solid/S.js, you’ll recognize the dependency-tracked updates.

### Example 5: Distributed objects via WebSocket RPC

`simulabra/live` lets you keep the “call methods on objects” mental model across process boundaries.

- A `NodeClient` connects to a WS server.
- `serviceProxy({ name })` returns a JS Proxy.
- Property access becomes an async RPC method call.

You end up writing:

```js
const db = await this.serviceProxy({ name: 'DatabaseService' });
const task = await db.createTask('buy groceries', 2);
```

It reads like OO. Under the hood, it’s a message protocol (`LiveMessage`) and an RPC handler.

---

## The Big Idea: Programmable Class Construction

In Simulabra, a “slot” is an object that participates in constructing a class:

- it can install behavior on the prototype
- it can validate initialization (e.g., required vars)
- it can participate in combination with other slots that share the same selector

This makes “extensibility” less about frameworks and more about your own object graph:

- need a cross-cutting concern? Add a slot.
- need a variant of a component? Compose slots.
- need to override behavior but preserve base semantics? Override and call `next`.

If you’ve ever wanted JavaScript to have a tame version of CLOS-style method combination, this is the point.

---

## What’s Included in the Box

Simulabra is intentionally small: each library is a few hundred lines, and they share the same object model.

### Core (`simulabra`)

The runtime defines:

- the class/slot system
- modules and registries (reflective scopes)
- method modifiers (`Before`/`After`, async variants)
- identity + introspection helpers (`title`, `uri`, `jsonify`, etc.)
- reactivity primitives (`Signal`, `Effect`, `Reactor`)
- mixins like `Clone`, `JSON`, `Configurable`, `History`
- a command abstraction (`Command`) for reified verbs

### HTML (`simulabra/html`)

A small component + template system with:

- parsed template caching
- reactive attributes/children via functions
- component instances driven by `Effect`

### Live (`simulabra/live`)

A minimal distributed-object layer:

- WebSocket node clients
- message handlers and dispatch
- RPC + response promises
- proxy objects that turn `obj.method(...)` into RPC calls

### Test + runner (`simulabra/test`)

Testing is object-oriented too:

- tests are objects (`Case`, `AsyncCase`)
- a runner loads modules and asks them for test instances
- there’s also a `BrowserCase` that uses Playwright

### HTTP (`simulabra/http`)

Simple server + handler objects, showing how composition (like logging) is done via slots.

### LLM (`simulabra/llm`)

An OpenAI-compatible completion client plus logprob parsing/normalization, built to support the Loom demo UX.

### DB (`simulabra/db`)

A small SQLite persistence mixin (`Persisted`) with typed slots (`DBVar`) and transform hooks.

---

## How to Think “the Simulabra Way”

If you’re coming from conventional JS/TS, the main shift is: **stop treating methods and fields as declarations** and start treating them as **objects you can compose**.

Some practical heuristics:

- If you find yourself writing “utility functions”, consider whether you actually have a concept that deserves a class.
- If you want to add logging/validation/metrics, reach for `Before`/`After` rather than editing the method body.
- Use `Signal` for state that drives UI or derived behavior; use `Var` for inert state.
- Keep boundaries explicit using modules and imports; resist turning everything into global singletons.

Simulabra doesn’t ban functional programming—it just nudges you toward **reified concepts**: things with names, slots, and inspectable structure.

---

## Why You Might Want This

Simulabra is attractive if you want:

- a strongly *compositional* OO style in JavaScript
- builtin method combination without macros or decorators
- a unified mental model across in-process code, UI, and service graphs
- introspection and tooling that works because structure is data

It’s probably not the tool for you if you want:

- maximal TypeScript ergonomics (Simulabra is dynamic by design)
- a huge ecosystem of third-party components
- a framework that disappears into conventions rather than explicit object graphs

---

## Where to Start (in this repo)

If you want to learn it by reading real code:

- `README.md` for the quick overview
- `tests/core.js` for the object model and method combination in action
- `tests/modules.js` for how modules compose across imports
- `tests/html.js` for the reactive template model
- `src/live.js` and `apps/agenda/` for service-style distributed objects
- `demos/loom.js` for a large end-to-end composition of HTML + LLM + configuration

---

## Closing Thought

Simulabra isn’t trying to make JavaScript “more like Java.” It’s trying to make JavaScript “more like itself” by leaning into runtime reflection and treating structure as data.

Once you start seeing “a class is an object made of slot objects,” refactoring stops being a hunt for the right pattern and starts being a question you can ask directly:

What object should exist here?

