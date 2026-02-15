# Simulabra Core Modules (src/): Docstrings, Purpose, Responsibilities

Generated on 2026-01-30.

Scope:
- Included: `src/*.js` modules (`base.js`, `db.js`, `html.js`, `http.js`, `live.js`, `llm.js`, `logs.js`, `pm.js`, `runner.js`, `test.js`, `time.js`, `tools.js`)
- Excluded: non-JS assets (`src/index.html`, `src/style.css`, `src/module_template.html`)

Docstring conventions used below:
- Class docstrings name the *kind of thing* and the *world it creates* (slots, lookup, reactivity, persistence).
- Method docstrings describe the *message you send* and what it *changes* (state, time, IO, other objects).
- Prefer intention over mechanics: “why you’d send this message” beats “returns a value”.
- When a slot creates a callable accessor (`Var`, `Property`, `Signal`, etc.), it’s documented under **Slots (accessors)** because it becomes part of the public message surface.

---

## `src/base.js` — Simulabra Core Runtime + Metaobject System

### Global Bootstrap: `SIMULABRA` (global root object)

Purpose:
- Provide a stable global root (`globalThis.SIMULABRA`) with helpers and mutable runtime state (current module, registry, reactor, debug).

Key methods (non-class, on the global root):
- `mod()` — Purpose: return the current module.
  - Suggested docstring: `Where you are: the current module (names resolve here).`





- `stack()` — Purpose: return the current call stack container (debug tracing).
  - Suggested docstring: `A breadcrumb trail of message sends, for when debugging wants a story.`





- `display(obj)` — Purpose: stringify for display/logging (string passthrough, otherwise Simulabra stringify).
  - Suggested docstring: `Make a value speak in a human voice (strings passthrough; objects use Simulabra display).`





- `stringify(obj, seen = new Set())` — Purpose: safe-ish stringification with cycle detection and Simulabra protocol hooks (`description()`).
  - Suggested docstring: `Simulabra’s voice for values: cycle-safe, and respects description().`






---

### Internal JS helper class: `Frame`

Purpose:
- Represent a single method call for debugging/tracing.

Methods:
- `constructor(receiver, methodImpl, args)` — stores receiver, SlotImpl-like method impl, and args.
  - Suggested docstring: `A trace frame for a message send (receiver, impl, args).`





- `description()` — produces a human-readable call string.
  - Suggested docstring: `A short display string for this call frame.`






---

### Internal JS helper class: `FrameStack`

Purpose:
- Maintain a stack of `Frame` objects for debug tracing.

Methods:
- `constructor()` — initialize stack.
  - Suggested docstring: `An empty frame stack.`





- `push(frame)` — push and return `this`.
  - Suggested docstring: `Push a frame and return this stack.`





- `pop()` — pop and return top frame.
  - Suggested docstring: `Pop and return the top frame.`





- `idx()` — return index of top frame (`length - 1`).
  - Suggested docstring: `The index of the top frame.`





- `frame()` — return current top frame.
  - Suggested docstring: `The top frame (or undefined if empty).`





- `trace()` — log frames via `debug(...)`.
  - Suggested docstring: `Log the current stack frames for debugging.`





- `description()` — display hook.
  - Suggested docstring: `A display name for this stack.`






---

### Internal JS helper class: `SlotImpl`

Purpose:
- Hold a reified “slot implementation” (primary function + modifiers) and install it onto a prototype.

Responsibilities:
- Combine multiple slot operations (methods, modifiers) into a single callable JS function.
- Support before/after and async-before/async-after modifiers.
- Integrate with debug tracing/stack recording.

Methods:
- `constructor(props)` — initialize implementation fields (`__primary`, modifiers, properties, debug flags).
  - Suggested docstring: `A slot implementation bundle (primary fn + modifiers + reification options).`





- `reify(proto)` — install the effective method onto `proto`.
  - Suggested docstring: `Reify this impl onto a prototype (wraps primary with modifiers and optional debug tracing).`






---

### Internal JS helper class: `ClassPrototype`

Purpose:
- Provide the implementation storage for a Simulabra class’ prototype (`_impls` + reified `_proto`).

Responsibilities:
- Accumulate slot operations keyed by name and lazily create `SlotImpl`s.
- Reify all accumulated slots onto the underlying JS prototype object.

Methods:
- `constructor(parent)` — create new proto container and set `__class` reference.
  - Suggested docstring: `A prototype container for a Simulabra class (impls + reified proto).`





- `_reify()` — reify all slot impls.
  - Suggested docstring: `Reify all accumulated slot implementations onto the backing prototype.`





- `_add(name, op)` — combine a slot operation into the named impl.
  - Suggested docstring: `Combine a slot operation into the implementation for a given selector name.`





- `_getImpl(name)` — get or create `SlotImpl` for name.
  - Suggested docstring: `Get (or create) the SlotImpl for a selector name.`





- `description()` — display hook.
  - Suggested docstring: `A display string for this class prototype container.`






---

### Bootstrap slot: `BVar`

Purpose:
- Minimal “Var-like” slot used to bootstrap `$.Var` itself.

Responsibilities:
- Reify a method-based accessor onto instances (`obj.varName()`).
- Provide default value behavior and state listing integration.

Methods:
- `constructor({ name, ...desc })` — capture slot name and descriptor.
  - Suggested docstring: `A bootstrap Var slot descriptor (used before $.Var exists).`





- `get name()` — accessor name.
  - Suggested docstring: `This slot’s name.`





- `static new(args)` — constructor helper.
  - Suggested docstring: `A new slot instance (Simulabra convention).`





- `static descended(other)` — treat `BVar` and `$.Var` as compatible.
  - Suggested docstring: `Whether other is BVar/Var (bootstrap compatibility).`





- `state()` — return `$FakeState` list describing this slot.
  - Suggested docstring: `Display state entries describing this slot.`





- `load(proto)` — attach accessor method and JS property alias (`_name`).
  - Suggested docstring: `Reify this slot onto a class prototype (method + _property alias).`





- `defval()` — compute default value (function or literal).
  - Suggested docstring: `The default value for this slot.`





- `class()` — return `BVar` class identity (bootstrap style).
  - Suggested docstring: `The slot’s class identity (bootstrap).`





- `debug()` — debug flag.
  - Suggested docstring: `Whether this slot is debug-visible.`





- `description()` — display hook.
  - Suggested docstring: `A display string for this slot.`





- `isa(it)` — type check.
  - Suggested docstring: `Whether the provided class is BVar.`





- `initInstance(inst)` — hook for initialization (no-op in bootstrap).
  - Suggested docstring: `Bootstrap hook: this slot on an instance (bootstrap no-op).`






---

### Bootstrap slot: `BProperty`

Purpose:
- Minimal “Property-like” slot used to bootstrap `$.Property` itself.

Responsibilities:
- Reify a JS getter/setter property onto instances rather than a method accessor.

Methods:
- `constructor({ name, ...desc })`, `get name()`, `static new(args)`, `static descended(other)`, `state()`, `defval()`, `class()`, `debug()`, `description()`, `isa(it)`, `initInstance(inst)` — analogous to `BVar` but for properties.
  - Suggested class docstring: `Where a class keeps its slots before they become JavaScript methods.`





- `load(proto)` — define a JS property with default initialization.
  - Suggested docstring: `Reify this property slot onto a prototype via JS getter/setter with defaults.`





- `title()` — display title.
  - Suggested docstring: `A short title string for this property slot.`






---

### Built-in prototype extensions (native JS types)

Purpose:
- Make native JS values participate in the Simulabra slot/method composition protocol during bootstrap.

Extensions to `Function.prototype`:
- `load(proto)` — allow plain functions in `slots: [...]` arrays to add themselves as methods.
  - Suggested docstring: `Load this function as a method slot onto a ClassPrototype by name.`





- `combine(impl)` — set SlotImpl primary implementation.
  - Suggested docstring: `Combine this function into SlotImpl as the primary implementation.`





- `description()` — display hook.
  - Suggested docstring: `A display string for this function.`





- `overrides()` — indicate override intent (always true for functions).
  - Suggested docstring: `True: functions act as overriding method implementations by default.`





- `class()` / `isa(it)` / `uri()` / `title()` / `state()` — minimal Simulabra protocol surface for native functions.
  - Suggested docstring: `Provide minimal Simulabra protocol behavior for native functions during bootstrap.`






Extensions to `Number.prototype`:
- `description()` — numeric string conversion.
  - Suggested docstring: `A display string for this number.`






Extensions to `Array.prototype`:
- `description(seen)` — format elements via `SIMULABRA.stringify`.
  - Suggested docstring: `A display string for this array using Simulabra stringify for elements.`





- `load(target)` — load each element as a slot into target (slot composition helper).
  - Suggested docstring: `Load each element in this array into the given target.`






---

### Root instance protocol: `$BaseSlots` (methods on all Simulabra objects)

Purpose:
- Define the universal object protocol (initialization, identity, logging, serialization, message send).

Methods:
- `init()` — register instance in current module; initialize “fullSlot” slots.
  - Suggested docstring: `The moment an instance joins a module: register it, then let full slots initialize.`





- `description(seen)` — human-readable representation (currently `jsonify()` JSON pretty print).
  - Suggested docstring: `A human-readable description (defaults to pretty JSON via jsonify()).`





- `toString()` — delegate to `description()`.
  - Suggested docstring: `String conversion delegates to description().`





- `state()` — return `$VarState` list for set vars.
  - Suggested docstring: `State entries for vars that have been set on this instance.`





- `me()` — identity.
  - Suggested docstring: `Self (useful in fluent or meta contexts).`





- `uid()` — stable-ish display identity (name or id).
  - Suggested docstring: `A stable-ish identity string (name if present, else id).`





- `title()` — display title combining class and uid.
  - Suggested docstring: `A human title combining class name and uid.`





- `ident()` — id plus optional name.
  - Suggested docstring: `An identifier string including id and optional name.`





- `uri()` — canonical URI form.
  - Suggested docstring: `A stable address for this instance inside the Simulabra world (simulabra:// URI).`





- `jsonify()` — delegate to class `jsonify`.
  - Suggested docstring: `Ask the class to turn this instance into plain data.`





- `log(...args)` — debug logging with titles and `SIMULABRA.stringify`.
  - Suggested docstring: `Speak through Debug: prefix with title and stringify args in the Simulabra voice.`





- `tlog(...args)` — timestamped log.
  - Suggested docstring: `Timestamped log with instance title.`





- `dlog(...args)` — conditional log gated by class debug.
  - Suggested docstring: `Debug log only when debugging is enabled for this class.`





- `load(proto)` — allow function slot protocol to add itself to proto.
  - Suggested docstring: `Let this slot attach itself to a class prototype (so the message exists).`





- `isa(cls)` — instance-of in Simulabra terms (via class descended).
  - Suggested docstring: `Whether this instance’s class descends from cls.`





- `next(selector, ...args)` — call overridden “next” method in chain.
  - Suggested docstring: `Call the next method in an override chain (the one you replaced).`





- `class()` — class accessor (via `ClassDef.class`).
  - Suggested docstring: `The class that minted this instance (its bundle of slots).`






Slots (accessors):
- `name` (property, via `BProperty`) — optional human name.
  - Suggested docstring: `Optional human-friendly name for display/lookup.`





- `id` (var, via `BVar`) — numeric instance id.
  - Suggested docstring: `Unique id within the defining class (monotonic counter).`






---

### Meta-class: `$Class` (Simulabra classes are instances of `$Class`)

Purpose:
- Represent and construct Simulabra classes; manage slot composition and reification.

Responsibilities:
- Own the `ClassPrototype` (`proto`) into which slot implementations are loaded and reified.
- Construct new instances via `new(props, ...slots)` with parameterization.
- Provide introspection over slots, vars, superclasses, and instances.
- Provide JSON serialization policy for instances (`jsonify`).

Methods:
- `init()` — bootstrap class instance setup (proto, slots, reification, module association).
  - Suggested docstring: `Birth a class: build its proto, load slots, and reify messages into JS methods.`





- `load(target)` — load all slots into a prototype-like target.
  - Suggested docstring: `Reify this class’s slots onto a target prototype container (make the messages real).`





- `extend(comp)` — load a component/mixin and reify.
  - Suggested docstring: `Extend this class by loading additional slots and reifying the prototype.`





- `initInstance(inst)` — run `initInstance` for full slots.
  - Suggested docstring: `An instance by running init hooks for full-slot slots.`





- `modref()` — compute module prefix for display.
  - Suggested docstring: `Display module reference ($ for base; otherwise module name).`





- `description()` / `toString()` — display.
  - Suggested docstring: `Display string for this class (module-qualified).`





- `descended(target)` — inheritance test through superclass slots.
  - Suggested docstring: `Whether this class is or inherits from target.`





- `title()` — display title.
  - Suggested docstring: `A display title for this class.`





- `instances()` — gather instances across loaded modules.
  - Suggested docstring: `Currently registered instances of this class across modules.`





- `superClasses()` — list superclass slots (depth-first-ish).
  - Suggested docstring: `All superclasses declared via Class slots.`





- `allSlots()` — slots including inherited/mixed-in.
  - Suggested docstring: `All slots, including those inherited from superclasses.`





- `proxied(ctx)` — proxy hook (currently identity).
  - Suggested docstring: `A proxy-wrapped class for a given context (default identity).`





