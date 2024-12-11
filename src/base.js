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

  Object.prototype.display = function display() {
    return simulabra_display(this);
  }

  function debug(...args) {
    let __ = globalThis.SIMULABRA;
    if (__.$$DebugClass) {
      __.$$DebugClass.log(...args);
    } else {
      console.log(...args.map(a => simulabra_display(a)));
    }
  }

  class Frame {
    constructor(receiver, Method_impl, args) {
      this._receiver = receiver;
      this._MethodImpl = Method_impl;
      this._args = args;
    }
    description() {
      return `${pry(this._receiver)}.${this._MethodImpl._name}(${this._args.length > 0 ? this._args.map(a => pry(a)).join('') : ''})`;
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
              debug('failed message: call', self._name, 'on', this._class._name);
              //__._stack.trace();
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
        if (target[p] !== undefined) {
          return target[p];
        } else if (p[0] === '_') {
          return undefined; // default? nullable?
        } else if (p[0] === '$') {
          return globalThis.SIMULABRA.mod().getInstance(receiver, p.slice(1));
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
      this._proto = DebugProto(parent);
      this._proto._class = parent;
    }

    _reify() {
      for (const impl of Object.values(this._impls)) {
        impl.reify(this._proto);
      }
    }

    _add(name, op) {
      op.combine(this._getImpl(name));
    }

    _getImpl(name) {
      if (!this._impls.hasOwnProperty(name)) {
        this._impls[name] = new MethodImpl({ _name: name });
      }
      return this._impls[name];
    }

    description() {
      return `!ClassPrototype#${this._proto._class.name()}`;
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
      return other === BVar || other === $Var;
    }
    name() {
      return this._name;
    }
    uri() {
      return `simulabra://localhost/bVar/${this._name}`;
    }
    title() {
      return `!bVar#${this._name}`;
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
      return typeof this._desc.default === 'function' ? this._desc.default.apply(this) : this._desc.default;
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
        return 'simulabra://localhost/NativeClasses/function';
      },
      title() {
        return '~NativeClass#function';
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

  const ClassDef = {
    class() {
      return this._class;
    }
  }

  const $BaseSlots = [
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
      for (const slot of this.class().slots()) {
        if (slot.class()._fullSlot) {
          slot.initInstance(this);
        }
      }
    },
    function description(seen) { //TODO: add depth
      const Vars = this.state().filter(v => v.value() !== v.ref().defval());
      const VarDesc = Vars.length > 0 ? `{\n${Vars.map(vs => ' ' + vs?.description(seen)).join('\n')}\n}` : '';
      return `${this.class().description(seen)}#${this.ident()}${VarDesc}`;
    },
    function toString() {
      return this.description();
    },
    function state() {
      return this.class().Vars().map(ref => {
        const value = this[`_${ref.name()}`];
        if (value !== undefined) {
          return $VarState.new({ ref, value });
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
    function ident() {
      return `${this.id()}${this.name() ? `(${this.name()})` : ''}`;
    },
    function uri() {
      return `simulabra://localhost/${this.class().name()}/${this.id()}`;
    },
    function log(...args) {
      $Debug?.log(this.title(), ...args.map(a => simulabra_string(a)));
    },
    function dlog(...args) {
      if ($Debug && this.class().debug()) {
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
    function json() {
      return this.class().jsonify(this);
    },
    ClassDef.class,
    BVar.new({ name: 'name' }),
    BVar.new({ name: 'id' }),
    BVar.new({ name: 'src_line' }),
    BVar.new({ name: 'observers' }),
  ];

  // const $base_proto = {};
  // manload($BaseSlots, $base_proto);

  Array.prototype.load = function (target) {
    this.forEach(it => it.load(target));
  }

  const $ClassSlots = [
    function init() {
      this.events([]);
      $BaseSlots[0].apply(this);
      this.id_ctr(0);
      this.proto(new ClassPrototype(this));
      $BaseSlots.load(this.proto());
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
    function initInstance(inst) {
      for (const slot of this.slots()) {
        if (slot.class()._fullSlot) {
          slot.initInstance(inst);
        }
      }
    },
    function description() {
      return `$.${this.name()}`;
    },
    function toString() {
      return this.description();
    },
    function descended(target) {
      return this.name() === target.name() || !!this.slots().find(c => c.class() !== BVar && c.class().name() === 'Class' && c.descended(target));
    },
    function title() {
      return `$.Class#${this.name()}`;
    },
    function instances() {
      const mods = globalThis.SIMULABRA.base().instances($.Module);
      const instances = mods.map(m => m.instances(this)).flat();
      return instances;
    },
    function superClasses() {
      let res = [];
      for (const slot of this.slots()) {
        if (typeof slot !== 'string' && slot.isa($Class)) {
          res = [slot, ...slot.superClasses(), ...res];
        }
      }
      return res;
    },
    function proxied(ctx) {
      return this;
    },
    function Vars(visited = new Set()) {
      if (visited.has(this)) return [];
      visited.add(this);

      let Vars = [];
      for (const slot of this.slots()) {
        if (typeof slot === 'function') {
          // skip
        } else if (slot.class() === BVar || slot.isa($Var)) {
          Vars.push(slot);
        } else if (slot.isa($Class)) {
          Vars = [...Vars, ...slot.Vars()];
        }
      }
      return Vars;
    },
    function genid() {
      let id = this.id_ctr();
      this.id_ctr(id + 1);
      return id;
    },
    function jsonify(object) {
      const json = {};
      for (const slot of this.slots()) {
        if (slot._json) {
          json[slot._name] = JSON.parse(JSON.stringify(object[slot._name]()));
        }
      }
      return json;
    },
    function getslot(name) {
      for (const slot of this.slots()) {
        if (slot.class().descended($.Class)) {
          const recur = slot.getslot(name);
          if (recur) {
            return recur;
          }
        } else if (slot._name === name) {
          return slot;
        }
      }
      return null;
    },
    BVar.new({ name: 'name' }),
    BVar.new({ name: 'fullSlot', default: false }),
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

  const $ClassProto = new ClassPrototype();
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
  $ClassSlots.push(newObj.new);

  manload($BaseSlots, $ClassProto);
  manload($ClassSlots, $ClassProto);
  $ClassProto._reify();
  const $Class = Object.create($ClassProto._proto);
  $Class._class = $Class;
  $Class._name = 'Class';
  $Class._fullSlot = true;
  $Class.proto($Class);
  $Class.slots($ClassSlots);
  $Class.init();

  const $base_proto = new ClassPrototype($Class);
  manload($BaseSlots, $base_proto);
  manload($ClassSlots, $base_proto);
  $base_proto._reify();
  const $base = Object.create($base_proto._proto);
  $base._class = $Class;
  $base._name = 'base';
  $base.init();

  // a missing middle
  var $Var = $Class.new({
    name: 'Var',
    slots: [
      BVar.new({ name: 'name', }),
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
        return this.debug() || $Debug.debug();
      },
      function combine(impl) {
        const pk = '_' + this.name();
        const self = this;
        impl._primary = function mutableAccess(assign, update = true) {
          if (assign !== undefined) {
            this[pk] = assign;
            if (self.observable() && update) {
              const ev = new Event('update');
              ev._Var = self;
              ev._value = assign;
              ev._target = this;
              this.dispatchEvent(ev); // best there is?
            }
            if (self._trace) {
              self.log('muted to', assign);
            }
          } else if (!(pk in this)) {
            this[pk] = self.defval(this);
          }
          return this[pk];
        };
        impl._direct = true;
      },
      function initInstance(inst) {
      }
    ]
  });

  const $Fn = $Class.new({
    name: 'Fn',
    slots: [
      $Var.new({ name: 'do' }), // fn, meat and taters
    ]
  });

  const $Static = $Class.new({
    name: 'Static',
    slots: [
      $Fn,
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

  const $fake_state = $Class.new({
    name: 'fake_state',
    slots: [
      $Static.new({
        name: 'list_from_map',
        do: function list_from_map(map) {
          const list = Object.entries(map).map(([k, v]) => this.new({ name: k, value: v }));
          this.log(list);
          return list;
        }
      }),
      $Var.new({ name: 'value' }),
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

  const $VarState = $Class.new({
    name: 'VarState',
    slots: [
      $Var.new({ name: 'ref' }),
      $Var.new({ name: 'value' }),
      function kv() {
        return [this.ref().name(), this.value()];
      },
      function description(seen) {
        let d;
        if (this.value()?.title instanceof Function) {
          d = this.value().title();
        } else if (!this.ref().debug()) {
          d = `<hidden>`;
        } else {
          d = simulabra_string(this.value(), seen);
        }
        return `:${this.ref().name()}=${d}`;
      }
    ]
  });

  const $Method = $Class.new({
    name: 'Method',
    slots: [
      $Fn,
      $Var.new({ name: 'message' }),
      $Var.new({ name: 'name' }),
      $Var.new({ name: 'override', default: false }),
      $Var.new({ name: 'debug', default: true }),
      function combine(impl) {
        if (impl._name !== this.name()) {
          throw new Error('tried to combine Method on non-same named impl');
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

  const $Before = $Class.new({
    name: 'Before',
    slots: [
      $Fn,
      $Var.new({ name: 'name' }),
      function combine(impl) {
        impl._befores.push(this.do());
      }
    ]
  });

  const $After = $Class.new({
    name: 'After',
    slots: [
      $Fn,
      $Var.new({ name: 'name' }),
      function combine(impl) {
        impl._afters.push(this.do());
      }
    ]
  });


  const $Virtual = $Class.new({
    name: 'Virtual',
    slots: [
      $Var.new({ name: 'name' }),
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

  const $ObjectRegistry = $Class.new({
    name: 'ObjectRegistry',
    slots: [
      $Var.new({ name: 'classInstances', default: () => ({}) }),
      $Var.new({ name: 'refs', default: () => ({}) }),
      function register(o) {
        this.addInstance(o);
        const u = o.uri();
        this.refs()[u] = new WeakRef(o);
      },
      function deref(u) {
        return this.refs()[u]?.deref();
      },
      function addInstance(obj) {
        for (const cls of [obj.class(), ...obj.class().superClasses()]) {
          const ClassName = cls.name();
          if (this.classInstances()[ClassName] === undefined) {
            this.classInstances()[ClassName] = [];
          }
          this.classInstances()[ClassName].push(obj.uri());
        }
      },
      function instances(cls) {
        return (this.classInstances()[cls.name()] ?? []).map(u => this.deref(u)).filter(o => o !== undefined);
      },
    ]
  });

  const $Deffed = $Class.new({
    name: 'Deffed',
    slots: [
      $After.new({
        name: 'init',
        do() {
          $$().mod()?.def(this.name(), this);
        }
      })
    ]
  });

  const $registered = $Class.new({
    name: 'registered',
    slots: [
      $After.new({
        name: 'init',
        do() {
          $$().mod()?.register(this);
        }
      })
    ]
  });

  const $module = $Class.new({
    name: 'Module',
    // debug: true,
    slots: [
      $Deffed,
      $Var.new({ name: 'name' }),
      $Var.new({
        name: 'imports',
        desc: 'the other modules available within this one',
        default: [],
        debug: false,
      }),
      $Var.new({ name: 'on_load' }),
      $Var.new({ name: 'registry' }),
      $Var.new({ name: 'parent' }),
      $Var.new({ name: 'doc', default: '-' }),
      $Var.new({ name: 'loaded', default: false }),
      $Var.new({ name: 'repos', default: () => ({}) }),
      $Var.new({ name: 'classes', default: () => [] }),
      $Before.new({
        name: 'init',
        do: function init() {
          this.registry($ObjectRegistry.new());
          if (!this.parent()) {
            this.parent(__.mod());
          }
        }
      }),
      function instances(cls) {
        const thisInstances = this.registry()?.instances(cls) ?? [];
        const parentInstances = this.parent()?.instances(cls) ?? [];
        return [...thisInstances, ...parentInstances];
      },
      function getInstance(cls, nameOrId) {
        return this.instances(cls).find(i => i.id() == nameOrId || i.name() == nameOrId);
      },
      function register(obj) {
        return this.registry()?.register(obj);
      },
      function repo(ClassName) {
        return this.repos()[ClassName] || {};
      },
      function find(ClassName, name) {
        // totally dies to recursion!
        const v = this.repo(ClassName)[name];
        if (v) {
          return v;
        } else {
          for (let imp of this.imports()) {
            const iv = imp.find(ClassName, name);
            if (iv) {
              return iv;
            }
          }
          return undefined;
        }
      },
      function proxy(ClassName, errFn) {
        return new Proxy(this, {
          get(target, p) {
            if (p === 'then' || p === 'format') {
              return target[p];
            }
            const v = target.find(ClassName, p);
            if (v === undefined) {
              // target.log(target.repo(ClassName))
              const err = new Error(`failed to find ~${ClassName}#${p}`);
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
        const ClassName = obj.class().name();
        // const ClassName = 'Class';
        // this.log('def', ClassName, name);
        if (!this.repos().hasOwnProperty(ClassName)) {
          this.repos()[ClassName] = {};
        }
        this.repos()[ClassName][name] = obj;
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
          await this.on_load().apply(this, [this, this.proxy('Class')]);
          $$().mod(om);
        }
        return this;
      },
      function $() {
        return this.proxy('Class');
      }
    ]
  });

  var _ = $module.new({
    name: 'base',
    registry: $ObjectRegistry.new(),
    doc: 'simulabra core system Classes'
  });
  var $ = _.proxy('Class');
  __._mod = _;
  const INTRINSICS = [
    $base,
    $Class,
    $Var,
    $Fn,
    $Method,
    $Static,
    $VarState,
    $Virtual,
    $Before,
    $After,
    $ObjectRegistry,
    $module,
    $Deffed,
  ];

  INTRINSICS.forEach(it => {
    _.def(it.name(), it);
    _.register(it);
  });

  _.register(_);
  $.Class.new({
    name: 'StaticVar',
    slots: [
      $.Var,
      $.After.new({
        name: 'load',
        do: function load() {
          this._getImpl(this.name()).reify(this._proto._class);
        }
      })
    ]
  });

  $.Class.new({
    name: 'SimulabraGlobal',
    slots: [
      $.Var.new({ name: 'mod' }),
      $.Var.new({ name: 'modules', default: {} }),
      $.Var.new({ name: 'stack', debug: false }),
      $.Var.new({ name: 'debug', default: true }),
      $.Var.new({ name: 'trace', default: true }),
      $.Var.new({ name: 'tick', default: 0 }),
      $.Var.new({ name: 'handlers', default: {} }),
      $.Var.new({ name: 'registry' }),
      function startTicking() {
        setInterval(() => {
          this.tick(this.tick() + 1);
        }, 16);
      },
      function jsNew(ClassName, ...args) {
        const obj = new globalThis[ClassName](...args);
        return obj;
      },
      function jsGet(obj, p) {
        return obj[p];
      },
      function $() {
        return this.mod().proxy('Class');
      },
      function base() {
        return _;
      },
      function register(o) {
        return this.registry().register(o);
      },
      function tryCall(obj, missingFn) {
        return new Proxy({}, {
          get(target, p, receiver) {
            if (obj !== undefined && obj[p] !== undefined) {
              return function(...args) {
                return obj[p].apply(obj, args);
              }
            } else {
              return function(...args) {
                return missingFn.apply(obj, args);
              }
            }
          }
        });
      },
    ]
  });

  __ = $.SimulabraGlobal.new({
    stack: new FrameStack(),
    mod: _,
    baseMod: _,
    bootstrapped: true,
    registry: $.ObjectRegistry.new(),
  });

  __.addEventListener('log', e => console.log(...e.args));

  globalThis.SIMULABRA = __;

  var $Debug = $Class.new({
    name: 'Debug',
    slots: [
      $Static.new({
        name: 'log',
        do: function log(...args) {
          // const stack = (new Error).stack;
          // const source = stack.split('\n')[2];
          $$().dispatchEvent({ type: 'log', args });
          return this;
        }
      }),
      $Static.new({
        name: 'format',
        do: function format(...args) {
          return args.map(a => simulabra_display(a));
        }
      }),
    ]
  });

  __.$$DebugClass = $Debug;
  __.startTicking();

  [
    ...INTRINSICS,
    $.StaticVar,
    $.ObjectRegistry,
    $.SimulabraGlobal,
  ].forEach(it => __.register(it));

  $.Class.new({
    name: 'EnumVar',
    slots: [
      $.Var,
      $.Var.new({
        name: 'choices',
        required: true
      }),
      $.After.new({
        name: 'init',
        do: function after__init() {
          const def = this.default();
          if (def !== undefined && !this.choices().includes(def)) {
            throw new Error(`Invalid default value ${def} for choices ${this.choices().join(', ')}`);
          }
        }
      }),

      $.Method.new({
        name: 'combine',
        do: function combine(impl) {
          const pk = '_' + this.name();
          const self = this;

          impl._primary = function enumAccess(assign, update = true) {
            if (assign !== undefined) {
              if (!self.choices().includes(assign)) {
                throw new Error(`Invalid enum value '${assign}' for ${self.name()}. Valid choices are: ${self.choices().join(', ')}`);
              }

              this[pk] = assign;
              if (self.observable() && update) {
                const ev = new Event('update');
                ev._Var = self; 
                ev._value = assign;
                ev._target = this;
                this.dispatchEvent(ev);
              }
              if (self._trace) {
                self.log('mutated to', assign);
              }
            } else if (!(pk in this)) {
              this[pk] = self.defval(this);
            }
            return this[pk];
          };

          impl._direct = true;
        }
      }),

      $.Method.new({
        name: 'defval',
        do: function defval(ctx) {
          const def = this.default();
          if (def !== undefined) {
            if (!this.choices().includes(def)) {
              throw new Error(
                `Invalid default enum value '${def}' for ${this.name()}. Valid choices are: ${this.choices().join(', ')}`
              );
            }
          }
          return def;
        }
      })
    ]
  });

  $.Class.new({
    name: 'AutoVar',
    fullSlot: true,
    slots: [
      $.Var,
      $.Var.new({
        name: 'autoFunction',
        required: true
      }),
      $.Method.new({
        name: 'defval',
        do: function defval() {
          return this.autoFunction().apply(this);
        }
      }),
      $.After.new({
        name: 'initInstance',
        override: true,
        do: function initInstance(inst) {
          inst[this.name()](this.autoFunction().apply(inst));
        }
      }),
    ]
  });

  $.Class.new({
    name: 'event',
    slots: [
      $.Fn,
      $.Var.new({ name: 'type' }),
      $.Var.new({ name: 'do' }),
      function load(proto) {
        proto._proto._class.events().push(this);
      }
    ]
  });

  $.Class.new({
    name: 'primitive',
    slots: [
      $.Class,
      $.Deffed,
      $.Var.new({ name: 'slots', default: [] }),
      $.Var.new({ name: 'js_prototype' }),
      $.Var.new({ name: 'methods', default: {} }),
      $.Var.new({ name: 'name' }),
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

  $.Class.new({
    name: 'proc',
    slots: [
      $.Fn,
      $.Deffed,
      function proxied(ctx) {
        return this.do().bind(ctx);
      }
    ]
  });


  $.primitive.new({
    name: 'object_primitive',
    js_prototype: Object.prototype,
  });

  // Object.prototype.Class = function() {
  //   return $.object_primitive;
  // }

  $.primitive.new({
    name: 'string_primitive',
    js_prototype: String.prototype,
    slots: [
      $.Method.new({
        name: 'class',
        do() {
          return _.proxy('primitive').string_primitive;
        },
      }),
      function description() {
        return this;
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
      $Method.new({
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
      $Method.new({
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

  $.Class.new({
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
      $Method.new({
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

  $.Class.new({
    name: 'Command',
    slots: [
      $.Virtual.new({ name: 'run' }),
      $.Method.new({
        name: 'dispatchTo',
        do: function dispatchTo(o) {
          o.dispatchEvent({
            type: 'command',
            target: this,
          });
        }
      }),
    ],
  });

  return _;
}

const base = bootstrap();

export default base;
