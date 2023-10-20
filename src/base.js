function bootstrap() {
  let __ = globalThis.SIMULABRA;
  if (__?._bootstrapped) {
    return __.base();
  }
  console.log('~%~%~%~%~%~%~%~%~%~%~%~%~%~%~%~%~%~%~');
  console.log('STARTING SIMULABRA: INFINITE SOFTWARE');
  globalThis.SIMULABRA = {
    debug() {
      return true;
    },
    mod() {
      return this._mod;
    },
    trace() {
      return true;
    },
    register(o) {
      const u = o.uri();
      this._tracked[u] = {};
      this._objects.set(this._tracked[u], o);
    },
    stack() {
      return [];
    },
    _tracked: {},
    _objects: new WeakMap(),
  };
  __ = globalThis.SIMULABRA;


  function simulabra_display(obj) {
    if (typeof obj === 'string') {
      return obj;
    } else {
      return simulabra_string(obj);
    }
  }
  function simulabra_string(obj, seen = new Set()) {
    if (seen.has(obj)) {
      return "*circ*";
    }
    seen.add(obj);
    if (obj === undefined || obj === null) {
      return '' + obj;
    } else if (Object.getPrototypeOf(obj) === ClassPrototype) {
      return '#proto ' + obj._name || '?';
    } else if (typeof obj.description === 'function') {
      return obj.description(seen);
    } else if (typeof obj === 'object') {
      const ps = [];
      for (const [k, v] of Object.entries(obj)) {
        ps.push(`:${k}=${simulabra_string(v, seen)}`)
      }
      return '{' + ps.join(' ') + '}';
    } else {
      return obj.toString();
    }
  }

  function debug(...args) {
    let __ = globalThis.SIMULABRA;
    if (__.$$debug_class) {
      __.$$debug_class.log(...args);
    } else {
      console.log(...args.map(a => simulabra_display(a)));
    }
  }

  class Frame {
    constructor(receiver, method_impl, args) {
      this._receiver = receiver;
      this._method_impl = method_impl;
      this._args = args;
    }
    description() {
      return `${pry(this._receiver)}.${this._method_impl._name}(${this._args.length > 0 ? this._args.map(a => pry(a)).join('') : ''})`;
    }
  }

  function pry(obj) {
    if (typeof obj === 'object' && obj.title instanceof Function) {
      return obj.title();
    } else if (typeof obj === 'string') {
      return obj;
    } else {
      return `#native/${typeof obj}#${obj.toString()}`;
    }
  }

  function $$() {
    return globalThis.SIMULABRA;
  }

  class FrameStack {
    constructor() {
      this._frames = [];
    }
    push(frame) {
      this._frames.push(frame);
      return this;
    }
    pop() {
      const frame = this._frames.pop();
      return frame;
    }
    idx() {
      return this._frames.length - 1;
    }
    frame() {
      return this._frames[this.idx()];
    }
    trace() {
      for (let i = 0; i < this._frames.length; i++) {
        debug('stack frame', i, this._frames[i]);
      }
    }
    description() {
      return 'FrameStack';
    }
  }

  class MethodImpl {
    constructor(props) {
      const defaults = {
        _name: '',
        _primary: null,
        _befores: [],
        _afters: [],
        _debug: true,
        _next: null,
      };
      Object.assign(this, defaults);
      Object.assign(this, props);
    }
    reify(proto) {
      if (!this._name) {
        throw new Error('tried to reify without a name!');
      }
      const self = this;
      const key = this._name;
      if (!$$()._debug && this._befores.length === 0 && this._afters.length === 0) {
        proto[key] = this._primary;
      } else {
        proto[key] = function (...args) {
          const __ = $$();
          if (self._debug) {
            const frame = new Frame(this, self, args);
            __.stack().push(frame); // uhh
            if (__._trace) {
              console.log('call', frame.description());
            }
          }
          try {
            self._befores.forEach(b => b.apply(this, args));
            let res = self._primary.apply(this, args);
            self._afters.forEach(a => a.apply(this, args)); // res too?
            if (self._debug) {
              __._stack.pop();
            }
            return res;
          } catch (e) {
            if (!e._logged && self._debug) {
              e._logged = true;
              debug('failed message: call', self._name, 'on', this._class, 'with', args);
              __._stack.trace();
            }
            throw e;
          }
        };
      }
    }
  }

  function nativePassthrough(name) {
    return (typeof name === 'symbol') || ['then', 'fetch', 'toSource'].includes(name);
  }

  function DebugProto() {
    return new Proxy({}, {
      get(target, p, receiver) {
        if (p in target) {
          return target[p];
        } else if (p[0] === '_') {
          return undefined; // default? nullable?
        } else if (nativePassthrough(p)) {
          return target[p];
        }
        throw new Error(`not found: ${p} on ${receiver.title()}`);
      }
    });
  }

  class ClassPrototype {
    constructor(parent) {
      this._impls = {};
      this._proto = DebugProto();
      this._proto._class = parent;
    }

    _reify() {
      for (const impl of Object.values(this._impls)) {
        impl.reify(this._proto);
      }
    }

    _add(name, op) {
      op.combine(this._get_impl(name));
    }

    _get_impl(name) {
      if (!this._impls.hasOwnProperty(name)) {
        this._impls[name] = new MethodImpl({ _name: name });
      }
      return this._impls[name];
    }

    description() {
      return `!class-prototype#${this._proto._class.name()}`;
    }
  }

  class BVar {
    constructor({ name, ...desc }) {
      this._name = name;
      this._desc = desc;
    }
    static new(args) {
      return new this(args);
    }
    static descended(other) {
      return other === BVar || other === $var;
    }
    name() {
      return this._name;
    }
    uri() {
      return `simulabra://localhost/bvar/${this._name}`;
    }
    title() {
      return `!bvar#${this._name}`;
    }
    state() {
      return $fake_state.list_from_map({
        name: this._name,
      });
    }
    load(proto) {
      const key = '_' + this.name();
      const self = this;
      proto._add(self.name(), function (assign) {
        if (assign !== undefined) {
          this[key] = assign;
        } else if (!(key in this)) {
          this[key] = self.defval();
        }
        return this[key];
      });
    }
    defval() {
      return typeof this._desc.default === 'function' ? this._desc.default() : this._desc.default;
    }
    class() {
      return BVar;
    }
    debug() {
      return this._desc.debug || false;
    }
    description() {
      return this.title();
    }
    isa(it) {
      return it === BVar;
    }
  }

  __._stack = new FrameStack();

  Object.prototype._add = function add(name, op) {
    if (!this) return;
    this[name] = op;
  }
  // Object.prototype.eq = function (other) {
  //   return this === other;
  // }
  Function.prototype.load = function (proto) {
    proto._add(this.name, this);
  };
  Function.prototype.combine = function (impl) {
    impl._primary = this;
  };
  Function.prototype.description = function () {
    return `Native Function ${this.name}`;
  }
  Function.prototype.overrides = function () {
    return true;
  }
  Function.prototype.class = function () {
    return {
      descended() {
        return false;
      },
      name() {
        return 'native_function';
      },
      uri() {
        return 'simulabra://localhost/native_classes/function';
      },
      title() {
        return '~native_class#function';
      }
    }
  };
  Function.prototype.isa = function(it) {
    return it.name() === 'function-primitive';;
  };
  Function.prototype.uri = function() {
    return `simulabra://localhost/native_function/${this.name}`;
  };
  Function.prototype.title = function() {
    return `~native_function#${this.name}`;
  };
  Function.prototype.state = function() {
    return $fake_state.list_from_map({
      name: this.name,
      fn: this.toString()
    });
  }
  Number.prototype.description = function () {
    return this.toString();
  };
  Array.prototype.description = function (seen = {}) {
    return `[${this.map(e => e.description(seen)).join(' ')}]`;
  }

  function parametize(props, obj) {
    for (const [k, v] of Object.entries(props)) {
      if (k[0] !== '_') {
        obj['_' + k] = v;
      } else {
        throw new Error('unneeded _');
      }
    }
    return obj;
  }

  function manload(slots, proto) {
    for (const c of slots) {
      c.load(proto);
    }
  }

  const classDef = {
    class() {
      return this._class;
    }
  }

  const $base_slots = [
    function init() {
      // mostly broken
      if (globalThis.SIMULABRA._debug) {
        const stack = (new Error()).stack;
        const line = stack.split('\n')[2];
        this.src_line(line);
      }
      globalThis.SIMULABRA.mod()?.register(this);

      for (const ev of (this.class().events() ?? [])) {
        this.addEventListener(ev.name(), ev.do().bind(this));
      }
    },
    function description(seen) { //TODO: add depth
      const vars = this.state().filter(v => v.value() !== v.var_ref().defval());
      const varDesc = vars.length > 0 ? `{\n${vars.map(vs => ' ' + vs?.description(seen)).join('\n')}\n}` : '';
      return `${this.class().description(seen)}.new${varDesc}`;
    },
    function toString() {
      return this.description();
    },
    function state() {
      return this.class().vars().map(var_ref => {
        const value = this[`_${var_ref.name()}`];
        if (value !== undefined) {
          return $var_state.new({ var_ref, value });
        } else {
          return null;
        }
      }).filter(v => v !== null);
    },
    function me() {
      return this;
    },
    function uid() {
      return this.name() ?? this.id();
    },
    function title() {
      return `${this.class().description()}#${this.uid()}`;
    },
    function uri() {
      return `simulabra://localhost/${this.class().name()}/${this.uid()}`;
    },
    function log(...args) {
      $debug?.log(this.title(), ...args);
    },
    function dlog(...args) {
      if ($debug && this.class().debug()) {
        this.log(...args);
      }
    },
    function load(proto) {
      proto._add(this.name(), this);
    },
    function isa(cls) {
      // this.log('isa', this.class().name(), cls.name());
      return this.class().descended(cls);
    },
    function next(selector, ...args) {
      const fn = this[selector];
      return fn._next.apply(this, args);
    },
    function toJSON() {
      return this;
    },
    function message_observers(message) {
      const observers = this.observers();
      if (!observers) {
        return [];
      }
      return observers[message] ?? [];
    },
    function dispatchEvent(event) {
      for (const ob of this.message_observers(event.type)) {
        ob(event);
      }
    },
    function addEventListener(message, cb) {
      if (this.observers() === undefined) {
        this.observers({});
      }
      if (this.observers()[message] === undefined) {
        this.observers()[message] = [];
      }
      this.observers()[message].push(cb.bind(this));
    },
    classDef.class,
    BVar.new({ name: 'name' }),
    BVar.new({ name: 'id' }),
    BVar.new({ name: 'src_line' }),
    BVar.new({ name: 'observers' }),
  ];

  // const $base_proto = {};
  // manload($base_slots, $base_proto);

  Array.prototype.load = function (target) {
    this.forEach(it => it.load(target));
  }

  const $class_slots = [
    function init() {
      this.events([]);
      $base_slots[0].apply(this);
      this.id_ctr(0);
      this.proto(new ClassPrototype(this));
      $base_slots.load(this.proto());
      this._proto._class = this;
      this.load(this.proto());
      this.proto()._reify();
      $$().mod()?.def(this.name(), this)
    },
    function load(target) {
      for (const v of this.slots()) {
        if (typeof v !== 'string') {
          v.load(target);
        }
      }
    },
    function extend(comp) {
      comp.load(this.proto());
      this.proto()._reify();
    },
    function defaultInitSlot(slot, dval) {
      const pk = '_' + slot;
      if (!(pk in this)) {
        this[pk] = dval;
      }
    },
    function description() {
      return `~${this.name()}`;
    },
    function toString() {
      return this.description();
    },
    function descended(target) {
      return this.name() === target.name() || !!this.slots().find(c => c.class() !== BVar && c.class().name() === 'class' && c.descended(target));
    },
    function title() {
      return `~${this.name()}`;
    },
    function instances() {
      const mods = globalThis.SIMULABRA.base().instances($.module);
      const instances = mods.map(m => m.instances(this)).flat();
      return instances;
    },
    function superclasses() {
      let res = [];
      for (const slot of this.slots()) {
        if (typeof slot !== 'string' && slot.isa($class)) {
          res = [slot, ...slot.superclasses(), ...res];
        }
      }
      return res;
    },
    function proxied(ctx) {
      return this;
    },
    function vars(visited = new Set()) {
      if (visited.has(this)) return [];
      visited.add(this);

      let vars = [];
      for (const slot of this.slots()) {
        if (typeof slot === 'function') {
          // skip
        } else if (slot.class() === BVar || slot.isa($var)) {
          vars.push(slot);
        } else if (slot.isa($class)) {
          vars = [...vars, ...slot.vars()];
        }
      }
      return vars;
    },
    function genid() {
      let id = this.id_ctr();
      this.id_ctr(id + 1);
      return id;
    },
    BVar.new({ name: 'name' }),
    BVar.new({ name: 'proto' }),
    BVar.new({ name: 'id_ctr' }),
    BVar.new({ name: 'events' }),
    BVar.new({
      name: 'slots',
      default: [],
    }),
    BVar.new({
      name: 'debug',
      default: false,
    })
  ];

  const $class_proto = new ClassPrototype(null);
  const newObj = {
    new(props = {}, ...slots) {
      if (!props.hasOwnProperty('slots')) {
        props.slots = slots;
      }
      const obj = Object.create(this.proto()._proto);
      parametize(props, obj);
      obj.id(this.genid());
      obj.init(this);
      return obj;
    }
  };
  $class_slots.push(newObj.new);

  manload($base_slots, $class_proto);
  manload($class_slots, $class_proto);
  $class_proto._reify();
  const $class = Object.create($class_proto._proto);
  $class._class = $class;
  $class._name = 'class';
  $class.proto($class);
  $class.slots($class_slots);
  $class.init();

  const $base_proto = new ClassPrototype(null);
  manload($base_slots, $base_proto);
  manload($class_slots, $base_proto);
  $base_proto._reify();
  const $base = Object.create($base_proto._proto);
  $base._class = $class;
  $base._name = 'base';
  $base.init();

  // a missing middle
  var $var = $class.new({
    name: 'var',
    slots: [
      BVar.new({ name: 'name', }),
      BVar.new({ name: 'mutable', default: true }),
      BVar.new({ name: 'debug', default: true }),
      BVar.new({ name: 'trace', default: false }),
      BVar.new({ name: 'observable', default: true }),
      BVar.new({ name: 'default', }),
      BVar.new({ name: 'default_init', }),
      BVar.new({ name: 'required', }),
      function defval(ctx) {
        if (this.default() instanceof Function) {
          // console.log('fn', this.name());
          // console.log(this.default());
          return this.default().apply(ctx);
        } else {
          return this.default();
        }
      },
      function should_debug() {
        return this.debug() || $debug.debug();
      },
      function combine(impl) {
        const pk = '_' + this.name();
        const self = this;
        if (this.mutable()) {
          impl._primary = function mutableAccess(assign, update = true) {
            if (assign !== undefined) {
              this[pk] = assign;
              if (self.observable() && update) {
                this.dispatchEvent(new Event('update')); // best there is?
              }
              if (self._trace) {
                self.log('muted to', assign);
              }
            } else if (!(pk in this)) {
              this[pk] = self.defval(this);
            }
            return this[pk];
          };
        } else {
          impl._primary = function immutableAccess(self) {
            return function (assign) {
              if (assign !== undefined) {
                throw new Error(`Attempt to set immutable variable ${self.name()} ${pk}`);
              }
              if (!(pk in this)) {
                // should this not be set?
                this[pk] = self.defval(this);
              }
              return this[pk];
            }
          };
        }
        impl._direct = true;
      },
    ]
  });

  const $fn = $class.new({
    name: 'fn',
    slots: [
      $var.new({ name: 'do' }), // fn, meat and taters
    ]
  });

  const $static = $class.new({
    name: 'static',
    slots: [
      $fn,
      function load(proto) {
        const impl = new MethodImpl({ _name: this.name() });
        let fn = this.do();
        if (typeof fn !== 'function') {
          fn = fn.fn();
        }
        impl._primary = fn;
        impl.reify(proto._proto._class);
      }
    ]
  });

  const $fake_state = $class.new({
    name: 'fake_state',
    slots: [
      $static.new({
        name: 'list_from_map',
        do: function list_from_map(map) {
          const list = Object.entries(map).map(([k, v]) => this.new({ name: k, value: v }));
          this.log(list);
          return list;
        }
      }),
      $var.new({ name: 'value' }),
      function kv() {
        return [this.name(), this.value()];
      },
      function description(seen) {
        let d;
        if (this.value().title instanceof Function) {
          d = this.value().title();
        } else {
          d = simulabra_string(this.value(), seen);
        }
        return `:${this.name()}=${d}`;
      }
    ]
  });

  const $var_state = $class.new({
    name: 'var_state',
    slots: [
      $var.new({ name: 'var_ref' }),
      $var.new({ name: 'value' }),
      function kv() {
        return [this.var_ref().name(), this.value()];
      },
      function description(seen) {
        let d;
        if (this.value().title instanceof Function) {
          d = this.value().title();
        } else if (!this.var_ref().debug()) {
          d = `<hidden>`;
        } else {
          d = simulabra_string(this.value(), seen);
        }
        return `:${this.var_ref().name()}=${d}`;
      }
    ]
  });

  const $method = $class.new({
    name: 'method',
    slots: [
      $fn,
      $var.new({ name: 'message' }),
      $var.new({ name: 'name' }),
      $var.new({ name: 'override', default: false }),
      $var.new({ name: 'debug', default: true }),
      function combine(impl) {
        if (impl._name !== this.name()) {
          throw new Error('tried to combine method on non-same named impl');
        }
        let fn = this.do();
        if (typeof fn !== 'function') {
          fn = fn.fn();
        }
        if (impl._primary) {
          fn._next = impl._primary;
          // if (this.override()) {
          //   fn._next = impl._primary;
          // } else {
          //   throw new Error(`invalid override on ${this.title()}!`);
          // }
        }
        impl._primary = fn;
        impl._debug = this.debug();
      },
    ]
  });

  var $debug = $class.new({
    name: 'debug',
    slots: [
      $static.new({
        name: 'log',
        do: function log(...args) {
          // const stack = (new Error).stack;
          // const source = stack.split('\n')[2];
          $$().dispatchEvent({ type: 'log', args });
          return this;
        }
      }),
      $static.new({
        name: 'format',
        do: function format(...args) {
          return args.map(a => simulabra_display(a));
        }
      }),
    ]
  });

  const $before = $class.new({
    name: 'before',
    slots: [
      $fn,
      $var.new({ name: 'name' }),
      function combine(impl) {
        impl._befores.push(this.do());
      }
    ]
  });

  const $after = $class.new({
    name: 'after',
    slots: [
      $fn,
      $var.new({ name: 'name' }),
      function combine(impl) {
        impl._afters.push(this.do());
      }
    ]
  });


  const $virtual = $class.new({
    name: 'virtual',
    slots: [
      $var.new({ name: 'name' }),
      function load(parent) {
        this.dlog('virtual load', this);
        parent[this.name()] = function () { throw new Error(`not implemented: ${this.name()}`); };
        parent[this.name()].virtual = true;
      },
      function overrides() {
        return false;
      },
    ]
  });

  const $object_registry = $class.new({
    name: 'object_registry',
    slots: [
      $var.new({ name: 'class_instances', default: () => ({}) }),
      $var.new({ name: 'refs', default: () => ({}) }),
      function register(o) {
        this.add_instance(o);
        const u = o.uri();
        this.refs()[u] = new WeakRef(o);
      },
      function deref(u) {
        return this.refs()[u]?.deref();
      },
      function add_instance(obj) {
        for (const cls of [obj.class(), ...obj.class().superclasses()]) {
          const className = cls.name();
          if (this.class_instances()[className] === undefined) {
            this.class_instances()[className] = [];
          }
          this.class_instances()[className].push(obj.uri());
        }
      },
      function instances(cls) {
        return (this.class_instances()[cls.name()] ?? []).map(u => this.deref(u)).filter(o => o !== undefined);
      },
    ]
  });

  const $module = $class.new({
    name: 'module',
    // debug: true,
    slots: [
      $var.new({ name: 'name' }),
      $var.new({
        name: 'imports',
        desc: 'the other modules available within this one',
        default: [],
        debug: false,
      }),
      $var.new({ name: 'on_load' }),
      $var.new({ name: 'registry' }),
      $var.new({ name: 'parent' }),
      $var.new({ name: 'loaded', default: false }),
      $var.new({ name: 'repos', default: () => ({}) }),
      $var.new({ name: 'classes', default: () => [] }),
      $before.new({
        name: 'init',
        do: function init() {
          this.registry($object_registry.new());
        }
      }),
      function instances(cls) {
        return this.registry()?.instances(cls) ?? [];
      },
      function register(obj) {
        return this.registry()?.register(obj);
      },
      function repo(className) {
        return this.repos()[className] || {};
      },
      function find(className, name) {
        // totally dies to recursion!
        const v = this.repo(className)[name];
        if (v) {
          return v;
        } else {
          for (let imp of this.imports()) {
            const iv = imp.find(className, name);
            if (iv) {
              return iv;
            }
          }
          return undefined;
        }
      },
      function proxy(className, errFn) {
        return new Proxy(this, {
          get(target, p) {
            if (p === 'then' || p === 'format') {
              return target[p];
            }
            const v = target.find(className, p);
            if (v === undefined) {
              // target.log(target.repo(className))
              const err = new Error(`failed to find ~${className}#${p}`);
              if (errFn) {
                errFn(err);
              } else {
                throw err;
              }
            }

            return v.proxied(this);
          }
        })
      },
      function def(name, obj) {
        // const className = obj.class().name();
        const className = 'class';
        // this.log('def', className, name);
        if (!this.repos().hasOwnProperty(className)) {
          this.repos()[className] = {};
        }
        this.repos()[className][name] = obj;
        this.classes().push(obj);
      },
      async function load() {
        if (!this.loaded() && this.on_load()) {
          this.loaded(true);
          // for (const imp of this.imports()) {
          //   this.log('dynamic import', imp);
          //   await import(`./${imp}.js`);
          // }
          const om = $$().mod();
          $$().mod(this);
          await this.on_load().apply(this, [this, this.proxy('class')]);
          $$().mod(om);
        }
        return this;
      },
      function $() {
        return this.proxy('class');
      }
    ]
  });

  var _ = $module.new({
    name: 'base',
    registry: $object_registry.new(),
  });
  var $ = _.proxy('class');
  __._mod = _;
  const INTRINSICS = [
    $base,
    $class,
    $var,
    $fn,
    $method,
    $static,
    $debug,
    $var_state,
    $virtual,
    $before,
    $after,
    $object_registry,
    $module,
  ];

  INTRINSICS.forEach(it => {
    _.def(it.name(), it);
    _.register(it);
  });

  _.register(_);
  $.class.new({
    name: 'static_var',
    slots: [
      $.var,
      $.after.new({
        name: 'load',
        do: function load() {
          this._get_impl(this.name()).reify(this._proto._class);
        }
      })
    ]
  });

  $.class.new({
    name: 'simulabra_global',
    slots: [
      $.var.new({ name: 'mod' }),
      $.var.new({ name: 'modules', default: {} }),
      $.var.new({ name: 'stack', debug: false }),
      $.var.new({ name: 'debug', default: true }),
      $.var.new({ name: 'trace', default: true }),
      $.var.new({ name: 'tick', default: 0 }),
      $.var.new({ name: 'handlers', default: {} }),
      $.var.new({ name: 'registry' }),
      function start_ticking() {
        setInterval(() => {
          this.tick(this.tick() + 1);
        }, 16);
      },
      function js_new(className, ...args) {
        const obj = new globalThis[className](...args);
        return obj;
      },
      function js_get(obj, p) {
        return obj[p];
      },
      function $() {
        return this.mod().proxy('class');
      },
      function base() {
        return _;
      },
      function register(o) {
        return this.registry().register(o);
      }
    ]
  });

  __ = $.simulabra_global.new({
    stack: new FrameStack(),
    mod: _,
    base_mod: _,
    bootstrapped: true,
    registry: $.object_registry.new(),
  });

  __.addEventListener('log', e => console.log(...e.args));

  globalThis.SIMULABRA = __;
  __.$$debug_class = $debug;
  __.start_ticking();

  [
    ...INTRINSICS,
    $.static_var,
    $.object_registry,
    $.simulabra_global,
  ].forEach(it => __.register(it));

  $.class.new({
    name: 'deffed',
    slots: [
      $.after.new({
        name: 'init',
        do() {
          $$().mod().def(this.name(), this);
        }
      })
    ]
  });

  $.class.new({
    name: 'registered',
    slots: [
      $.after.new({
        name: 'init',
        do() {
          $$().mod().register(this);
        }
      })
    ]
  });

  $.class.new({
    name: 'event',
    slots: [
      $.fn,
      $.var.new({ name: 'type' }),
      $.var.new({ name: 'do' }),
      function load(proto) {
        proto._proto._class.events().push(this);
      }
    ]
  });

  $.class.new({
    name: 'primitive',
    slots: [
      $.class,
      $.deffed,
      $.var.new({ name: 'slots', default: [] }),
      $.var.new({ name: 'js_prototype' }),
      $.var.new({ name: 'methods', default: {} }),
      $.var.new({ name: 'name' }),
      function init() {
        for (let c of this.slots()) {
          c.load(this.js_prototype());
        }
        this.dlog('primitive init', this);
      },
      function descended(cls) {
        return cls === $.primitive;
      },
      function extend(methods) {
        methods.map(m => m.load(this.js_prototype())); // wee-woo!
      },
      function description() {
        return `primitive ${this.name()}`;
      },
    ]
  });

  $.class.new({
    name: 'proc',
    slots: [
      $.fn,
      $.deffed,
      function proxied(ctx) {
        return this.do().bind(ctx);
      }
    ]
  });


  $.primitive.new({
    name: 'object_primitive',
    js_prototype: Object.prototype,
  });

  // Object.prototype.class = function() {
  //   return $.object_primitive;
  // }

  $.primitive.new({
    name: 'string_primitive',
    js_prototype: String.prototype,
    slots: [
      $.method.new({
        name: 'class',
        do() {
          return _.proxy('primitive').string_primitive;
        },
      }),
      function description() {
        return `"${this}"`;
      },
      function to_dom() {
        return document.createTextNode(this);
      }
    ]
  });

  $.primitive.new({
    name: 'boolean_primitive',
    js_prototype: Boolean.prototype,
    slots: [
      $method.new({
        name: 'class',
        do() {
          return _.proxy('primitive').boolean_primitive;
        },
      }),
      function description() {
        return this.toString();
      },
      function to_dom() {
        return document.createTextNode(this.toString());
      },
    ]
  });

  $.primitive.new({
    name: 'number_primitive',
    js_prototype: Number.prototype,
    slots: [
      function to_dom() {
        return document.createTextNode(this.toString());
      },
      $method.new({
        name: 'class',
        do() {
          return _.proxy('primitive').number_primitive;
        },
      }),
      function description() {
        return this.toString();
      },
    ]
  });

  $.class.new({
    name: 'number',
    slots: [
      function primitive() {
        return _.find('primitive', 'number_primitive');
      }
    ]
  });

  $.primitive.new({
    name: 'array_primitive',
    js_prototype: Array.prototype,
    slots: [
      function intoObject() {
        const res = {};
        for (const it of this) {
          res[it.name()] = it;
        }
        return res;
      },
      $method.new({
        name: 'class',
        do() {
          return _.proxy('primitive').array_primitive;
        },
      }),
      function description() {
        return `(${this.map(it => { return simulabra_string(it) ?? '' + it }).join(' ')})`;
      },
      function to_dom() {
        const el = document.createElement('span');
        this.forEach(it => el.appendChild(it.to_dom()));
        return el;
      },
      function last() {
        return this[this.length - 1];
      }
    ]
  });

  $.primitive.new({
    name: 'function_primitive',
    js_prototype: Function.prototype,
    slots: [
      function description(seen = {}) {
        return `<function_primitive ${this.name}>`;
      },
      function wrap(ctx) {
        this._closure = $.closure.new({
          fn: this,
          mod: ctx
        });
        return this;
      },
      function to_dom() {
        return document.createTextNode(`{${this.toString()}}`);
      }
    ]
  });

  $.class.new({
    name: 'command',
    slots: [
      $.virtual.new({ name: 'run' }),
    ],
  });

  return _;
}

const base = bootstrap();

export default base;