- `vars(visited = new Set())` — collect var-like slots recursively.
  - Suggested docstring: `All Var-like slots declared on this class and its superclasses.`





- `genid()` — generate new id using `id_ctr`.
  - Suggested docstring: `Generate the next instance id for this class.`





- `jsonify(object)` — compute JSON for an instance with serialization policy.
  - Suggested docstring: `Serialize an instance to a JSON-ready object using Var slots and policies.`





- `getslot(name)` — search slot by name through class hierarchy.
  - Suggested docstring: `Find a slot definition by name, searching superclasses as needed.`





- `new(props = {}, ...slots)` — construct instance, parameterize, assign id, init.
  - Suggested docstring: `A new instance, parameterize vars, assign id, and run init.`






Slots (accessors):
- `name` — class name.
  - Suggested docstring: `Name of this class (used for registry and display).`





- `mod` — owning module.
  - Suggested docstring: `Module that defined/owns this class.`





- `fullSlot` — whether slot needs `initInstance` handling.
  - Suggested docstring: `Whether this slot participates in per-instance init hooks.`





- `proto` — `ClassPrototype` container.
  - Suggested docstring: `Backing prototype container holding slot impls and reified JS proto.`





- `id_ctr` — numeric id counter.
  - Suggested docstring: `Monotonic counter used to assign instance ids.`





- `slots` — slot list for composition.
  - Suggested docstring: `Slot list for this class (mixins, vars, methods, modifiers).`






---

### Slot class: `Var`

Purpose:
- Define a method-style slot accessor `obj.slotName([value])` with defaulting, required checks, and debug/trace controls.

Responsibilities:
- Reify a direct accessor function (fast path) into the `SlotImpl`.
- Provide `defval(ctx)` for default computation and `initInstance` validation.

Suggested class docstring:
- `A pocket of state you access by sending a message; defaults and requiredness are part of the bargain.`






Methods:
- `defval(ctx)` — compute default value (function called with ctx) or literal.
  - Suggested docstring: `The default value for this var (call default function in ctx when provided).`





- `should_debug()` — effective debug flag (slot debug OR global debug).
  - Suggested docstring: `Whether this var should be debug-visible (slot debug or global debug).`





- `combine(impl)` — install accessor `varAccess` into `SlotImpl` and enable property aliasing.
  - Suggested docstring: `Combine into SlotImpl by installing a direct accessor (get/set with defaulting).`





- `initInstance(inst)` — enforce required vars.
  - Suggested docstring: `Validate required vars are present on instance initialization.`






Slots (accessors):
- `name`, `doc`, `debug`, `trace`, `default`, `default_init`, `required`
  - Suggested docstrings:
    - `name`: `Accessor name for this slot.`





    - `doc`: `Human docstring for this slot.`





    - `debug`: `Whether to expose this slot’s value in debug displays/state.`





    - `trace`: `Whether to trace accesses (reserved / future use).`





    - `default`: `Default value or thunk used when the slot is first read.`





    - `default_init`: `Whether to initialize defaults eagerly (reserved / future use).`





    - `required`: `Whether this slot must be provided at construction time.`






---

### Slot class: `Property`

Purpose:
- Define a JS getter/setter property on instances with defaulting and required checks (instead of method-accessor).

Suggested class docstring:
- `State that feels native: reifies as a JS getter/setter instead of a message send.`






Methods:
- `defval(ctx)` — compute default value.
  - Suggested docstring: `The default value for this property (call default function in ctx when provided).`





- `should_debug()` — effective debug flag.
  - Suggested docstring: `Whether this property should be debug-visible.`





- `load(proto)` — define property descriptor on the JS prototype.
  - Suggested docstring: `Reify this property onto a prototype via JS property descriptor.`





- `initInstance(inst)` — enforce required properties.
  - Suggested docstring: `Validate required properties are present on instance initialization.`






Slots (accessors):
- Same as `Var` (`name`, `doc`, `debug`, `trace`, `default`, `default_init`, `required`).

---

### Slot class: `Fn`

Purpose:
- Wrap a function body as data (`do`) so slots can accept either native functions or function-wrappers.

Suggested class docstring:
- `Slot wrapper around a function body (stored in do).`






Slots (accessors):
- `do` — underlying function body.
  - Suggested docstring: `The underlying function body for this slot.`






---

### Slot class: `Method`

Purpose:
- Define a method slot with override chaining (`next`) and debug stack tracking.

Responsibilities:
- On `combine`, chain overrides by setting `fn._next` to prior primary.
- Set impl debug behavior to the slot’s `debug` flag.

Suggested class docstring:
- `Behavior as a slot: supports overrides and next() chaining, with optional debug tracing.`






Methods:
- `combine(impl)` — install method body and chain `_next`.
  - Suggested docstring: `Combine into SlotImpl: install method body and link overrides via _next.`






Slots (accessors):
- `name` (Property), `doc` (Var), `debug` (Var), `do` (via `Fn`).
  - Suggested docstrings:
    - `name`: `Selector name of the method.`





    - `doc`: `Docstring for the method.`





    - `debug`: `Whether this method participates in debug stack tracking.`






---

### Slot class: `Static`

Purpose:
- Define a static method slot reified onto the class object (not instances).

Suggested class docstring:
- `A message that lives on the class itself (not on instances).`






Methods:
- `load(proto)` — reify the static method onto the class object.
  - Suggested docstring: `Reify this static method onto the class object during class load.`






Slots (accessors):
- `doc` and `do` (via `Fn`).
  - Suggested docstring for `doc`: `Docstring for the static method.`

---

### Slot classes: `Before`, `After`, `AsyncBefore`, `AsyncAfter`

Purpose:
- Provide modifier slots that wrap `Method` behavior by injecting before/after hooks (sync or async).

Suggested class docstrings:
- `Before`: `Method modifier that runs before the primary method body.`





- `After`: `Method modifier that runs after the primary method body.`





- `AsyncBefore`: `Async method modifier awaited before the primary method body.`





- `AsyncAfter`: `Async method modifier awaited after the primary method body.`






Methods:
- `combine(impl)` — attach hook to impl modifier list.
  - Suggested docstring: `Attach this modifier’s function to the SlotImpl modifier chain.`






Slots (accessors):
- `name` (Property) — target selector.
  - Suggested docstring: `Target method selector name to modify.`





- `doc` — modifier docstring.
  - Suggested docstring: `Docstring describing the modification.`





- `do` (via `Fn`) — hook body.
  - Suggested docstring: `Hook body to run as part of method execution.`






---

### Slot class: `Virtual`

Purpose:
- Define a method slot that must be implemented by some later composition (raises if called).

Suggested class docstring:
- `A promised promise: a message name that must be made real by someone else.`






Methods:
- `load(parent)` — installs throwing stub and marks it `virtual`.
  - Suggested docstring: `Install a throwing stub method onto parent prototype and mark it virtual.`





- `overrides()` — returns false to prevent override chaining assumptions.
  - Suggested docstring: `False: virtual slots are declarations, not overrides.`






Slots (accessors):
- `name`, `doc`.
  - Suggested docstring for `doc`: `Docstring describing the required implementation.`

---

### Data utility class: `FakeState`

Purpose:
- Provide a simple name/value record for display lists.

Suggested class docstring:
- `Simple (name, value) record used for state listing and display.`






Methods:
- `listFromMap(map)` (Static) — build list from `{k:v}`.
  - Suggested docstring: `Build a list of FakeState entries from a plain object map.`





- `kv()` — return `[name, value]`.
  - Suggested docstring: `A (name, value) pair.`





- `description(seen)` — formatted `:name=value`.
  - Suggested docstring: `Display description for this entry (respects title() when available).`






Slots (accessors):
- `value` — stored value.
  - Suggested docstring: `Value associated with this state entry.`






---

### Data utility class: `VarState`

Purpose:
- Represent a `(ref, value)` pair for a Var slot on an instance.

Suggested class docstring:
- `State entry pairing a Var slot reference with its current value.`






Methods:
- `kv()` — return `[ref.name, value]`.
  - Suggested docstring: `A (slotName, value) pair for this state entry.`





- `description(seen)` — formatted `:slot=value` and hides when `ref.debug()` is false.
  - Suggested docstring: `Display description, optionally hiding values for non-debug vars.`






Slots (accessors):
- `ref` — Var slot reference.
  - Suggested docstring: `Var slot descriptor for this state entry.`





- `value` — current value.
  - Suggested docstring: `Current value of the var on the instance.`






---

### Runtime support class: `ObjectRegistry`

Purpose:
- Track instances by URI using `WeakRef`, and provide class-based instance enumeration.

Suggested class docstring:
- `WeakRef-backed registry of instances by URI, with per-class instance lists.`






Methods:
- `register(o)` — store WeakRef and add to per-class lists (including superclasses).
  - Suggested docstring: `Register an object by URI and record it under its class and superclasses.`





- `deref(u)` — deref stored WeakRef for URI.
  - Suggested docstring: `Resolve a URI to a live object if still reachable.`





- `addInstance(obj)` — add `obj.uri()` to `classInstances` for class + superclasses.
  - Suggested docstring: `Record an object URI under its class and all superclasses.`





- `instances(cls)` — list live instances for a class.
  - Suggested docstring: `Live instances of a class by dereferencing stored URIs.`






Slots (accessors):
- `classInstances` — map className -> array of URIs.
  - Suggested docstring: `Map from class name to list of registered instance URIs.`





- `refs` — map URI -> WeakRef.
  - Suggested docstring: `Map from instance URI to WeakRef(instance).`






---

### Mixins: `Deffed` and `registered`

Purpose:
- Provide common post-init behavior for defining in-module names and/or registering instances.

Suggested class docstrings:
- `Deffed`: `Mixin that defines instances in the current module after init (name -> instance).`





- `registered`: `Mixin that registers instances in the current module after init (instance tracking).`






Behavior:
- Both are implemented via `After('init', ...)` modifiers.
  - Suggested docstring for the `After` on `init`: `After init, publish/register this instance in the current module.`

---

### Module class: `Module`

Purpose:
- Represent a module namespace containing class definitions, imports, instance registry, and lookup mechanisms.

Responsibilities:
- Provide name-based lookup (`find`) across imports.
- Provide class proxy views for convenient access (`module.$()` / `module.proxy('Class')`).
- Provide instance enumeration and registry-based tracking.
- Load and run the module initializer only once (`load`).

Suggested class docstring:
- `A small world: imports, name lookup, and an instance registry (the unit of composition).`






Methods:
- `instances(cls)` — return instances in this module + parent module.
  - Suggested docstring: `Registered instances of cls from this module and its parent.`





- `getInstance(cls, nameOrId)` — find instance by id or name.
  - Suggested docstring: `Find an instance by id or name among this module’s instances.`





- `register(obj)` — register in module registry.
  - Suggested docstring: `Register an object in this module’s registry.`





- `repo(ClassName)` — return name->object map for ClassName.
  - Suggested docstring: `The name->object repo map for a given ClassName.`





- `find(ClassName, name)` — lookup in local repo then imports (recursively).
  - Suggested docstring: `Find a named object in this module or imports (recursive; beware cycles).`





- `proxy(ClassName, errFn)` — JS Proxy that resolves properties via `find`.
  - Suggested docstring: `A Proxy that resolves missing properties via find(ClassName, prop).`





- `def(name, obj)` — define object in repo and record in `classes`.
  - Suggested docstring: `Name an object in this module’s world so it can be found through lookups and proxies.`





- `load()` — run module initializer under this module context; set loaded.
  - Suggested docstring: `Wake the module once: run its initializer inside its own namespace, then restore the prior module.`





- `$()` — convenience for `proxy('Class')`.
  - Suggested docstring: `A Class proxy for this module (property lookup by class name).`






Slots (accessors):
- `name`, `imports`, `mod`, `registry`, `parent`, `doc`, `loaded`, `repos`, `classes`
  - Suggested docstrings:
    - `imports`: `Modules imported and available for lookup within this module.`





    - `mod`: `Module initializer function.`





    - `registry`: `ObjectRegistry used to register instances created under this module.`





    - `parent`: `Parent module for fallback lookups / instance aggregation.`





    - `repos`: `Map from className -> (name -> object) defined in this module.`





    - `classes`: `List of all defined objects/classes in this module (for enumeration).`






---

### Class: `StaticVar`

Purpose:
- Provide a `Var` slot whose accessor is reified onto the class object (static var accessor).

Suggested class docstring:
- `Var slot that reifies to a static accessor on the class object.`






Behavior:
- After `load`, it reifies its accessor onto the class object.
  - Suggested docstring for `After('load')`: `After class load, reify this var accessor as a static method.`

---

### Class: `SimulabraGlobal`

Purpose:
- Global system root storing module state, registry, reactor, and utilities.

Suggested class docstring:
- `Global runtime root (current module, registry, reactor, and helper utilities).`






Slots (accessors):
- `mod`, `modules`, `stack`, `debug`, `trace`, `tick`, `handlers`, `registry`, `reactor`
  - Suggested docstrings:
    - `modules`: `Registry of modules by name (for reuse/lookup).`





    - `tick`: `Global tick counter (driven by startTicking).`





    - `handlers`: `Global handlers map (reserved / integration point).`






Methods:
- `startTicking()` — periodic tick update.
  - Suggested docstring: `Start a 60Hz-ish tick increment loop for reactive/time-based systems.`





- `jsNew(ClassName, ...args)` — construct native JS class by global name.
  - Suggested docstring: `A native JS object by global class name.`





- `jsGet(obj, p)` — generic property get.
  - Suggested docstring: `Get a property from a native object by key.`





- `$()` — current module class proxy.
  - Suggested docstring: `A Class proxy for the current module.`





- `base()` — return base module.
  - Suggested docstring: `The base module (core system).`





- `register(o)` — register in global registry.
  - Suggested docstring: `Register an object in the global registry.`





- `tryCall(obj, missingFn)` — proxy that calls existing methods or fallback.
  - Suggested docstring: `A proxy that dispatches to obj methods when present, else calls missingFn.`





- `instanceOf(obj, cls)` — Simulabra instance predicate.
  - Suggested docstring: `Whether obj is a Simulabra instance descended from cls.`





- `sleep(ms)` — promise-based delay.
  - Suggested docstring: `Sleep for ms milliseconds (Promise).`






---

### Reactive runtime: `Reactor`, `Effect`, `Signal`

#### Class: `Reactor`

Purpose:
- Track reactive dependencies and batch effect reruns via microtasks.

Suggested class docstring:
- `The heartbeat of reactivity: tracks dependencies and batches effect reruns.`






Slots (accessors):
- `stack` — stack of dependency sets.
  - Suggested docstring: `Stack of dependency sets corresponding to currently running effects.`





- `pending` — set of pending subscriber callbacks.
  - Suggested docstring: `Set of subscriber callbacks pending execution in the next microtask batch.`





- `batched` — whether a flush is scheduled.
  - Suggested docstring: `Whether a microtask batch has been scheduled.`






Methods:
- `push(dep)` — register current dependency set with active effect.
  - Suggested docstring: `Record “I depend on this”: add a dependency set to the currently running effect.`





- `flush()` — await a microtask.
  - Suggested docstring: `Let the microtasks run (useful when you want the reactor to catch up).`





- `schedule(task)` — schedule callback(s) with microtask batching.
  - Suggested docstring: `Wake effects, but gently: batch callbacks into a single microtask turn.`






#### Class: `Effect`

Purpose:
- Represent a reactive effect that reruns when any subscribed dependency changes.

Suggested class docstring:
- `A little spell: run it once, it remembers what it read, and reruns when those signals change.`






Slots (accessors):
- `fn` — function returning the effect body (note: stored as a thunk in current code).
  - Suggested docstring: `Effect thunk: invoked to run reactive reads and register dependencies.`





- `deps` — set of dependency subscriber sets.
  - Suggested docstring: `Current dependency sets this effect is subscribed to.`





- `active` — enabled flag.
  - Suggested docstring: `Whether this effect is active and should run.`





- `boundRun` — cached bound `run` for stable subscription identity.
  - Suggested docstring: `Cached bound run callback used for subscribing/unsubscribing.`






Methods:
- `run()` — execute effect and update subscriptions.
  - Suggested docstring: `Run the effect and re-learn its dependencies (unsubscribe old, subscribe new).`





- `dispose()` — deactivate effect and unsubscribe.
  - Suggested docstring: `Let the effect go quiet: deactivate it and unsubscribe from everything it touched.`





- `create(fn)` (Static) — create and run.
  - Suggested docstring: `Turn fn into a living effect and run it immediately.`






#### Class: `Signal`

Purpose:
- Provide a reactive `Var` accessor that tracks subscribers and schedules reruns on writes.

Suggested class docstring:
- `A Var that participates in reactivity: reads subscribe, writes wake effects.`






Methods:
- `combine(impl)` — install reactive accessor backed by `SUBMAP`.
  - Suggested docstring: `Turn this slot into a signal: reads subscribe, writes notify.`






---

### Slot specialization: `EnumVar`

Purpose:
- Restrict a var accessor to a fixed set of allowed values.

Suggested class docstring:
- `A Var that participates in reactivity: reads subscribe, writes wake effects.`






Slots (accessors):
- `choices` — list of allowed values.
  - Suggested docstring: `Allowed values for this enum var.`






Methods:
- `combine(impl)` — enforce choices on set.
  - Suggested docstring: `Install an accessor that validates assigned values against choices.`





- `defval(ctx)` — validate default value.
  - Suggested docstring: `The default value, validating it is one of the allowed choices.`





- `After('init')` — validate `default` at slot init time.
  - Suggested docstring: `Validate the configured default is included in choices.`






---

### Config system: `ConfigSlot`, `ConfigVar`, `ConfigSignal`, `Configurable`

Purpose:
- Provide opt-in serialization/deserialization of specific slot values as “config”.

Suggested class docstrings:
- `ConfigSlot`: `Marker mixin for slots included in config serialization.`





- `ConfigVar`: `Var slot marked as ConfigSlot for config serialization.`





- `ConfigSignal`: `Signal slot marked as ConfigSlot for config serialization.`





- `Configurable`: `Mixin providing configSlots/configJSON/configLoad for ConfigSlot-based config IO.`






Methods (`Configurable`):
- `configSlots()` — list slots that `isa(ConfigSlot)`.
  - Suggested docstring: `All slots on this class marked as ConfigSlot.`





- `configJSON()` — serialize config slot values to plain object.
  - Suggested docstring: `Serialize ConfigSlot values into a JSON-ready plain object.`





- `configLoad(data)` — load values from object.
  - Suggested docstring: `Load ConfigSlot values from a plain object, setting matching keys.`






---

### History system: `HistorySlot`, `HistorySignal`, `History`

Purpose:
- Provide undo/redo snapshots for selected reactive slots.

Suggested class docstrings:
- `HistorySlot`: `Marker mixin for slots included in history snapshots.`





- `HistorySignal`: `Signal slot marked as HistorySlot for snapshot tracking.`





- `History`: `Mixin implementing undo/redo stacks using snapshots of HistorySlot values.`






Methods (`History`):
- `historySlots()` — list HistorySlot-marked slots.
  - Suggested docstring: `All slots on this class marked as HistorySlot.`





- `snapshot()` — capture current values (arrays shallow-copied).
  - Suggested docstring: `Capture a snapshot of current HistorySlot values (shallow copy arrays).`





- `restoreSnapshot(snap)` — set slots from snapshot.
  - Suggested docstring: `Restore HistorySlot values from a snapshot object.`





- `pushUndo()` — push snapshot and clear redo.
  - Suggested docstring: `Push current snapshot onto undo stack and clear redo stack.`





- `undo()` / `redo()` — restore previous/next snapshots.
  - Suggested docstring: `Undo/redo using snapshot stacks; returns false when unavailable.`





- `canUndo()` / `canRedo()` — availability.
  - Suggested docstring: `Whether undo/redo is available.`





- `clearHistory()` — clear both stacks.
  - Suggested docstring: `Clear undo and redo stacks.`






---

### Utility slot: `Constant`

Purpose:
- Define a read-only accessor that always returns the slot’s configured value.

Suggested class docstring:
- `A Var that participates in reactivity: reads subscribe, writes wake effects.`






Methods:
- `combine(impl)` — install constant-returning accessor.
  - Suggested docstring: `Install a direct accessor that always returns the configured constant value.`






Slots (accessors):
- `value` — constant value.
  - Suggested docstring: `Constant value returned by this slot accessor.`





- `doc` — documentation.
  - Suggested docstring: `Docstring for the constant slot.`






---

### Commands: `Command`, `CommandContext`, `CommandChild`

Purpose:
- Provide a “command slot” pattern that creates a context object and dispatches command execution through a parent.

Suggested class docstrings:
- `Command`: `Slot that builds a CommandContext and dispatches execution through parent.runcommand(ctx).`





- `CommandContext`: `Context object representing a command invocation (command, parent, args).`





- `CommandChild`: `Marker mixin for command-related child objects (for typing/introspection).`






Methods:
- `Command.load(parent)` — reify `fooCommand(...)` builder and `foo(...)` convenience dispatcher.
  - Suggested docstring: `Reify command builder and dispatcher methods onto parent prototype.`





- `CommandContext.run()` — call `parent.runcommand(this)`.
  - Suggested docstring: `Dispatch this command invocation via parent.runcommand(ctx).`






Slots (accessors):
- `Command.run` — handler.
  - Suggested docstring: `Handler that executes this command (called by runcommand).`





- `CommandContext.command`, `parent`, `args` — context.
  - Suggested docstrings:
    - `command`: `Command slot definition for this invocation.`





    - `parent`: `Parent object that will execute the command.`





    - `args`: `Argument list provided to the command invocation.`






---

### Mixins: `Clone`, `JSON`

Purpose:
- Provide reusable behaviors for cloning and JSON serialization.

Suggested class docstrings:
- `Clone`: `Mixin providing clone(deep=true) by copying var slot values (supports cycles).`





- `JSON`: `Mixin providing json() serialization for slot values (uses slot definitions).`






Methods:
- `clone(deep = true, cloneMap = new WeakMap())` — clone by var slots, with cycle map.
  - Suggested docstring: `Clone this instance by copying non-default var slot values (optionally deep, cycle-safe).`





- `json()` — serialize instance `__*` fields using slot definitions and nested json/uri.
  - Suggested docstring: `Serialize instance slot values to a JSON-ready object (respects json()/uri() on values).`






---

### Debug helper class: `Debug`

Purpose:
- Provide a centralized location for console logging and formatting decisions.

Suggested class docstring:
- `A Var that participates in reactivity: reads subscribe, writes wake effects.`






Methods:
- `log(...args)` (Static) — direct console logging.
  - Suggested docstring: `Log raw arguments to console and return Debug.`





- `format(...args)` (Static) — format via `SIMULABRA.display`.
  - Suggested docstring: `Format values for display using Simulabra display rules.`






---

## `src/tools.js` — Tool Abstractions for LLM Calls

### Class: `Tool`

Purpose:
- Standardize LLM-callable tools: metadata (name/docs/schema) + an execution interface.

Responsibilities:
- Provide an API-facing “tool definition” format.
- Define an abstract `execute` contract.

Suggested class docstring:
- `A contract between your system and an LLM: name, schema, and an execute() boundary.`






Slots (accessors):
- `toolName` — tool identifier.
  - Suggested docstring: `Tool identifier used in tool-call dispatch.`





- `doc` — user-visible description.
  - Suggested docstring: `Human description shown to the model and users.`





- `inputSchema` — JSON schema describing args.
  - Suggested docstring: `JSON schema defining the tool input shape.`






Methods:
- `definition()` — returns Anthropic-style tool definition object.
  - Suggested docstring: `The shape you hand the model: name, description, and input schema.`





- `execute(args, services)` (Virtual) — tool implementation point.
  - Suggested docstring: `Where the tool touches the world: implement this to do the work.`






---

### Class: `ToolRegistry`

Purpose:
- Hold a set of tools and dispatch execution by name.

Responsibilities:
- Provide tool definition arrays for API clients.
- Cache name->tool mapping for quick lookup.
- Standardize success/error return shape for executions.

Suggested class docstring:
- `The tool shelf: register tools, hand definitions to models, dispatch calls by name.`






Slots (accessors):
- `tools` — array of Tool instances.
  - Suggested docstring: `Registered Tool instances.`





- `toolMap` — cached map.
  - Suggested docstring: `Cached map from toolName to tool instance (rebuilt lazily).`






Methods:
- `register(tool)` — add tool and invalidate cache.
  - Suggested docstring: `Put a tool on the shelf so it can be found and called by name.`





- `getToolMap()` — build cache when missing.
  - Suggested docstring: `Cached tool map, building it from tools[] when needed.`





- `get(name)` — lookup by name.
  - Suggested docstring: `The Tool registered under name (or undefined).`





- `definitions()` — return API definitions for all tools.
  - Suggested docstring: `Tool definitions array for API registration.`





- `execute(toolName, args, services)` — run tool and return `{success,data|error}`.
  - Suggested docstring: `Execute a named tool and return a normalized success/error envelope.`






---

## `src/test.js` — Testing Framework

### Class: `Case`

Purpose:
- Represent a synchronous test case with assertions.

Suggested class docstring:
- `A test case is a small promise: run the body and fail loudly when it breaks.`






Slots (accessors):
- `do` — test function body.
  - Suggested docstring: `Test body to run for this case.`






Methods:
- `run()` — execute `do()` and log failures.
  - Suggested docstring: `Run the test body and surface errors with logging on failure.`





- `assert(statement, msg='')` — boolean assertion.
  - Suggested docstring: `Assert statement is truthy; throw with context otherwise.`





- `assertEq(a, b, msg='')` — strict equality assertion.
  - Suggested docstring: `Assert a === b; throw with description context otherwise.`





- `assertErrorMessageIncludes(errorMessage, fragment)` — string containment helper.
  - Suggested docstring: `Assert an error message contains fragment (useful for precise failures).`





- `assertThrows(fn, expectedSubstring='', msg='')` — assert thrown error, optionally substring match.
  - Suggested docstring: `Assert fn throws; optionally require substring in error message; return message.`






---

### Class: `AsyncCase`

Purpose:
- Async-friendly test case that awaits `do()`.

Suggested class docstring:
- `Async test case: run do() with async support.`






Methods:
- `run()` (override) — await test body.
  - Suggested docstring: `Run the async test body and surface errors with logging on failure.`






---

### Class: `BrowserCase`

Purpose:
- Provide Playwright-powered browser tests with common assertions and error capture.

Suggested class docstring:
- `Playwright test case with browser/page lifecycle and console/page error collection.`






Slots (accessors):
- `browser`, `page` — Playwright objects.
  - Suggested docstrings:
    - `browser`: `Playwright browser instance for this test.`





    - `page`: `Playwright page instance for this test.`





- `isMobile` — mobile viewport toggle.
  - Suggested docstring: `Whether to use a mobile viewport when launching the page.`





- `pageErrors` — collected runtime errors.
  - Suggested docstring: `Collected page errors and console.error lines for reporting.`






Methods:
- `AsyncBefore('run')` — launch browser, create page, attach error listeners.
  - Suggested docstring: `Before run: launch browser/page and attach error listeners.`





- `AsyncAfter('run')` — report errors and close browser.
  - Suggested docstring: `After run: report page errors and close the browser.`





- `assertVisible(selector, msg='')` — visibility assertion.
  - Suggested docstring: `Assert selector is visible on the current page.`





- `assertText(selector, expected, msg='')` — text equality assertion.
  - Suggested docstring: `Assert selector textContent matches expected (trimmed).`






---

## `src/runner.js` — Test Runner CLI

### Class: `TestTimer`

Purpose:
- Provide simple elapsed-time stamps for runner logs.

Suggested class docstring:
- `Simple timer for stamping test runner logs with elapsed milliseconds.`






Slots (accessors):
- `start` — ms timestamp at init.
  - Suggested docstring: `Epoch milliseconds at which timing started.`






Methods:
- `After('init')` — set start time.
  - Suggested docstring: `Set the start time used for elapsed marks.`





- `mark()` — format elapsed time string.
  - Suggested docstring: `An elapsed time marker string like “[12ms]”.`






---

### Class: `TestRunner`

Purpose:
- Load test modules and run all test cases found in each module.

Responsibilities:
- Dynamically import module files.
- Switch global current module during execution.
- Run all instances of `test.Case` found in a module.

Suggested class docstring:
- `Runs Simulabra test modules: load file -> set module context -> run Case instances.`






Slots (accessors):
- `timer` — TestTimer.
  - Suggested docstring: `Timer used to prefix logs with elapsed runtime.`






Methods:
- `After('init')` — create timer.
  - Suggested docstring: `Create the runner timer used to stamp logs.`





- `runMod(mod)` — run all cases in module.
  - Suggested docstring: `Run all test cases defined in the given module under correct module context.`





- `loadFile(filePath)` — dynamic import.
  - Suggested docstring: `Import a test module file and return its default export.`





- `run(pathArg)` — run all `.js` tests in directory or single file.
  - Suggested docstring: `Run tests from a directory or a single file path argument.`





- `log(...args)` (override) — prepend timer mark.
  - Suggested docstring: `Log with a timer prefix by calling next('log', mark, ...args).`






---

## `src/logs.js` — Log File Streaming

### Class: `FileTail`

Purpose:
- Track position in a file and yield newly appended lines.

Responsibilities:
- Provide “tail” behavior (last N lines).
- Track read position for incremental reads.

Suggested class docstring:
- `File tailer: tracks byte position and yields newly appended non-empty lines.`






Slots (accessors):
- `filepath` — absolute file path.
  - Suggested docstring: `Absolute path to the file to tail.`





- `position` — byte position of last read.
  - Suggested docstring: `Last read byte position in the file.`






Methods:
- `exists()` — file existence check.
  - Suggested docstring: `Whether the file exists on disk.`





- `size()` — file size in bytes.
  - Suggested docstring: `Current file size in bytes (0 if missing).`





- `readNew()` — read lines appended since last read.
  - Suggested docstring: `Read new content since last position and return non-empty lines.`





- `tail(n=20)` — last N lines and update position to EOF.
  - Suggested docstring: `The last n non-empty lines and advance position to EOF.`






---

### Class: `LogFormatter`

Purpose:
- Format log lines with per-source ANSI colors.

Suggested class docstring:
- `Formats log lines with ANSI colors and source headers.`






Slots (accessors):
- `colors` — map of source name -> ANSI color code.
  - Suggested docstring: `Map of source name to ANSI color escape sequence.`





- `defaultColor` — fallback color.
  - Suggested docstring: `ANSI color used when a source is not mapped.`





- `reset` (Constant) — reset code.
  - Suggested docstring: `ANSI reset escape sequence.`






Methods:
- `colorFor(sourceName)` — color selection.
  - Suggested docstring: `The ANSI color code for the given source name.`





- `format(sourceName, line)` — colored prefix formatting.
  - Suggested docstring: `Format a log line with a colored [source] prefix.`





- `formatHeader(sourceName, text)` — header formatting.
  - Suggested docstring: `Format a section header line for a source.`






---

### Class: `LogStreamer`

Purpose:
- Aggregate multiple log files into a single output stream with formatting.

Responsibilities:
- Discover log files by extension in a directory.
- Tail each file incrementally and output new lines.
- Watch directory events + poll for reliability.

Suggested class docstring:
- `Aggregates and streams multiple log files from a directory with per-source formatting.`






Slots (accessors):
- `logsDir`, `tails`, `formatter`, `watcher`, `pollInterval`, `pollMs`, `initialTailLines`, `extension`, `output`
  - Suggested docstrings:
    - `tails`: `Map from filepath to FileTail instance.`





    - `output`: `Sink function for formatted output lines (defaults to console.log).`






Methods:
- `sourceNameFromFile(filename)` — derive source name.
  - Suggested docstring: `Derive a source name from a log filename by stripping extension.`





- `logFiles()` — list matching files.
  - Suggested docstring: `Log filenames in logsDir matching the configured extension.`





- `getTail(filename)` — get/create FileTail.
  - Suggested docstring: `A FileTail for filename, creating and caching as needed.`





- `tailFile(filename)` — emit new lines for file.
  - Suggested docstring: `Read and emit new content for a file; returns number of lines emitted.`





- `scan()` — scan all.
  - Suggested docstring: `Scan all known log files for new lines; return total lines emitted.`





- `showInitial()` — show last N per file.
  - Suggested docstring: `Emit last initialTailLines lines per file, then print a streaming header.`





- `startWatching()` — fs.watch.
  - Suggested docstring: `Start watching logsDir for file changes and tail updated files.`





- `startPolling()` — setInterval scan.
  - Suggested docstring: `Start a poll loop to scan for new log content periodically.`





- `stop()` — stop watch + poll.
  - Suggested docstring: `Stop watching and polling; clean up watcher and interval.`





- `run()` — full start sequence.
  - Suggested docstring: `Start streaming: show initial tails, then watch + poll for updates.`






---

## `src/llm.js` — LLM Client + Logprob Utilities

### Class: `LogprobEntry`

Purpose:
- Represent a token logprob in normalized form with probability helper.

Suggested class docstring:
- `Token logprob entry with probability() helper (exp(logprob)).`






Slots (accessors):
- `token`, `logprob`
  - Suggested docstrings:
    - `token`: `Token string (normalized for display).`





    - `logprob`: `Natural log probability of token (log p).`






Methods:
- `probability()` — exp(logprob).
  - Suggested docstring: `Probability as exp(logprob).`






---

### Class: `LogprobParser`

Purpose:
- Normalize logprob formats from multiple API styles into a consistent list.

Suggested class docstring:
- `Static utilities for extracting and normalizing logprob data from API responses.`






Methods:
- `parse(res)` (Static) — return raw list in `{token, logprob}` shape or null.
  - Suggested docstring: `Extract token logprobs from an API response, returning a normalized raw list or null.`





- `normalize(logprobs)` (Static) — normalize to `LogprobEntry` list, sorted by probability.
  - Suggested docstring: `Normalize raw logprob entries to LogprobEntry list (renormalize and sort by probability).`






---

### Class: `CompletionConfig`

Purpose:
- Hold per-request completion settings and produce API request config payload.

Suggested class docstring:
- `Completion request configuration (max_tokens, delta_temp) with json(baseTemp) output.`






Slots (accessors):
- `max_tokens` (Signal), `delta_temp` (Signal)
  - Suggested docstrings:
    - `max_tokens`: `Max tokens to generate for the completion.`





    - `delta_temp`: `Offset added to base temperature for this request.`






Methods:
- `json(baseTemp)` — produce payload.
  - Suggested docstring: `API-ready config object using baseTemp + delta_temp and max_tokens.`






---

### Class: `LLMClient`

Purpose:
- Provide an OpenAI-compatible completion client, including optional “image mode”.

Responsibilities:
- Hold configurable connection parameters (baseURL, apiKey, model, etc.).
- Build request bodies and headers.
- Parse text and optional logprobs from responses.

Suggested class docstring:
- `OpenAI-compatible completion client with optional multimodal (imageMode) prompt support.`






Slots (accessors):
- `apiKey`, `baseURL`, `model`, `logprobs`, `baseTemperature`, `sequential` (ConfigSignal)
  - Suggested docstrings:
    - `apiKey`: `API key used for Authorization header.`





    - `baseURL`: `Base URL of the OpenAI-compatible endpoint (e.g. https://api.openai.com).`





    - `model`: `Model identifier to send with requests.`





    - `logprobs`: `Number of top logprobs to request from API (if supported).`





    - `baseTemperature`: `Base sampling temperature used by CompletionConfig.`





    - `sequential`: `Whether to run multi-threading sequentially (integration point).`





- `imageData` (Signal) — base64 image.
  - Suggested docstring: `Base64-encoded image payload for multimodal prompts.`





- `imageMode` (Signal) — toggle.
  - Suggested docstring: `Whether to use the multimodal /completion endpoint instead of /v1/completions.`






Methods:
- `id()` — display id.
  - Suggested docstring: `A display identifier for this client (baseURL(model)).`





- `transformRequest(body, headers)` — apply model and auth.
  - Suggested docstring: `Mutate request body/headers to include model and Authorization when configured.`





- `completion(prompt, config={})` — call API and return `{text, logprobs}`.
  - Suggested docstring: `Execute a completion request and return {text, logprobs} (throws on HTTP errors).`





- `setImageData(base64)` — set image data.
  - Suggested docstring: `Set imageData to a base64 string for the next multimodal request.`





- `clearImageData()` — clear image data.
  - Suggested docstring: `Clear imageData (disable image payload without changing imageMode).`






---

## `src/time.js` — Time Policies, Scheduling, Recurrence

### Class: `TimePolicy`

Purpose:
- Provide consistent UTC-based arithmetic utilities for recurrence and schedule computation.

Suggested class docstring:
- `UTC-based date arithmetic helpers for schedule/recurrence calculations.`






Methods (Static):
- `addDays(date, days)` — UTC add days.
  - Suggested docstring: `A new Date offset by days using UTC date arithmetic.`





- `addWeeks(date, weeks)` — uses addDays.
  - Suggested docstring: `A new Date offset by weeks using UTC arithmetic.`





- `addMonths(date, months)` — UTC month arithmetic.
  - Suggested docstring: `A new Date offset by months using UTC month arithmetic.`





- `getDayOfWeek(date)` — UTC weekday.
  - Suggested docstring: `UTC day-of-week (0=Sunday..6=Saturday).`





- `endOfDay(date)` / `startOfDay(date)` — UTC boundaries.
  - Suggested docstring: `Date snapped to start/end of UTC day.`





- `isSameDay(date1, date2)` — UTC day equality.
  - Suggested docstring: `Whether two dates fall on the same UTC day.`





- `isAfterDay(date1, date2)` — after by day.
  - Suggested docstring: `Whether date1 is after date2 when comparing whole UTC days.`






---

### Class: `TimeOfDaySchedule`

Purpose:
- Compute next occurrence for “run at these times of day” schedules, optionally filtered by day-of-week, in a chosen timezone.

Suggested class docstring:
- `Time-of-day schedule with optional day-of-week filtering and timezone-aware next occurrence.`






Slots (accessors):
- `times` — `["HH:MM", ...]`.
  - Suggested docstring: `Times of day to run (HH:MM 24-hour strings).`





- `days` — optional day names.
  - Suggested docstring: `Optional day-of-week filter as names (e.g. [\"mon\",\"tue\"]).`






Methods:
- `parseDays()` — map day names to 0..6.
  - Suggested docstring: `Parse day name strings into numeric weekday codes (0..6).`





- `parseTimeInTimezone(timeStr, timezone, now=new Date())` — parse time and compute now in tz.
  - Suggested docstring: `Parse a HH:MM time string and compute current date parts in a target timezone.`





- `nextOccurrence(now=new Date(), timezone='local')` — next scheduled Date.
  - Suggested docstring: `The next Date this schedule should run after now in the given timezone.`





- `getTimezoneOffset(tz, date)` — compute ms offset.
  - Suggested docstring: `Ms offset used to map UTC to a given timezone at a given date.`






---

### Class: `ScheduledJob`

Purpose:
- Bind a schedule to an async action and track last/next run times.

Suggested class docstring:
- `Runnable job: (name, schedule, action) with enabled flag and run bookkeeping.`






Slots (accessors):
- `jobName`, `schedule`, `action`, `enabled`, `lastRunAt`, `nextRunAt`
  - Suggested docstrings:
    - `jobName`: `Unique job identifier.`





    - `schedule`: `Schedule instance providing nextOccurrence(now, timezone).`





    - `action`: `Async function to execute when the job runs.`





    - `enabled`: `Whether this job will run when scheduled.`





    - `lastRunAt`: `Timestamp of the last run.`





    - `nextRunAt`: `Calculated timestamp of the next run.`






Methods:
- `calculateNextRun(timezone)` — compute and store next run.
  - Suggested docstring: `Compute and store the next run time for this job using its schedule.`





- `run()` — execute action and update lastRunAt.
  - Suggested docstring: `Run the job action (if enabled) and update lastRunAt.`






---

### Class: `Scheduler`

Purpose:
- Manage multiple scheduled jobs using `setTimeout` for each job’s next run.

Suggested class docstring:
- `Timeout-based scheduler for ScheduledJobs with start/stop and per-job rescheduling.`






Slots (accessors):
- `jobs`, `timezone`, `running`, `timers`, `logger`
  - Suggested docstrings:
    - `jobs`: `Map of jobName -> ScheduledJob.`





    - `timers`: `Map of jobName -> active timeout handle.`





    - `logger`: `Optional logging function (receives ...args).`






Methods:
- `log(...args)` — call logger if present.
  - Suggested docstring: `Log via logger() when configured.`





- `register(job)` — add job; schedule if running.
  - Suggested docstring: `Add a job to the scheduler so it will be considered for future runs.`





- `unregister(jobName)` — remove job and clear timer.
  - Suggested docstring: `Remove a job and clear any pending timer for it.`





- `scheduleJob(job)` — clear existing timer, compute next, set timeout, reschedule after run.
  - Suggested docstring: `Schedule a single job for its next run time and reschedule after it executes.`





- `start()` — schedule all jobs.
  - Suggested docstring: `Start scheduling all registered jobs.`





- `stop()` — clear timers and mark not running.
  - Suggested docstring: `Stop scheduling and clear all pending timers.`






---

### Class: `RecurrenceRule`

Purpose:
- Represent simple recurrence (daily/weekly/monthly) with interval, optional weekly day set, and optional end date.

Suggested class docstring:
- `Simple recurrence rule supporting daily/weekly/monthly patterns with interval and optional end date.`






Slots (accessors):
- `pattern` (EnumVar) — `'daily'|'weekly'|'monthly'`.
  - Suggested docstring: `Recurrence pattern: daily, weekly, or monthly.`





- `interval` — every N units.
  - Suggested docstring: `Repeat interval (every N pattern units).`





- `daysOfWeek` — for weekly pattern.
  - Suggested docstring: `For weekly pattern: numeric weekdays (0=Sun..6=Sat).`





- `endDate` — optional end.
  - Suggested docstring: `Optional inclusive end date (no occurrences after end of day).`






Methods:
- `nextOccurrence(fromDate)` — compute next using UTC arithmetic and constraints.
  - Suggested docstring: `The next occurrence after fromDate using UTC arithmetic (or null past endDate).`





- `toJSON()` — serialize.
  - Suggested docstring: `Serialize this recurrence rule to a plain JSON object.`





- `fromJSON(json)` (Static) — deserialize.
  - Suggested docstring: `A RecurrenceRule from a JSON object.`






---

## `src/http.js` — HTTP Routing (Bun + Legacy Node)

### Module-level helpers (exported on the http module object)

Purpose:
- Provide small reusable helpers for JSON responses and static asset serving outside of the class system.

Functions:
- `jsonResponse(data, status = 200)` — return `Response` with JSON body and `Content-Type: application/json`.
  - Suggested docstring: `A JSON Response with application/json content type and the given status.`





- `staticFileResponse(filePath, contentType)` — return `Response(Bun.file)` or null if missing.
  - Suggested docstring: `Serve a static file using Bun.file when it exists; return null otherwise.`





- `mimeType(path)` — map file extension to content-type with fallback.
  - Suggested docstring: `Content type for a path based on file extension (fallback application/octet-stream).`






### Class: `HttpError`

Purpose:
- Structured error that becomes a predictable JSON response with status.

Suggested class docstring:
- `Structured HTTP error that can be converted to a JSON response with status and code.`






Slots (accessors):
- `status`, `message`, `code`, `data`
  - Suggested docstrings:
    - `status`: `HTTP status code.`





    - `message`: `Human error message.`





    - `code`: `Optional machine-readable error code.`





    - `data`: `Optional structured error data payload.`






Methods:
- `toResponse()` — return `{ok:false, error, code, data}`.
  - Suggested docstring: `Convert this error into a standard JSON error payload.`






---

### Class: `HttpContext`

Purpose:
- Carry parsed request data through handlers (method, pathname, params, body) and track timing.

Suggested class docstring:
- `Per-request context carrying URL/method/pathname/params/body and timing metadata.`






Slots (accessors):
- `request`, `url`, `method`, `pathname`, `params`, `body`, `startedAt`, `requestId`
  - Suggested docstrings:
    - `params`: `Path params extracted from route patterns.`





    - `body`: `Parsed request body (e.g. JSON object).`





    - `startedAt`: `Epoch ms at which request handling started.`





    - `requestId`: `Short request id for logging/correlation.`






Methods:
- `After('init')` — parse URL/method, set startedAt/requestId.
  - Suggested docstring: `Parse request fields and start the clock for logging.`





- `elapsed()` — ms since startedAt.
  - Suggested docstring: `Elapsed milliseconds since request handling started.`






---

### Class: `HttpHandler`

Purpose:
- Protocol for handlers used by `HttpRouter`.

Suggested class docstring:
- `HTTP handler interface: match(ctx) -> bool and handle(ctx) -> value|Response.`






Virtual methods:
- `match(ctx)` — determine eligibility.
  - Suggested docstring: `Whether this handler should handle the given request context.`





- `handle(ctx)` — perform handling.
  - Suggested docstring: `Handle request and return Response (or value to be JSON-wrapped).`






---

### Class: `HttpRouter`

Purpose:
- Route requests to the first matching handler and normalize output.

Suggested class docstring:
- `First-match wins: a router that turns handler results into Responses.`






Slots (accessors):
- `handlers` — handler list.
  - Suggested docstring: `Ordered list of handlers to attempt in routing order.`






Methods:
- `addHandler(handler)` — append.
  - Suggested docstring: `Add a handler to the routing table (appends to end).`





- `route(ctx)` — find first match.
  - Suggested docstring: `The first handler result that matches ctx (or null if none).`





- `handle(request)` — create context, route, normalize to JSON/404.
  - Suggested docstring: `Handle a Request by routing and normalizing results to JSON or 404.`






---

### Class: `MethodPathHandler`

Purpose:
- Provide a simple handler matching HTTP method and a path pattern with `:params`.

Suggested class docstring:
- `Handler matching HTTP method and path (supports :param segments) and delegates to handlerFn(ctx).`






Slots (accessors):
- `httpMethod`, `path`, `pathPattern`, `handlerFn`
  - Suggested docstrings:
    - `pathPattern`: `Compiled regex for :param patterns (if path contains params).`





    - `handlerFn`: `Function(ctx) -> value|Response to execute when matched.`






Methods:
- `After('init')` — compile `pathPattern` when needed.
  - Suggested docstring: `Compile :param path pattern into a RegExp for matching and param extraction.`





- `match(ctx)` — method + path match.
  - Suggested docstring: `Match by method and path; populate ctx.params when regex is used.`





- `handle(ctx)` — call handlerFn.
  - Suggested docstring: `Invoke handlerFn with ctx and return its result.`






---

### Class: `JsonBody` (mixin)

Purpose:
- Parse JSON bodies into `ctx.body` before a handler runs.

Suggested class docstring:
- `Mixin that parses application/json request bodies into ctx.body before handle().`






Methods:
- `AsyncBefore('handle')` — parse JSON, throw `HttpError` on invalid.
  - Suggested docstring: `Before handle: parse JSON body when content-type is application/json; throw HttpError on parse failure.`






---

### Class: `ApiRouter`

Purpose:
- Router with JSON body parsing, structured error handling, and request logging.

Suggested class docstring:
- `HttpRouter with JSON body parsing, HttpError handling, and request timing logs.`






Methods:
- `parseJsonBody(ctx)` — parse and set ctx.body.
  - Suggested docstring: `Parse JSON request body into ctx.body when content-type is application/json.`





- `handle(request)` (override) — structured wrapping and logging.
  - Suggested docstring: `Handle request with JSON parsing, structured error handling, and timing logs.`






---

### Class: `StaticFileHandler`

Purpose:
- Serve static files from a directory under a URL prefix.

Suggested class docstring:
- `Serves static files from rootDir under a URL prefix (GET only, supports index file).`






Slots (accessors):
- `urlPrefix`, `rootDir`, `indexFile`
  - Suggested docstrings:
    - `urlPrefix`: `URL prefix to match (e.g. '/').`





    - `rootDir`: `Filesystem directory containing static assets.`





    - `indexFile`: `Default file for directory paths (e.g. index.html).`






Methods:
- `match(ctx)` — GET + prefix.
  - Suggested docstring: `True for GET requests under urlPrefix.`





- `handle(ctx)` — resolve file and return `Response` or null.
  - Suggested docstring: `Serve a static file response when file exists, else return null.`






---

### Legacy Node HTTP layer (existing compatibility)

#### Class: `HTTPRequest`

Purpose:
- Wrap Node `IncomingMessage` with timing and JSON body drain.

Suggested class docstring:
- `Wrapper around Node HTTP request with elapsed timing and JSON body drain helper.`






Methods:
- `elapsed()` — ms since start.
  - Suggested docstring: `Elapsed milliseconds since this request wrapper was created.`





- `drain()` — read and parse JSON body.
  - Suggested docstring: `Read and parse JSON body for POST application/json requests (reject otherwise).`






#### Class: `HTTPResponse`

Purpose:
- Wrap Node `ServerResponse` with helpers.

Suggested class docstring:
- `Wrapper around Node HTTP response with convenience ok() method.`






Methods:
- `ok(message, ct='text/html')` — write 200 and end.
  - Suggested docstring: `Write a 200 OK response with content-type and end the response.`






#### Class: `HTTPServer`

Purpose:
- Create a Node `http.createServer` that dispatches to Simulabra request handlers.

Suggested class docstring:
- `Node HTTP server that dispatches to handler slots that implement match(url) and handle(app, req, res).`






Methods/behavior:
- `After('init')` — create server, dispatch over `slots`, listen on port.
  - Suggested docstring: `Start the server and route requests through configured handlers.`






#### Class: `RequestHandler`

Purpose:
- Protocol for legacy request handlers.

Suggested class docstring:
- `Legacy request handler interface with match(url) and handle(app, req, res).`






#### Class: `HandlerLogger` (mixin)

Purpose:
- Post-handle logging.

Suggested class docstring:
- `Mixin that logs request timing after handle().`






#### Class: `VarHandler`

Purpose:
- Handler that delegates to an injected function.

Suggested class docstring:
- `Delegating handler whose handle(...) calls a configured handler function.`






Methods:
- `handle(...args)` — call handler().
  - Suggested docstring: `Dispatch to the configured handler function.`






#### Class: `PathRequestHandler`

Purpose:
- Match exact path strings.

Suggested class docstring:
- `Legacy handler that matches an exact URL path string.`






Methods:
- `match(url)` — equality.
  - Suggested docstring: `Whether url equals the configured path.`






#### Class: `FiletypeRequestHandler`

Purpose:
- Serve files by extension.

Suggested class docstring:
- `Legacy handler that matches file extension and serves the requested file from disk.`






Methods:
- `match(url)` — extension match.
  - Suggested docstring: `Whether the requested URL has a file extension in filetypes.`





- `handle(app, req, res)` — read file and respond.
  - Suggested docstring: `Serve the requested file from disk with the configured MIME type.`






#### Class: `HTTPRequestCommand`

Purpose:
- Command slot for making outbound HTTP requests.

Suggested class docstring:
- `Command that performs an HTTP request (fetch) with configurable method, body, and response type.`






Methods:
- `run()` — fetch and parse per responseType.
  - Suggested docstring: `Execute fetch(url) with JSON body when provided and return parsed response by responseType.`






---

## `src/db.js` — Persistence: SQLite + Redis

### Class: `SQLite`

Purpose:
- Minimal wrapper for constructing `bun:sqlite` Database instances.

Suggested class docstring:
- `Utilities for working with bun:sqlite (Database construction).`






Methods:
- `createDatabase(dbName)` (Static) — new `Database(dbName)`.
  - Suggested docstring: `Create and return a bun:sqlite Database for dbName.`






---

### Slot class: `DBVar`

Purpose:
- Extend `Var` with DB persistence metadata and value transforms.

Suggested class docstring:
- `Var slot with persistence metadata (primary/mutable/indexed/searchable) and SQL transforms.`






Slots (accessors):
- `mutable` — update allowed.
  - Suggested docstring: `Whether this field is mutable (included in UPDATE statements).`





- `primary` — primary key.
  - Suggested docstring: `Whether this field is the primary key column.`





- `indexed` — create index.
  - Suggested docstring: `Whether to create a SQLite index for this field.`





- `searchable` — include in FTS.
  - Suggested docstring: `Whether to include this field in an FTS table for full-text search.`





- `createText` — column type DDL.
  - Suggested docstring: `SQLite column DDL fragment used when creating the table.`





- `toSQL` / `fromSQL` — serialization transforms.
  - Suggested docstrings:
    - `toSQL`: `Transform a JS value into a SQL-storable value.`





    - `fromSQL`: `Transform a SQL value into a JS value.`






---

### Mixin class: `Persisted`

Purpose:
- Simple persistence mixin for SQLite using integer `pid` primary keys.

Suggested class docstring:
- `SQLite persistence mixin using integer pid primary keys and DBVar columns.`






Slots (accessors):
- `pid` (DBVar) — primary key.
  - Suggested docstring: `Auto-increment integer primary key in the database.`





- `created` (DBVar) — creation timestamp.
  - Suggested docstring: `Creation timestamp for the row (Date <-> ISO string).`






Methods:
- `columns()` (Static) — DBVar list.
  - Suggested docstring: `DBVar columns declared by this class (including mixins).`





- `columnReplacements(columns)` — build `$name -> toSQL(value)` mapping.
  - Suggested docstring: `Build a replacements map for named parameters ($field) using DBVar.toSQL transforms.`





- `table()` (Static) — table name.
  - Suggested docstring: `The table name for this class (defaults to class name).`





- `initDB(db)` (Static) — create table.
  - Suggested docstring: `Make sure the table exists for this class.`





- `save(db)` — insert/update and set `pid`.
  - Suggested docstring: `Insert or update this row in SQLite, setting pid on first insert.`





- `loadAll(db)` (Static) — read and instantiate all rows.
  - Suggested docstring: `Load all rows from the table and instantiate objects.`






---

### Mixin class: `SQLitePersisted`

Purpose:
- Rich SQLite persistence mixin using UUID `sid` primary keys, timestamps, optional indexes, and FTS5 search.

Suggested class docstring:
- `A mixin that makes your objects live in SQLite with ids, timestamps, and optional search.`






Slots (accessors):
- `sid`, `createdAt`, `updatedAt` — identifiers and timestamps.
  - Suggested docstrings:
    - `sid`: `UUID primary key for the table row.`





    - `createdAt`: `Creation timestamp (Date).`





    - `updatedAt`: `Last update timestamp (Date).`






Methods (Static):
- `tableName()` — customizable table naming.
  - Suggested docstring: `Table name for this class (override for prefixes).`





- `dbVars()` — list DBVar slots.
  - Suggested docstring: `All DBVar slots declared by this class.`





- `indexedVars()` / `searchableVars()` — subsets.
  - Suggested docstring: `DBVar slots marked indexed/searchable.`





- `initTable(db)` — create table.
  - Suggested docstring: `Create the main table for this class if it does not exist.`





- `initIndexes(db)` — create indexes.
  - Suggested docstring: `Create secondary indexes for indexed DBVars.`





- `initFTS(db)` — create FTS5 table and triggers.
  - Suggested docstring: `Create FTS5 virtual table and triggers for searchable DBVars (if any).`





- `initDB(db)` — all initialization.
  - Suggested docstring: `Make sure persistence artifacts exist (table, indexes, and search when configured).`





- `fromSQLRow(row)` — instantiate object with fromSQL transforms.
  - Suggested docstring: `Instantiate an object from a SQLite row using DBVar.fromSQL transforms.`





- `findById(db, sid)` — find row by sid.
  - Suggested docstring: `Instance for sid (or null if missing).`





- `findByIndex(db, fieldName, value)` — equality query on indexed column.
  - Suggested docstring: `Instances whose fieldName equals value (after toSQL transform).`





- `findAll(db)` — all rows.
  - Suggested docstring: `All instances of this class from SQLite.`





- `search(db, query)` — FTS search.
  - Suggested docstring: `Run full-text search against the class FTS table and return matching instances.`






Methods (instance):
- `toSQLHash()` — `$field -> sqlValue` hash.
  - Suggested docstring: `Serialize this instance to a named-parameter SQL hash using DBVar.toSQL transforms.`





- `save(db)` — insert/update, set `sid`/timestamps.
  - Suggested docstring: `Insert or update this instance in SQLite, managing sid and timestamps.`





- `delete(db)` — delete by sid.
  - Suggested docstring: `Delete this instance from SQLite by sid.`





- `jsonify()` — rename sid->id for API.
  - Suggested docstring: `Serialize to JSON and rename sid to id for API output.`






---

### Class: `SQLiteStream`

Purpose:
- Append-only stream storage for events/messages using a SQLite table.

Suggested class docstring:
- `Append-only message stream backed by SQLite table (per-streamName ordering).`






Slots (accessors):
- `db`, `streamName`, `tableName`
  - Suggested docstrings:
    - `db`: `SQLite Database instance to use.`





    - `streamName`: `Logical stream name partitioning entries.`





    - `tableName`: `SQLite table name storing stream entries (default _streams).`






Methods:
- `initTable()` — create table and index.
  - Suggested docstring: `Create streams table and supporting indexes if not present.`





- `append(data)` — insert entry and return entryId.
  - Suggested docstring: `Append an entry to the stream and return a generated entryId.`





- `readAfter(afterId=0, limit=100)` — poll by internal id.
  - Suggested docstring: `Read entries after internalId (exclusive) for polling consumers.`





- `readLatest(limit=100)` — latest entries.
  - Suggested docstring: `Read latest entries for stream (newest first).`





- `getLastInternalId()` — max id.
  - Suggested docstring: `The last internalId written for this stream.`






---

### Class: `Migration`

Purpose:
- Represent a single database migration version with up/down functions.

Suggested class docstring:
- `Database migration record with version, description, and up/down functions.`






Slots (accessors):
- `version`, `description`, `up`, `down`
  - Suggested docstrings:
    - `up`: `Function(db) that applies the migration.`





    - `down`: `Optional Function(db) that rolls back the migration.`






---

### Class: `MigrationRunner`

Purpose:
- Track applied migrations in a migrations table and apply/rollback as needed.

Suggested class docstring:
- `Migration executor that tracks applied versions in a table and applies pending migrations.`






Slots (accessors):
- `db`, `migrations`, `migrationsTable`
  - Suggested docstrings:
    - `migrations`: `Ordered list of Migration objects registered for this DB.`





    - `migrationsTable`: `Name of the migrations tracking table (default _migrations).`






Methods:
- `initMigrationsTable()` — create tracking table.
  - Suggested docstring: `Ensure migrations tracking table exists.`





- `appliedVersions()` — read applied version list.
  - Suggested docstring: `Applied migration versions sorted by version.`





- `pending()` — list non-applied migrations.
  - Suggested docstring: `Migrations not yet applied, sorted by version.`





- `migrate()` — apply all pending and record.
  - Suggested docstring: `Apply all pending migrations and record them in migrationsTable; return count applied.`





- `rollback()` — rollback most recent.
  - Suggested docstring: `Rollback the most recently applied migration (requires down).`





- `register(migration)` — add to list.
  - Suggested docstring: `Add a migration to the runner so it can be applied in order.`






---

### Slot class: `RedisVar`

Purpose:
- `Var` with Redis serialization transforms and indexing/search metadata.

Suggested class docstring:
- `Var slot with Redis storage transforms and optional indexing/search metadata.`






Slots (accessors):
- `indexed`, `searchable`, `toRedis`, `fromRedis`
  - Suggested docstrings:
    - `toRedis`: `Transform a JS value into a Redis-storable representation.`





    - `fromRedis`: `Transform a Redis-stored representation back into a JS value.`






---

### Class: `RedisClient`

Purpose:
- Provide Redis operations in an async client wrapper, including RediSearch commands.

Suggested class docstring:
- `Redis client wrapper (connect/get/set/hset/streams) with RediSearch helpers.`






Slots (accessors):
- `url`, `client`, `connected`, `keyPrefix`
  - Suggested docstrings:
    - `keyPrefix`: `Prefix for all keys (namespacing/test isolation).`






Methods:
- `connect()` — connect underlying client.
  - Suggested docstring: `Open a line: to Redis using url() and set connected(true) on success.`





- `disconnect()` — quit underlying client.
  - Suggested docstring: `Close the line: from Redis by quitting the underlying client and clearing connected flag.`





- `get(key)` — GET.
  - Suggested docstring: `Get a key’s string value from Redis.`





- `set(key, value)` — SET.
  - Suggested docstring: `Set a key’s string value in Redis.`





- `del(key)` — DEL.
  - Suggested docstring: `Delete a key from Redis.`





- `hSet(key, fields)` — HSET.
  - Suggested docstring: `Set multiple hash fields on key (HSET).`





- `hGetAll(key)` — HGETALL.
  - Suggested docstring: `All hash fields for key (HGETALL).`





- `hDel(key, fields)` — HDEL.
  - Suggested docstring: `Delete one or more hash fields (HDEL), returning number removed.`





- `keys(pattern)` — KEYS.
  - Suggested docstring: `List keys matching pattern (use with care; can be expensive).`





- `scan(pattern, count = 100)` — SCAN loop.
  - Suggested docstring: `Iterate keys matching pattern via SCAN (safer alternative to KEYS).`





- `sAdd(key, member)` — SADD.
  - Suggested docstring: `Add a member to a set (SADD).`





- `sRem(key, member)` — SREM.
  - Suggested docstring: `Remove a member from a set (SREM).`





- `sMembers(key)` — SMEMBERS.
  - Suggested docstring: `All members of a set (SMEMBERS).`





- `zAdd(key, score, member)` — ZADD.
  - Suggested docstring: `Add a member to a sorted set with score (ZADD).`





- `zRem(key, member)` — ZREM.
  - Suggested docstring: `Remove a member from a sorted set (ZREM).`





- `zRangeByScore(key, min, max)` — ZRANGEBYSCORE.
  - Suggested docstring: `Sorted set members within a score range (ZRANGEBYSCORE).`





- `streamAdd(stream, data)` — XADD.
  - Suggested docstring: `Add an entry to a Redis stream (XADD), JSON-stringifying non-string fields.`





- `streamRead(stream, start = '0', count = 100)` — XRANGE.
  - Suggested docstring: `Read entries from a Redis stream starting at id (XRANGE).`





- `streamReadAfter(stream, afterId, count = 100)` — XRANGE exclusive.
  - Suggested docstring: `Read entries strictly after afterId (exclusive) using XRANGE.`





- `streamRevRange(stream, count = 100)` — XREVRANGE.
  - Suggested docstring: `Read newest entries from a Redis stream (XREVRANGE).`





- `streamReadBlock(stream, afterId, timeoutMs = 5000, count = 100)` — XREAD BLOCK.
  - Suggested docstring: `Blocking read for new stream entries after afterId (XREAD BLOCK).`





- `deleteByPattern(pattern)` — delete keys.
  - Suggested docstring: `Delete all keys matching pattern (currently uses KEYS; prefer scan() for large keyspaces).`





- `ftCreate(indexName, schema, options = {})` — RediSearch create.
  - Suggested docstring: `A RediSearch index with schema and optional key prefix; return EXISTS when present.`





- `ftDropIndex(indexName)` — RediSearch drop.
  - Suggested docstring: `Drop a RediSearch index; return NOT_FOUND when missing.`





- `ftSearch(indexName, query, options = {})` — RediSearch query.
  - Suggested docstring: `Execute a RediSearch query and return parsed documents (key + fields).`





- `_parseFtSearchResult(result)` — parse FT.SEARCH reply.
  - Suggested docstring: `Parse a raw FT.SEARCH reply into an array of {key, fields}.`






---

### Mixin class: `RedisPersisted`

Purpose:
- Persist objects as Redis hashes with optional secondary indexes and RediSearch integration.

Suggested class docstring:
- `A mixin that makes your objects live in Redis (hash + indexes) without losing their shape.`






Slots (accessors):
- `rid`, `createdAt`, `updatedAt` — identity + timestamps.
  - Suggested docstrings:
    - `rid`: `UUID identifier for Redis persistence.`






Methods (Static):
- `keyPrefix(redis)` — prefix.
  - Suggested docstring: `The base key prefix for this class (includes client prefix when provided).`





- `indexKey(redis)` — set of ids.
  - Suggested docstring: `Key for the set containing all ids for this class.`





- `searchIndexName(redis)` — RediSearch index name.
  - Suggested docstring: `RediSearch index name for this class.`





- `fieldIndexKey(redis, fieldName, value)` — secondary index key.
  - Suggested docstring: `Key for secondary index set for field/value.`





- `redisVars()` / `indexedVars()` / `searchableVars()` — var discovery.
  - Suggested docstring: `RedisVar slots and their indexed/searchable subsets.`





- `ensureSearchIndex(redis)` — create RediSearch index.
  - Suggested docstring: `Ensure RediSearch index exists for searchable/indexed fields.`





- `search(redis, query, options={})` — search and instantiate.
  - Suggested docstring: `Search via RediSearch and return instantiated objects from hash fields.`





- `findByIndex(redis, fieldName, value)` — secondary index lookup.
  - Suggested docstring: `Find objects by indexed field using secondary index sets.`





- `fromRedisHash(hash)` — instantiate.
  - Suggested docstring: `Instantiate object from Redis hash fields using RedisVar.fromRedis transforms.`





- `findById(redis, id)` — get hash.
  - Suggested docstring: `Load an object by id from Redis (or return null when missing).`





- `findAll(redis)` — load all by ids set.
  - Suggested docstring: `Load all objects by scanning the ids set.`






Methods (instance):
- `redisKey(redis)` — key for instance.
  - Suggested docstring: `The Redis key for this instance (prefix:rid).`





- `toRedisHash()` — serialize values and list null fields.
  - Suggested docstring: `Serialize to Redis hash fields and list fields to delete when null/undefined.`





- `_updateSecondaryIndexes(redis, oldHash)` — maintain indexes.
  - Suggested docstring: `Update secondary index sets when indexed field values change.`





- `_removeFromSecondaryIndexes(redis)` — remove.
  - Suggested docstring: `Remove this object id from all secondary indexes.`





- `save(redis)` — write hash + update indexes + add to ids set.
  - Suggested docstring: `Persist this object to Redis (hash + id set + secondary index maintenance).`





- `delete(redis)` — delete hash + indexes + ids set.
  - Suggested docstring: `Delete this object from Redis and remove it from indexes and id set.`






---

## `src/html.js` — Browser UI: Templates, VNodes, Components, Browser RPC

### Compiler base: `AstNodeCompilerBase`

Purpose:
- Provide a compiler protocol for template AST nodes.

Suggested class docstring:
- `A mixin that makes your objects live in Redis (hash + indexes) without losing their shape.`






Virtual method:
- `compile(...)` — required implementation.
  - Suggested docstring: `Compile an AST node into VNode/ComponentInstance/string/array using env expressions.`






---

### Compiler: `ElementNodeCompiler`

Purpose:
- Compile element AST nodes into `VNode.h(...)` calls.

Suggested class docstring:
- `A mixin that makes your objects live in Redis (hash + indexes) without losing their shape.`






Methods:
- `compile(node, env, compileRecursiveFn, parentComponent)` — build props/children and call `VNode.h`.
  - Suggested docstring: `Compile an element AST node to a VNode (props from attrs; children compiled recursively).`






---

### Compiler: `ComponentNodeCompiler`

Purpose:
- Compile component AST nodes (`<$Component ...>`) into `ComponentInstance`.

Suggested class docstring:
- `A mixin that makes your objects live in Redis (hash + indexes) without losing their shape.`






Methods:
- `compile(node, env, compileRecursiveFn, parentComponent)` — resolve component class and instantiate.
  - Suggested docstring: `Compile a component AST node to a ComponentInstance, passing props and compiled children.`






---

### Compiler: `FragmentNodeCompiler`

Purpose:
- Compile fragment AST nodes (`<>...</>`) into arrays of compiled children.

Suggested class docstring:
- `A mixin that makes your objects live in Redis (hash + indexes) without losing their shape.`






Methods:
- `compile(...)` — returns array.
  - Suggested docstring: `Compile a fragment node by compiling its children to an array.`






---

### Compiler: `TextNodeCompiler`

Purpose:
- Compile plain text AST nodes to strings.

Suggested class docstring:
- `A mixin that makes your objects live in Redis (hash + indexes) without losing their shape.`






Methods:
- `compile(node)` — return node.value.
  - Suggested docstring: `Text node value as a string.`






---

### Compiler: `ExprNodeCompiler`

Purpose:
- Compile expression placeholders to expression values.

Suggested class docstring:
- `A mixin that makes your objects live in Redis (hash + indexes) without losing their shape.`






Methods:
- `compile(node, env)` — return env[idx].
  - Suggested docstring: `The expression value from env for this placeholder node.`






---

### Class: `VNode`

Purpose:
- Wrap a mountable DOM node (`Element` or `DocumentFragment`) with a stable interface.

Suggested class docstring:
- `A mountable bit of DOM (element or fragment) that the reactive system can keep replacing.`






Slots (accessors):
- `el` — underlying DOM node.
  - Suggested docstring: `Underlying DOM node (Element or DocumentFragment).`






Methods:
- `mount(parentElement)` — append child.
  - Suggested docstring: `Append this VNode’s DOM node to parentElement.`





- `h(tag, props = {}, ...children)` (Static) — template builder with reactive attributes and children.
  - Suggested docstring: `The HTML constructor: build a mountable VNode; pass functions for reactive attrs and children.`






---

### Class: `HTML`

Purpose:
- Provide template parsing/compilation and DOM patching utilities.

Suggested class docstring:
- `HTML template utilities: parse tagged templates to AST, compile to VNode factories, and patch DOM.`






Methods (Static):
- `patch(oldEl, newEl)` — naive replace.
  - Suggested docstring: `A blunt patch: if it’s different, replace it.`





- `t(strings, ...expressions)` — tagged template entry, caches compilation.
  - Suggested docstring: `Compile once, render many: cache the template and produce VNodes from expression values.`





- `parseTemplate(strings)` — template -> AST.
  - Suggested docstring: `Turn template literal strings into an AST so the compilers can reify it.`





- `compileAstToFactory(ast)` — AST -> factory.
  - Suggested docstring: `Freeze an AST into a factory: feed it expression values, get mountable VNodes.`






---

### Class: `ComponentInstance`

Purpose:
- Wrap a `Component` instance and manage reactive rerendering/DOM patching.

Suggested class docstring:
- `A component rendered into the world, kept fresh by an Effect and DOM patching.`






Slots (accessors):
- `comp`, `parent`, `vnode`, `effect`
  - Suggested docstrings:
    - `comp`: `Underlying component instance being rendered.`





    - `parent`: `Parent component used as render context.`





    - `vnode`: `Last rendered VNode tree.`





    - `effect`: `Reactive Effect used to rerender on dependency changes.`






Methods:
- `After('init')` — render once and install effect that re-renders and patches DOM.
  - Suggested docstring: `Render once, then install a reactive rerender effect that patches the DOM.`





- `el()` — return root DOM node.
  - Suggested docstring: `The root DOM node for this component instance.`





- `mount(parentElement)` — mount vnode.
  - Suggested docstring: `Mount this component instance into parentElement.`





- `dispose()` — dispose rerender effect.
  - Suggested docstring: `Dispose reactive effect and stop rerendering for this instance.`






---

### Base class: `Component`

Purpose:
- Define the component protocol (`render`) and mount helper with CSS injection.

Suggested class docstring:
- `A component is a function with memory: render() plus optional css().`






Methods:
- `css()` — default empty CSS.
  - Suggested docstring: `Component CSS string injected on mount (override to style).`





- `render(parent)` (Virtual) — returns VNode/ComponentInstance/etc.
  - Suggested docstring: `Render this component to a VNode (or compatible mountable output).`





- `Before('render')` / `After('render')` — manage `Component.__current_rendering`.
  - Suggested docstrings:
    - `Before render`: `Set current rendering component for child render context propagation.`





    - `After render`: `Restore previous rendering component after render finishes.`





- `mount(target=document.body)` — render and mount + inject style tag.
  - Suggested docstring: `Render and mount component into target, then inject css() into a style tag.`






---

### Class: `LiveBrowserClient`

Purpose:
- Browser-side WebSocket client for calling supervisor services via RPC.

Suggested class docstring:
- `Browser WebSocket RPC client that calls supervisor services and tracks pending calls with reconnection support.`






Slots (accessors):
- `connected`, `socket`, `pendingCalls`, `callIdCounter`, `host`, `port`, `reconnectDelayMs`, `maxReconnectDelayMs`, `autoReconnect`, `reconnectAttempts`, `reconnectTimer`, `onConnect`, `onDisconnect`, `onError`
  - Suggested docstrings:
    - `pendingCalls`: `Map from callId to {resolve, reject} for outstanding RPC calls.`





    - `autoReconnect`: `Whether to reconnect automatically after close.`






Methods:
- `connect()` — open socket and wire handlers.
  - Suggested docstring: `Open a line: to supervisor via WebSocket and set up message/close/error handlers.`





- `scheduleReconnect()` — exponential backoff reconnect.
  - Suggested docstring: `Schedule a reconnect attempt using exponential backoff (no-op if already scheduled).`





- `disconnect()` — close and disable reconnect.
  - Suggested docstring: `Close the line: from supervisor and stop any scheduled reconnect attempts.`





- `rpcCall(service, method, args=[])` — send RPC request and await response.
  - Suggested docstring: `Send a message: an RPC call and return a Promise that resolves/rejects when response arrives.`





- `serviceProxy(c)` — proxy for calling methods.
  - Suggested docstring: `A proxy whose methods call rpcCall(serviceName, method, args).`






---

## `src/live.js` — Live RPC + Supervisor/Service Management

### Protocol class: `MessageHandler`

Purpose:
- Define topic-based message handlers for Live messaging.

Suggested class docstring:
- `Topic-based message handler interface for Live messages (topic + handle).`






Virtual methods:
- `topic()` — message topic string.
  - Suggested docstring: `The topic this handler handles.`





- `handle(...)` — message handler entrypoint.
  - Suggested docstring: `Handle a message for this topic (context varies by master/client).`






---

### Slot class: `RpcMethod`

Purpose:
- Provide a semantic alias for methods intended to be RPC-callable.

Suggested class docstring:
- `Method slot intended for RPC exposure (semantic alias of Method).`






---

### Handler: `RPCHandler`

Purpose:
- Handle incoming RPC messages: dispatch to local method and return response.

Suggested class docstring:
- `RPC message handler: dispatch to local method and send response back to caller.`






Methods:
- `handle({ client, message })` — validate `to`, handle muting, call method, send response.
  - Suggested docstring: `Dispatch an RPC message to client[method](...args) and send response (respects mute rules).`






---

### Handler: `ResponseHandler`

Purpose:
- Resolve pending RPC calls by message id.

Suggested class docstring:
- `Response message handler: resolves pending ReifiedPromise by mid.`






Methods:
- `handle({ client, message })` — resolve promise.
  - Suggested docstring: `Resolve the pending response promise for mid with value.`






---

### Handler: `ErrorHandler`

Purpose:
- Reject pending RPC calls by message id.

Suggested class docstring:
- `Error message handler: rejects pending ReifiedPromise by mid.`






Methods:
- `handle({ client, message })` — reject promise.
  - Suggested docstring: `Reject the pending response promise for mid with error value.`






---

### Class: `ReifiedPromise`

Purpose:
- Make a promise with accessible resolve/reject functions.

Suggested class docstring:
- `Promise wrapper that stores resolve/reject functions for external completion.`






Slots (accessors):
- `promise`, `resolveFn`, `rejectFn`
  - Suggested docstrings:
    - `promise`: `The underlying promise.`





    - `resolveFn`: `Function used to resolve the promise.`





    - `rejectFn`: `Function used to reject the promise.`






Methods:
- `After('init')` — construct promise and store resolvers.
  - Suggested docstring: `Create a promise and capture its resolve/reject functions.`





- `resolve(value)` / `reject(value)` — complete promise.
  - Suggested docstrings:
    - `resolve`: `Resolve the underlying promise with value.`





    - `reject`: `Reject the underlying promise with value.`






---

### Mixin-ish: `MessageDispatcher`

Purpose:
- Maintain a topic->handler map and dispatch messages to the correct handler.

Suggested class docstring:
- `Message dispatcher maintaining a topic->handler map and routing messages by topic.`






Methods:
- `After('init')` — initialize handler map.
  - Suggested docstring: `The handler map for this dispatcher.`





- `registerHandler(handler)` — register by topic.
  - Suggested docstring: `Teach the system what to do when that topic arrives.`





- `handle(socket, message)` — dispatch by message.topic.
  - Suggested docstring: `Dispatch message to the registered handler for message.topic (logs when missing).`






---

### Data class: `LiveMessage`

Purpose:
- Standard message envelope used by Live RPC and supervision messaging.

Suggested class docstring:
- `Live message envelope (mid/from/to/topic/data) with Clone and JSON support.`






Slots (accessors):
- `mid`, `sent`, `from`, `to`, `topic`, `data`
  - Suggested docstrings:
    - `mid`: `Unique message id used for correlating responses.`





    - `sent`: `Timestamp or sent marker (reserved).`





    - `from`: `Sender uid.`





    - `to`: `Recipient uid.`





    - `topic`: `Message topic string.`





    - `data`: `Topic-specific payload object.`






---

### Base class: `LiveNode`

Purpose:
- Common node behavior for sending messages, tracking connection state, and logging/muting.

Suggested class docstring:
- `A speaking endpoint on the Live bus: can send messages and choose what not to log.`






Slots (accessors):
- `uid`, `socket`, `connected`, `messageIdCounter`, `mutedTopics`, `mutedRpcMethods`, `mutedMids`
  - Suggested docstrings:
    - `mutedTopics`: `Set of topics suppressed from logging.`





    - `mutedRpcMethods`: `Set of RPC method names suppressed from logging.`





    - `mutedMids`: `Set of message ids suppressed (used to mute RPC responses).`






Methods:
- `genMessageId()` — increment counter.
  - Suggested docstring: `Generate a sequential message id (local counter).`





- `muteTopic(topic)` / `unmuteTopic(topic)` — manage muted topics.
  - Suggested docstring: `Add/remove a topic from the log mute set.`





- `muteRpcMethod(method)` — mute RPC method names.
  - Suggested docstring: `Mute logging for RPC calls to a given method name (also mutes responses).`





- `shouldMuteMessage(message)` — determine mute logic.
  - Suggested docstring: `Whether a message should be suppressed from logging (topics, rpc methods, and correlated responses).`





- `send(message)` — validate, fill defaults, log, send JSON.
  - Suggested docstring: `Send a message: a LiveMessage over the socket (fills from/mid defaults; logs unless muted).`






---

### Client class: `NodeClient`

Purpose:
- Node-side WebSocket client capable of RPC to other services via the supervisor.

Suggested class docstring:
- `Node WebSocket client: connects to supervisor, dispatches messages, and provides serviceProxy RPC calls.`






Slots (accessors):
- `responseMap` — pending response promises keyed by mid.
  - Suggested docstring: `Map from message id to ReifiedPromise for awaiting RPC responses.`






Methods:
- `base()` — class name string.
  - Suggested docstring: `A base identifier for this client (defaults to class name).`





- `checkResponse(id)` — check pending response.
  - Suggested docstring: `The pending response entry for id (or undefined).`





- `waitForResponse(id, timeout=5)` — create ReifiedPromise and set timeout reject.
  - Suggested docstring: `A promise resolving when response for id arrives (rejects after timeout seconds).`





- `connect()` — connect to supervisor, register handlers, handshake.
  - Suggested docstring: `Open a line: to supervisor WebSocket, set up message handlers, and send handshake to master.`





- `register(handle, object)` — (currently sends register message; object unused).
  - Suggested docstring: `Register a handle with the supervisor so other nodes can address it (object currently unused).`





- `serviceProxy(c)` — return proxy that sends rpc and waits for response.
  - Suggested docstring: `An RPC proxy for calling methods on a remote service by handle.`






---

### Service mixin: `EnvService`

Purpose:
- Provide consistent service identity and default health RPC.

Suggested class docstring:
- `Service base mixin: sets uid from SIMULABRA_SERVICE_NAME and provides default health RPC method.`






Behavior/methods:
- `After('init')` — set `uid` from env and mute health.
  - Suggested docstring: `Service uid from env and mute health RPC logs.`





- `health()` (RpcMethod) — default health result.
  - Suggested docstring: `Basic health status object for supervisor checks.`





- `waitForService({name,...})` — poll other service health.
  - Suggested docstring: `Wait for another service to become reachable by repeatedly calling its health RPC.`






---

### Data class: `ServiceSpec`

Purpose:
- Configure a managed service (command, restart/health policies).

Suggested class docstring:
- `Service specification: command, restart policy, and health-check settings for supervisor management.`






Slots (accessors):
- `serviceName`, `command`, `restartPolicy`, `maxRestarts`, `healthCheckMethod`, `healthCheckEnabled`
  - Suggested docstrings:
    - `restartPolicy`: `Restart policy: always, on_failure, or never.`





    - `maxRestarts`: `Maximum consecutive restarts before supervisor gives up.`






---

### Class: `NodeRegistry`

Purpose:
- Maintain the set of connected nodes keyed by service name.

Suggested class docstring:
- `Registry mapping service names to connected NodeClient instances.`






Methods:
- `After('init')` — initialize node map.
  - Suggested docstring: `Node registry storage.`





- `register(name, node)` — add.
  - Suggested docstring: `Introduce a node to the registry so messages can find it by name.`





- `unregister(name)` — remove.
  - Suggested docstring: `Remove and return the node registered under name (if any).`





- `get(name)` — get node.
  - Suggested docstring: `The node registered under name.`





- `findBySocket(socket)` — reverse lookup.
  - Suggested docstring: `Find {name,node} for a given socket by scanning registry.`





- `isConnected(name)` — connected predicate.
  - Suggested docstring: `Whether a node is present for name and it is connected.`





- `all()` — entries.
  - Suggested docstring: `Object.entries(nodes) for all registered nodes.`






---

### Class: `HealthCheck`

Purpose:
- Perform RPC health checks for managed services.

Suggested class docstring:
- `Performs RPC-based health checks against managed services with timeout handling.`






Methods:
- `check(managed)` — check a service and return `{healthy, reason?, skipped?}`.
  - Suggested docstring: `Check health of a managed service via RPC and return a structured result.`






---

### Class: `ManagedService`

Purpose:
- Track runtime state for a spawned service process and implement restart/backoff and health state transitions.

Suggested class docstring:
- `Runtime state for a supervisor-managed service process (spawn/stop/restart, backoff, health transitions).`






Methods:
- `start()` — spawn process with logs, env, and exit handler.
  - Suggested docstring: `Spawn the service process with log redirection and supervisor env, installing onExit handler.`





- `onExit(exitCode, signalCode, error)` — handle exit, mark unhealthy, restart with backoff per policy.
  - Suggested docstring: `Handle process exit: update health, apply restart policy, and restart with backoff when allowed.`





- `shouldRestart(exitCode)` — policy decision.
  - Suggested docstring: `Whether the service should restart based on restartPolicy and exit code.`





- `stop()` — mark stopped and kill process.
  - Suggested docstring: `Stop managing this service and kill its process if running.`





- `resetBackoff()` — reset state after healthy.
  - Suggested docstring: `Reset restart backoff and counters after a successful recovery.`





- `markHealthy()` / `markUnhealthy(reason)` — health transitions.
  - Suggested docstrings:
    - `markHealthy`: `Mark service as healthy and reset failure counters/backoff if transitioning from unhealthy.`





    - `markUnhealthy`: `Mark service as unhealthy, increment failure counters, and record reason.`






---

### Handler: `HandshakeHandler`

Purpose:
- Handle `handshake` messages from nodes, register them, and mark managed service healthy.

Suggested class docstring:
- `Handshake handler: register newly connected service node and mark managed service healthy.`






Methods:
- `handle({ master, message, socket })` — register node and connect handlers.
  - Suggested docstring: `Register a connected service node for message.from and mark corresponding ManagedService healthy.`






---

### Class: `Supervisor`

Purpose:
- Central orchestrator: accept service connections, route messages, manage service processes, and expose UI RPC bridging.

Suggested class docstring:
- `The master node: routes messages, spawns services, and keeps them healthy.`






Methods:
- `After('init')` — initialize registries/logs, register handlers, ensure logs dir.
  - Suggested docstring: `Supervisor state (registries, handlers, logs directory and file).`





- `registerHandler(handler)` — register by topic.
  - Suggested docstring: `Teach the system what to do when that topic arrives.`





- `writeLog(message)` — append supervisor log line.
  - Suggested docstring: `Append a timestamped line to the supervisor log file.`





- `nodes()` — compatibility alias for registry nodes.
  - Suggested docstring: `Node registry map (compatibility access).`





- `node(name)` — get node.
  - Suggested docstring: `The registered node for service name.`





- `serviceProxy({name,...})` — wait/retry and return node proxy.
  - Suggested docstring: `An RPC proxy for a service, retrying while it connects (exponential backoff).`





- `waitForService({name,...})` / `waitForAllServices({timeoutMs,...})` — connection waits.
  - Suggested docstring: `Wait for one/all services to connect within timeout (polling node registry).`





- `registerService(spec)` — register spec.
  - Suggested docstring: `Tell the supervisor about a service so it can be started and watched.`





- `handleUiRpc(socket, request)` — bridge UI WebSocket RPC into service RPC.
  - Suggested docstring: `Handle UI-originated RPC by forwarding to service RPC and replying with {callId,result|error}.`





- `serve()` — Bun.serve websocket and optional HTTP router.
  - Suggested docstring: `Start Bun.serve WebSocket server for node/UI connections and delegate HTTP to httpRouter.`





- `routeMessage(message, socket)` — route to target node or return error to sender.
  - Suggested docstring: `Route a LiveMessage to its recipient node or send an error back to sender when missing.`





- `startAll()` — spawn all registered services.
  - Suggested docstring: `Create ManagedService instances for registered specs and start each service process.`





- `stopAll()` — stop all.
  - Suggested docstring: `Stop all managed services and mark supervisor not running.`





- `waitForExit(timeoutMs=5000)` — wait, force kill if needed.
  - Suggested docstring: `Wait for managed processes to exit within timeout; force kill remaining processes if needed.`





- `healthCheckLoop()` — periodic health.
  - Suggested docstring: `Periodically health-check all services via RPC while supervisor is running.`





- `status()` — return status map.
  - Suggested docstring: `A status summary object for all managed services.`






---

## `src/pm.js` — Lightweight Process Manager (CLI + Runner)

### Class: `PMPaths`

Purpose:
- Resolve and create paths for state and logs.

Suggested class docstring:
- `Resolve filesystem paths for PM state and log directories; ensures directories exist.`






Methods:
- `statePath()` / `logPath()` — directory joins.
  - Suggested docstring: `Absolute path to the state/log directory under root.`





- `stateFile(name)` / `lockFile(name)` / `logFile(name)` — file paths.
  - Suggested docstring: `The file path for a service’s state/lock/log file.`





- `ensureDirs()` — mkdir -p for dirs.
  - Suggested docstring: `Ensure state and log directories exist (mkdir -p).`






---

### Class: `PMState`

Purpose:
- Persist per-service runtime state to disk.

Suggested class docstring:
- `Service state persistence record stored as JSON on disk (schema v1).`






Methods:
- `load(path)` (Static) — read JSON to PMState.
  - Suggested docstring: `Load PM state from disk (or return null when missing/invalid).`





- `save(path)` — write file.
  - Suggested docstring: `Save this PMState to disk at path.`





- `toJSON()` — serialize schema.
  - Suggested docstring: `Schema v1 JSON representation of this state.`





- `isAlive()` — check runner pid.
  - Suggested docstring: `Whether runnerPid exists and the process is alive.`





- `effectiveStatus()` — running but dead => stale.
  - Suggested docstring: `Status with stale detection (running + dead runner => stale).`





- `uptime()` — ms uptime when running.
  - Suggested docstring: `Uptime in ms when running; otherwise null.`






---

### Class: `PMService`

Purpose:
- Validate and normalize a service definition from config.

Suggested class docstring:
- `Validated service definition (name, command, cwd, env, stop policy).`






Methods:
- `After('init')` — validate name/command.
  - Suggested docstring: `Validate serviceName format and require a non-empty command array.`





- `fromConfig(config)` (Static) — build from config entry.
  - Suggested docstring: `A PMService from a config object entry.`






---

### Class: `PMRegistry`

Purpose:
- Load a list of services from a JS config file and provide lookup.

Suggested class docstring:
- `Loads PMService definitions from a config module and provides lookup and listing.`






Methods:
- `load(configPath)` (Static) — dynamic import config.
  - Suggested docstring: `Load service definitions from the config module.`





- `get(name)` / `all()` / `names()` — accessors.
  - Suggested docstrings:
    - `get`: `Service definition by name (or undefined).`





    - `all`: `All service definitions.`





    - `names`: `All service names.`






---

### Class: `PMRunner`

Purpose:
- Run a single service as a child process, record state, and forward logs.

Suggested class docstring:
- `Per-service runner: spawns child process, writes logs/state, and handles graceful shutdown.`






Methods:
- `start()` — init state/log and spawn.
  - Suggested docstring: `Start runner: write initial state, open log, set signal handlers, spawn child process.`





- `openLog()` — create file writer.
  - Suggested docstring: `Open service log file writer for the current state logFile.`





- `writeLog(message)` — write timestamped line.
  - Suggested docstring: `Write a timestamped message line to the service log.`





- `writeState()` — persist current state file.
  - Suggested docstring: `Persist the current PMState to its state file.`





- `spawnChild()` — spawn Bun child, pipe outputs, await exit.
  - Suggested docstring: `Spawn the service child process, pipe stdout/stderr to log, and handle exit.`





- `pipeOutput(stream, label)` — read stream and log lines.
  - Suggested docstring: `Read a stream and write each line to log with a label prefix.`





- `handleChildExit(exitCode)` — update state and exit runner.
  - Suggested docstring: `Handle child exit: update state, close log, and exit runner unless shutting down.`





- `setupSignalHandlers()` — graceful shutdown with stop policy.
  - Suggested docstring: `Install SIGTERM/SIGINT handlers to gracefully stop child with timeout and optional SIGKILL.`






---

### Class: `PMController`

Purpose:
- Implement CLI operations (list/start/stop/restart/logfile) based on registry and state files.

Suggested class docstring:
- `PM CLI controller: list/start/stop/restart services and locate log files via persisted state.`






Methods:
- `After('init')` — ensure paths.
  - Suggested docstring: `Default PMPaths when none provided.`





- `loadRegistry()` — load config once.
  - Suggested docstring: `Load and cache the service registry (so subsequent calls reuse it).`





- `list(options={})` — return JSON or formatted table.
  - Suggested docstring: `List services with status/pid/uptime; return JSON when options.json is true.`





- `formatUptime(ms)` — helper.
  - Suggested docstring: `Format uptime milliseconds into a short human string.`





- `start(name, options={})` — start via detached pm-runner.
  - Suggested docstring: `Start a service via detached pm-runner, using a lock file to prevent double-start.`





- `stop(name, options={})` — stop via runner pid, optional force.
  - Suggested docstring: `Stop a running service by signaling its runner and waiting up to timeout (optionally force kill).`





- `restart(name, options={})` — stop then start.
  - Suggested docstring: `Restart a service by stopping it then starting it again.`





- `logfile(name)` — return log file path.
  - Suggested docstring: `The log file path for a service (from state when available).`

