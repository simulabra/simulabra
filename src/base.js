function bootstrap() {
  let __ = globalThis.SIMULABRA;
  if (__?._bootstrapped) {
    return __.base();
  }
//   console.error(`SIMULABRA: INFINITE SOFTWARE
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%`);
  globalThis.SIMULABRA = {
    mod() {
      return this._mod;
    },
    stack() {
      return [];
    },
    display(obj) {
      if (typeof obj === 'string') {
        return obj;
      } else {
        return __.stringify(obj);
      }
    },
    stringify(obj, seen = new Set()) {
      if (seen.has(obj)) {
        return "*circ*";
      }
      seen.add(obj);
      if (obj === undefined || obj === null) {
        return '' + obj;
      } else if (Object.getPrototypeOf(obj) === ClassPrototype) {
        return '#ClassPrototype.' + obj.name || '?';
      } else if (typeof obj.description === 'function') {
        return obj.description(seen);
      } else if (typeof obj === 'object') {
        const ps = [];
        for (const [k, v] of Object.entries(obj)) {
          ps.push(`${k}: ${__.stringify(v, seen)}`)
        }
        return '{' + ps.join(', ') + '}';
      } else {
        return obj.toString();
      }
    }
  };
  __ = globalThis.SIMULABRA;



  function debug(...args) {
    let __ = globalThis.SIMULABRA;
    if (__.$$DebugClass) {
      __.$$DebugClass.log(...args);
    } else {
      console.log(...args.map(a => __.display(a)));
    }
  }

  class Frame {
    constructor(receiver, methodImpl, args) {
      this._receiver = receiver;
      this._methodImpl = methodImpl;
      this._args = args;
    }
    description() {
      return `${pry(this._receiver)}.${this._methodImpl._name}(${this._args.length > 0 ? this._args.map(a => pry(a)).join('') : ''})`;
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

  class SlotImpl {
    constructor(props) {
      const defaults = {
        __name: '',
        __primary: null,
        __befores: [],
        __afters: [],
        __asyncBefores: [],
        __asyncAfters: [],
        __properties: [],
        __debug: true,
        __next: null,
      };
      Object.assign(this, defaults);
      Object.assign(this, props);
    }
    reify(proto) {
      if (!this.__name) {
        throw new Error('tried to reify without a name!');
      }
      const self = this;
      const key = this.__name;
      const hasAsyncModifiers = this.__asyncBefores.length > 0 || this.__asyncAfters.length > 0;
      if (!$$().__debug && this.__befores.length === 0 && this.__afters.length === 0 && !hasAsyncModifiers) {
        proto[key] = this.__primary;
      } else if (hasAsyncModifiers) {
        proto[key] = async function (...args) {
          const __ = $$();
          if (self.__debug) {
            const frame = new Frame(this, self, args);
            __.stack().push(frame);
            if (__.__trace) {
              console.log('call', frame.description());
            }
          }
          try {
            self.__befores.forEach(b => b.apply(this, args));
            for (const b of self.__asyncBefores) {
              await b.apply(this, args);
            }
            let res = await self.__primary.apply(this, args);
            for (const a of self.__asyncAfters) {
              await a.apply(this, args);
            }
            self.__afters.forEach(a => a.apply(this, args));
            if (self.__debug) {
              __.__stack.pop();
            }
            return res;
          } catch (e) {
            if (!e._logged && self.__debug) {
              e._logged = true;
              debug('failed message: call', self.__name, 'on', this.__class.description());
            }
            throw e;
          }
        };
      } else {
        proto[key] = function (...args) {
          const __ = $$();
          if (self.__debug) {
            const frame = new Frame(this, self, args);
            __.stack().push(frame); // uhh
            if (__.__trace) {
              console.log('call', frame.description());
            }
          }
          try {
            self.__befores.forEach(b => b.apply(this, args));
            let res = self.__primary.apply(this, args);
            self.__afters.forEach(a => a.apply(this, args)); // res too?
            if (self.__debug) {
              __.__stack.pop();
            }
            return res;
          } catch (e) {
            if (!e._logged && self.__debug) {
              e._logged = true;
              debug('failed message: call', self.__name, 'on', this.__class.description());
              //__.__stack.trace();
            }
            throw e;
          }
        };
      }

      for (const prop of this.__properties) {
        Object.defineProperty(proto, '_' + prop.name, {
          get() { return this[prop.name](); },
          set(value) { return this[prop.name](value); }
        });
      }
    }
  }

  function nativePassthrough(name) {
    return (typeof name === 'symbol') || ['then', 'fetch', 'toSource'].includes(name);
  }

  class ClassPrototype {
    constructor(parent) {
      this._impls = {};
      this._proto = {};
      this._proto.__class = parent;
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
        this._impls[name] = new SlotImpl({ __name: name });
      }
      return this._impls[name];
    }

    description() {
      return `#ClassPrototype.${this._proto.__class.name}`;
    }
  }

  // bootstrapping the var slot
  class BVar {
    constructor({ name, ...desc }) {
      this.__name = name;
      this.__desc = desc;
    }
    get name() {
      return this.__name;
    }
    static new(args) {
      return new this(args);
    }
    static descended(other) {
      return other === BVar || other === $Var;
    }
    state() {
      return $FakeState.listFromMap({
        name: this.__name,
      });
    }
    load(proto) {
      const key = '__' + this.name;
      const self = this;
      proto._add(self.name, function (assign) {
        if (assign !== undefined) {
          this[key] = assign;
        } else if (!(key in this)) {
          this[key] = self.defval();
        }
        return this[key];
      });
      Object.defineProperty(proto._proto, '_' + self.name, {
        get() { return this[self.name](); },
        set(value) { return this[self.name](value); },
        enumerable: true,
        configurable: true
      });
    }
    defval() {
      return typeof this.__desc.default === 'function' ? this.__desc.default.apply(this) : this.__desc.default;
    }
    class() {
      return BVar;
    }
    debug() {
      return this.__desc.debug || false;
    }
    description() {
      return this.title();
    }
    isa(it) {
      return it === BVar;
    }
    initInstance(inst) {
    }
  }

  // bootstrapping the property slot
  class BProperty {
    constructor({ name, ...desc }) {
      this.__name = name;
      this.__desc = desc;
    }
    get name() {
      return this.__name;
    }
    static new(args) {
      return new this(args);
    }
    static descended(other) {
      return other === BProperty || other === $Property;
    }
    state() {
      return $FakeState.listFromMap({
        name: this.__name,
      });
    }
    load(proto) {
      const key = '__' + this.name;
      const self = this;
      // Define as property instead of method
      Object.defineProperty(proto._proto, self.name, {
        get: function() {
          if (!(key in this)) {
            this[key] = self.defval();
          }
          return this[key];
        },
        set: function(value) {
          this[key] = value;
        },
        enumerable: true,
        configurable: true
      });
    }
    defval() {
      return typeof this.__desc.default === 'function' ? this.__desc.default.apply(this) : this.__desc.default;
    }
    class() {
      return BProperty;
    }
    debug() {
      return this.__desc.debug || false;
    }
    description() {
      return this.title();
    }
    title() {
      return `#BProperty.${this.name}`;
    }
    isa(it) {
      return it === BProperty;
    }
    initInstance(inst) {
    }
  }

  __.__stack = new FrameStack();

  Function.prototype.load = function (proto) {
    proto._add(this.name, this);
  };
  Function.prototype.combine = function (impl) {
    impl.__primary = this;
  };
  Function.prototype.description = function () {
    return `#Function.${this.name}`;
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
        return 'Function';
      },
      uri() {
        return 'simulabra://localhost/global/Function';
      },
      title() {
        return '#Function';
      }
    }
  };
  Function.prototype.isa = function(it) {
    return it.name === 'FunctionPrimitive';;
  };
  Function.prototype.uri = function() {
    return `simulabra://localhost//${this.name}`;
  };
  Function.prototype.title = function() {
    return `#Function.${this.name}`;
  };
  Function.prototype.state = function() {
    return $FakeState.listFromMap({
      name: this.name,
      fn: this.toString()
    });
  }
  Number.prototype.description = function () {
    return this.toString();
  };
  Array.prototype.description = function (seen = {}) {
    return `[${this.map(e => __.stringify(e, seen)).join(' ')}]`;
  }

  function parametize(props, obj) {
    for (const [k, v] of Object.entries(props)) {
      if (k[0] !== '_') {
        obj['__' + k] = v;
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
      return this.__class;
    }
  }

  // base object inherited by everything
  const $BaseSlots = [
    function init() {
      globalThis.SIMULABRA.mod()?.register(this);
      for (const slot of this.class().slots()) {
        if (slot.class()._fullSlot) {
          slot.initInstance(this);
        }
      }
    },
    function description(seen) { //TODO: add depth
      const vars = this.state().filter(v => v.value() !== v.ref().defval());
      const varDesc = vars.length > 0 ? `{\n${vars.map(vs => ' ' + vs?.description(seen)).join('\n')}\n}` : '';
      return JSON.stringify(this.jsonify(), null, 2);
      return `${this.class().description(seen)}.${this.ident()}${varDesc}`;
    },
    function toString() {
      return this.description();
    },
    function state() {
      return this.class().vars().map(ref => {
        const value = this[`__${ref.name}`];
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
      return this.name ?? this.id();
    },
    function title() {
      if (this.uid() === this.class().name) {
        return `${this.class().description()}/`
      } else {
        return `${this.class().description()}/${this.uid()}`;
      }
    },
    function ident() {
      return `${this.id()}${this.name ? `(${this.name})` : ''}`;
    },
    function uri() {
      return `simulabra://localhost/${this.class().name}/${this.id()}`;
    },
    function jsonify() {
      return this.class().jsonify(this);
    },
    function log(...args) {
      $Debug?.log(this.title(), ...args.map(a => __.stringify(a)));
    },
    function tlog(...args) {
      $Debug?.log(`[${new Date().toISOString()}]`, this.title(), ...args.map(a => __.stringify(a)));
    },
    function dlog(...args) {
      if ($Debug && this.class().debug()) {
        this.log(...args);
      }
    },
    function load(proto) {
      proto._add(this.name, this);
    },
    function isa(cls) {
      return this.class().descended(cls);
    },
    function next(selector, ...args) {
      const fn = this[selector];
      return fn._next.apply(this, args);
    },
    ClassDef.class,
    BProperty.new({ name: 'name' }),
    BVar.new({ name: 'id' }),
  ];

  Array.prototype.load = function (target) {
    this.forEach(it => it.load(target));
  }

  const $ClassSlots = [
    function init() {
      $BaseSlots[0].apply(this);
      this.id_ctr(0);
      this.proto(new ClassPrototype(this));
      $BaseSlots.load(this.proto());
      this.__proto.__class = this;
      this.load(this.proto());
      this.mod(__.mod());
      this.proto()._reify();
      $$().mod()?.def(this.name, this)
    },
    function load(target) {
      for (const v of this.slots()) {
        v.load(target);
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
    function modref() {
      const modname = this.mod()?.name;
      if (modname === undefined || modname === 'base') {
        return '$';
      } else {
        return modname;
      }
    },
    function description() {
      return `$${this.modref()}.${this.name}`;
    },
    function toString() {
      return this.description();
    },
    function descended(target) {
      return this.name === target.name || !!this.slots().find(c => c.class() !== BVar && c.class().name === 'Class' && c.descended(target));
    },
    function title() {
      return `$.Class.${this.name}`;
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
    function allSlots() {
      let slots = this.slots();
      for (const superclass of this.superClasses()) {
        slots = slots.concat(superclass.allSlots());
      }
      return slots;
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
        } else if (slot.class() === BVar || slot.isa($Var)) {
          vars.push(slot);
        } else if (slot.isa($Class)) {
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
    function jsonify(object) {
      function isSerializable(value) {
        if (value === null || value === undefined) return true;
        const type = typeof value;
        if (type === 'string' || type === 'number' || type === 'boolean') return true;
        if (Array.isArray(value)) return true;
        if (type === 'object' && value.constructor === Object) return true;
        if (type === 'function' || type === 'symbol') return false;
        if (value instanceof Promise || value instanceof WeakMap || value instanceof WeakSet) return false;
        if (value instanceof Date || value instanceof RegExp) return true;
        return true;
      }

      function jsonifyValue(value) {
        if (value === null || value === undefined) return value;
        if (typeof value.json === 'function') return value.json();
        if (typeof value.jsonify === 'function') return value.jsonify();
        if (typeof value.uri === 'function') return value.uri();
        if (Array.isArray(value)) return value.map(jsonifyValue);
        if (value && typeof value === 'object' && value.constructor === Object) {
          const result = {};
          for (const [k, v] of Object.entries(value)) {
            result[k] = jsonifyValue(v);
          }
          return result;
        }
        if (!isSerializable(value)) {
          return undefined;
        }
        return value;
      }

      const json = {
        $class: this.name,
      };

      const module = this.mod();
      if (module && module.name) {
        json.$module = module.name;
      }

      for (const varSlot of this.vars()) {
        const varName = varSlot.name;
        const key = '__' + varName;
        if (object.hasOwnProperty(key)) {
          const value = object[key];
          if (value !== undefined && isSerializable(value)) {
            const jsonified = jsonifyValue(value);
            if (jsonified !== undefined) {
              json[varName] = jsonified;
            }
          }
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
        } else if (slot.name === name) {
          return slot;
        }
      }
      return null;
    },
    BProperty.new({ name: 'name' }),
    BVar.new({ name: 'mod' }),
    BVar.new({ name: 'fullSlot', default: false }),
    BVar.new({ name: 'proto' }),
    BVar.new({ name: 'id_ctr' }),
    BVar.new({
      name: 'slots',
      default: [],
    }),
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
  $Class.__class = $Class;
  $Class.__name = 'Class';
  $Class.__fullSlot = true;
  $Class.__proto = $Class;
  $Class.slots($ClassSlots);
  $Class.init();

  const $base_proto = new ClassPrototype($Class);
  manload($BaseSlots, $base_proto);
  manload($ClassSlots, $base_proto);
  $base_proto._reify();
  const $base = Object.create($base_proto._proto);
  $base.__class = $Class;
  $base.__name = 'base';
  $base.init();

  // a missing middle
  var $Var = $Class.new({
    name: 'Var',
    doc: 'variable slot with accessor hooks (validate, didSet, didGet), optional type spec, defaults, and required checks',
    fullSlot: true,
    slots: [
      BProperty.new({ name: 'name', }),
      BVar.new({ name: 'doc' }),
      BVar.new({ name: 'debug', default: true }),
      BVar.new({ name: 'trace', default: false }),
      BVar.new({ name: 'default', }),
      BVar.new({ name: 'default_init', }),
      BVar.new({ name: 'required', }),
      BVar.new({ name: 'spec', doc: 'optional Type instance for runtime validation on set, default access, and init' }),
      function defval(ctx) {
        if (this.default() instanceof Function) {
          return this.default().apply(ctx);
        } else {
          return this.default();
        }
      },
      function should_debug() {
        return this.debug() || $Debug.debug();
      },
      function validate(v) {
        const spec = this.spec();
        if (spec) {
          spec.validate(v, this.name);
        }
      },
      function didSet(inst, pk, v) {},
      function didGet(inst, pk) {},
      function combine(impl) {
        const pk = '__' + this.name;
        const self = this;

        if (self.spec() && typeof self.spec().validate !== 'function') {
          throw new Error(`Var '${self.name}': spec must be a Type with a validate method`);
        }

        impl.__primary = function varAccess(v, notify = true) {
          if (v !== undefined) {
            self.validate(v);
            this[pk] = v;
            if (notify) {
              self.didSet(this, pk, v);
            }
          } else {
            if (!(pk in this)) {
              const dv = self.defval(this);
              if (dv !== undefined) {
                self.validate(dv);
              }
              this[pk] = dv;
            }
            self.didGet(this, pk);
            return this[pk];
          }
        };
        impl.__direct = true;
        impl.__properties = [{ name: this.name }];
      },
      function initInstance(inst) {
        const key = '__' + this.name;
        if (this.required()) {
          if (!(key in inst) || inst[key] === undefined) {
            throw new Error(`Required var '${this.name}' not provided for ${inst.class().name}`);
          }
        }
        if (this.spec() && key in inst && inst[key] !== undefined) {
          this.spec().validate(inst[key], this.name);
        }
      }
    ]
  });

  const $Property = $Class.new({
    name: 'Property',
    doc: 'property slot backed by JS getter/setter with default support',
    fullSlot: true,
    slots: [
      BProperty.new({ name: 'name', }),
      BVar.new({ name: 'doc' }),
      BVar.new({ name: 'debug', default: true }),
      BVar.new({ name: 'trace', default: false }),
      BVar.new({ name: 'default', }),
      BVar.new({ name: 'default_init', }),
      BVar.new({ name: 'required', }),
      function defval(ctx) {
        if (this.default() instanceof Function) {
          return this.default().apply(ctx);
        } else {
          return this.default();
        }
      },
      function should_debug() {
        return this.debug() || $Debug.debug();
      },
      function load(proto) {
        const key = '__' + this._name;
        const self = this;
        // Define as property instead of method
        Object.defineProperty(proto._proto, self._name, {
          get: function() {
            if (!(key in this)) {
              this[key] = self.defval(this);
            }
            return this[key];
          },
          set: function(value) {
            this[key] = value;
          },
          enumerable: true,
          configurable: true
        });
      },
      function initInstance(inst) {
        if (this.required()) {
          const key = '__' + this.name;
          if (!(key in inst) || inst[key] === undefined) {
            throw new Error(`Required property '${this.name}' not provided for ${inst.class().name}`);
          }
        }
      }
    ]
  });

  const $Fn = $Class.new({
    name: 'Fn',
    doc: 'slot wrapper for function bodies',
    slots: [
      $Var.new({ name: 'do', doc: 'function body for this slot' }), // fn, meat and taters
    ]
  });

  const $Static = $Class.new({
    name: 'Static',
    doc: 'static method slot reified onto the class',
    slots: [
      $Fn,
      $Var.new({ name: 'doc' }),
      function load(proto) {
        let fn = this.do();
        if (typeof fn !== 'function') {
          fn = fn.fn();
        }
        const impl = new SlotImpl({ __name: this.name });
        impl.__primary = fn;
        impl.reify(proto._proto.__class);
      }
    ]
  });

  const $FakeState = $Class.new({
    name: 'FakeState',
    doc: 'name/value pair for listing and display',
    slots: [
      $Static.new({
        name: 'listFromMap',
        doc: 'build FakeState list from a map',
        do: function listFromMap(map) {
          const list = Object.entries(map).map(([k, v]) => this.new({ name: k, value: v }));
          return list;
        }
      }),
      $Var.new({ name: 'value' }),
      function kv() {
        return [this.name, this.value()];
      },
      function description(seen) {
        let d;
        if (this.value().title instanceof Function) {
          d = this.value().title();
        } else {
          d = __.stringify(this.value(), seen);
        }
        return `:${this.name}=${d}`;
      }
    ]
  });

  const $VarState = $Class.new({
    name: 'VarState',
    doc: 'state record for a Var slot value',
    slots: [
      $Var.new({ name: 'ref' }),
      $Var.new({ name: 'value' }),
      function kv() {
        return [this.ref().name, this.value()];
      },
      function description(seen) {
        let d;
        if (this.value()?.title instanceof Function) {
          d = this.value().title();
        } else if (!this.ref().debug()) {
          d = `<hidden>`;
        } else {
          d = __.stringify(this.value(), seen);
        }
        return `:${this.ref().name}=${d}`;
      }
    ]
  });

  const $Method = $Class.new({
    name: 'Method',
    doc: 'method slot with override chaining and debug control',
    slots: [
      $Fn,
      $Property.new({ name: 'name', doc: 'method name' }),
      $Var.new({ name: 'doc' }),
      $Var.new({ name: 'debug', default: true, doc: 'enable debug stack tracking' }),
      function combine(impl) {
        if (impl.__name !== this.name) {
          throw new Error('tried to combine Method on non-same named impl');
        }
        let fn = this.do();
        if (typeof fn !== 'function') {
          fn = fn.fn();
        }
        if (impl.__primary) {
          fn._next = impl.__primary;
        }
        impl.__primary = fn;
        impl.__debug = this.debug();
      },
    ]
  });

  const $Before = $Class.new({
    name: 'Before',
    doc: 'before modifier that runs ahead of a method',
    slots: [
      $Fn,
      $Property.new({ name: 'name', doc: 'target method name' }),
      $Var.new({ name: 'doc' }),
      function combine(impl) {
        impl.__befores.push(this.do());
      }
    ]
  });

  const $After = $Class.new({
    name: 'After',
    doc: 'after modifier that runs after a method',
    slots: [
      $Fn,
      $Property.new({ name: 'name', doc: 'target method name' }),
      $Var.new({ name: 'doc' }),
      function combine(impl) {
        impl.__afters.unshift(this.do());
      }
    ]
  });

  const $AsyncBefore = $Class.new({
    name: 'AsyncBefore',
    doc: 'async before modifier awaited before a method',
    slots: [
      $Fn,
      $Property.new({ name: 'name', doc: 'target method name' }),
      $Var.new({ name: 'doc' }),
      function combine(impl) {
        impl.__asyncBefores.push(this.do());
      }
    ]
  });

  const $AsyncAfter = $Class.new({
    name: 'AsyncAfter',
    doc: 'async after modifier awaited after a method',
    slots: [
      $Fn,
      $Property.new({ name: 'name', doc: 'target method name' }),
      $Var.new({ name: 'doc' }),
      function combine(impl) {
        impl.__asyncAfters.unshift(this.do());
      }
    ]
  });

  const $Virtual = $Class.new({
    name: 'Virtual',
    doc: 'virtual method slot that must be implemented',
    slots: [
      $Property.new({ name: 'name', doc: 'method name to implement' }),
      $Var.new({ name: 'doc' }),
      function load(parent) {
        self = this;
        parent._proto[this.name] = function () { throw new Error(`not implemented: ${self.name}`); };
        parent._proto[this.name].virtual = true;
      },
      function overrides() {
        return false;
      },
    ]
  });

  const $ObjectRegistry = $Class.new({
    name: 'ObjectRegistry',
    doc: 'registry of instances by class and uri using WeakRefs',
    slots: [
      $Var.new({ name: 'classInstances', default: () => ({}), doc: 'class name to instance uri list' }),
      $Var.new({ name: 'refs', default: () => ({}), doc: 'uri to WeakRef map' }),
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
          const ClassName = cls.name;
          if (this.classInstances()[ClassName] === undefined) {
            this.classInstances()[ClassName] = [];
          }
          this.classInstances()[ClassName].push(obj.uri());
        }
      },
      function instances(cls) {
        return (this.classInstances()[cls.name] ?? []).map(u => this.deref(u)).filter(o => o !== undefined);
      },
    ]
  });

  const $Deffed = $Class.new({
    name: 'Deffed',
    doc: 'mixin that defines instances in the current module after init',
    slots: [
      $After.new({
        name: 'init',
        doc: 'define instance in current module after init',
        do() {
          $$().mod()?.def(this.name, this);
        }
      })
    ]
  });

  const $registered = $Class.new({
    name: 'registered',
    doc: 'mixin that registers instances in the current module after init',
    slots: [
      $After.new({
        name: 'init',
        doc: 'register instance in current module after init',
        do() {
          $$().mod()?.register(this);
        }
      })
    ]
  });

  const $module = $Class.new({
    name: 'Module',
    doc: 'module namespace with imports, registry, and class definitions',
    slots: [
      $Deffed,
      $Property.new({ name: 'name', doc: 'module name' }),
      $Var.new({
        name: 'imports',
        desc: 'the other modules available within this one',
        doc: 'imported modules available for lookup',
        default: [],
        debug: false,
      }),
      $Var.new({ name: 'mod', doc: 'module initializer function' }),
      $Var.new({ name: 'registry', doc: 'object registry for instances' }),
      $Var.new({ name: 'parent', doc: 'parent module for fallback lookups' }),
      $Var.new({ name: 'doc', default: '-' }),
      $Var.new({ name: 'loaded', default: false }),
      $Var.new({ name: 'repos', default: () => ({}), doc: 'class name to name->object map' }),
      $Var.new({ name: 'classes', default: () => [], doc: 'all defined classes in this module' }),
      $Before.new({
        name: 'init',
        doc: 'initialize registry and parent module',
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
        return this.instances(cls).find(i => i.id() == nameOrId || i.name == nameOrId);
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
              const err = new Error(`failed to find ~${ClassName}.${p} in \$${target.name}`);
              if (errFn) {
                errFn(err);
              } else {
                throw err;
              }
            }

            return v.proxied(this);
          }
        });
      },
      function def(name, obj) {
        const ClassName = obj.class().name;
        if (!this.repos().hasOwnProperty(ClassName)) {
          this.repos()[ClassName] = {};
        }
        this.repos()[ClassName][name] = obj;
        this.classes().push(obj);
      },
      async function load() {
        if (!this.loaded() && this.mod()) {
          this.loaded(true);
          const om = $$().mod();
          $$().mod(this);
          // _ = local classes, $ = base classes, then other imports (excluding base)
          const baseModule = $$().base();
          const otherImports = this.imports().filter(i => i !== baseModule);
          await this.mod().apply(this, [
            this.proxy('Class'),           // _ (local classes)
            baseModule.$(),                // $ (base classes)
            ...otherImports.map(i => i.proxy('Class'))
          ]);
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
    $Property,
    $Fn,
    $Method,
    $Static,
    $VarState,
    $Virtual,
    $Before,
    $After,
    $AsyncBefore,
    $AsyncAfter,
    $ObjectRegistry,
    $module,
    $Deffed,
  ];

  INTRINSICS.forEach(it => {
    _.def(it.name, it);
    _.register(it);
  });

  _.register(_);
  $.Class.new({
    name: 'StaticVar',
    doc: 'Var slot that reifies onto the class as a static accessor',
    slots: [
      $.Var,
      $.After.new({
        name: 'load',
        doc: 'reify static var accessor on class load',
        do: function load() {
          this._getImpl(this.name).reify(this._proto.__class);
        }
      })
    ]
  });

  $.Class.new({
    name: 'SimulabraGlobal',
    doc: 'global system root with module state and helpers',
    slots: [
      $.Var.new({ name: 'mod', doc: 'current module' }),
      $.Var.new({ name: 'modules', default: {}, doc: 'module registry by name' }),
      $.Var.new({ name: 'stack', debug: false, doc: 'call stack for debug tracing' }),
      $.Var.new({ name: 'debug', default: true }),
      $.Var.new({ name: 'trace', default: true }),
      $.Var.new({ name: 'tick', default: 0, doc: 'global tick counter' }),
      $.Var.new({ name: 'handlers', default: {}, doc: 'global handlers map' }),
      $.Var.new({ name: 'registry', doc: 'global object registry' }),
      $.Var.new({ name: 'reactor', doc: 'reactive dependency reactor' }),
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
      function instanceOf(obj, cls) {
        return obj && typeof obj.isa === 'function' && obj.isa(cls);
      },
      __.display,
      __.stringify,
      function sleep(ms) {
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve(), ms);
        })
      }
    ]
  });

  __ = $.SimulabraGlobal.new({
    stack: new FrameStack(),
    mod: _,
    baseMod: _,
    bootstrapped: true,
    registry: _.registry(),
  });

  $.Class.new({
    name: 'Reactor',
    doc: 'central reactive system for managing dependencies and effects',
    slots: [
      $.Var.new({
        name: 'stack',
        doc: 'stack of dependency sets',
        default: () => [],
      }),
      $.Var.new({
        name: 'pending',
        doc: 'pending effect callbacks',
        default: () => new Set(),
      }),
      $.Var.new({
        name: 'batched',
        default: false,
      }),
      $.Method.new({
        name: 'push',
        doc: 'register dependency set with the active effect',
        do(dep) {
          const top = this.stack()[this.stack().length - 1];
          if (top) top.add(dep);
        }
      }),
      $.Method.new({
        name: 'flush',
        doc: 'await a microtask boundary',
        async do() {
          return new Promise(resolve => {
            queueMicrotask(resolve);
          });
        }
      }),
      $.Method.new({
        name: 'schedule',
        doc: 'schedule effect callbacks with microtask batching',
        do(task) {
          if (task instanceof Set) {
            task.forEach(t => this.pending().add(t));
          } else {
            this.pending().add(task);
          }
          if (!this.batched()) {
            this.batched(true);
            queueMicrotask(() => {
              this.batched(false);
              this.pending().forEach(f => f());
              this.pending().clear();
            });
          }
        }
      })
    ]
  });

  __.reactor($.Reactor.new());

  $.Class.new({
    name: 'Effect',
    doc: 'reactive effect that reruns when its dependencies change',
    slots: [
      $.Var.new({
        name: 'fn',
        doc: 'function to run',
        required: true
      }),
      $.Var.new({
        name: 'deps',
        default: () => new Set()
      }),
      $.Var.new({
        name: 'active',
        default: true
      }),
      $.Var.new({
        name: 'boundRun',
        doc: 'cached bound run callback for subscriptions',
      }),
      $.Method.new({
        name: 'run',
        doc: 'execute the effect and track dependencies',
        do() {
          if (!this.boundRun()) {
            this.boundRun(this.run.bind(this));
          }
          if (!this.active()) return;
          const deps = new Set();
          __.reactor().stack().push(deps);
          try {
            this.fn()();
          } finally {
            __.reactor().stack().pop();
          }
          // Clear old dependencies and register with new ones
          this.deps().forEach(dep => dep.delete(this.boundRun()));
          this.deps(deps);
          deps.forEach(dep => dep.add(this.boundRun()));
        }
      }),
      $.Method.new({
        name: 'dispose',
        doc: 'deactivate this effect and clean up dependencies',
        do() {
          this.active(false);
          this.deps().forEach(dep => dep.delete(this.run.bind(this)));
          this.deps(new Set());
        }
      }),
      $.Static.new({
        name: 'create',
        doc: 'create and immediately run a new effect',
        do(fn) {
          const effect = this.new({ fn });
          effect.run();
          return effect;
        }
      })
    ]
  });

  globalThis.SIMULABRA = __;

  var $Debug = $Class.new({
    name: 'Debug',
    doc: 'debug utilities for logging and formatting',
    slots: [
      $Static.new({
        name: 'log',
        doc: 'log raw arguments to console',
        do: function log(...args) {
          console.log(...args);
          return this;
        }
      }),
      $Static.new({
        name: 'format',
        doc: 'format arguments for display output',
        do: function format(...args) {
          return args.map(a => __.display(a));
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
    doc: 'variable slot restricted to a fixed set of choices',
    slots: [
      $.Var,
      $.Var.new({
        name: 'choices',
        required: true
      }),
      $.After.new({
        name: 'init',
        doc: 'validate default against choices',
        do: function after__init() {
          const def = this.default();
          if (def !== undefined && !this.choices().includes(def)) {
            throw new Error(`Invalid default value ${def} for choices ${this.choices().join(', ')}`);
          }
        }
      }),

      $.Method.new({
        name: 'combine',
        doc: 'enforce enum choices on access and assignment',
        do: function combine(impl) {
          const pk = '__' + this.name;
          const self = this;

          impl.__primary = function enumAccess(assign, update = true) {
            if (assign !== undefined) {
              if (!self.choices().includes(assign)) {
                throw new Error(`Invalid enum value '${assign}' for ${self.name}. Valid choices are: ${self.choices().join(', ')}`);
              }
              this[pk] = assign;
            } else if (!(pk in this)) {
              this[pk] = self.defval(this);
            }
            return this[pk];
          };

          impl.__direct = true;
        }
      }),

      $.Method.new({
        name: 'defval',
        doc: 'validate default enum value',
        do: function defval(ctx) {
          const def = this.default();
          if (def !== undefined) {
            if (!this.choices().includes(def)) {
              throw new Error(
                `Invalid default enum value '${def}' for ${this.name}. Valid choices are: ${this.choices().join(', ')}`
              );
            }
          }
          return def;
        }
      })
    ]
  });

  globalThis.SUBMAP = new WeakMap();      // inst  -> Map<pk, Set<fn>>

  function getSubs(inst, pk) {
    let map = SUBMAP.get(inst);
    if (!map) {
      map = new Map();
      SUBMAP.set(inst, map);
    }
    let subs = map.get(pk);
    if (!subs) {
      subs = new Set();
      map.set(pk, subs);
    }
    return subs;
  }

  $.Class.new({
    name: 'Signal',
    doc: 'reactive Var that tracks dependencies and schedules subscribers',
    slots: [
      $.Var,
      function didSet(inst, pk, v) {
        SIMULABRA.reactor().schedule(getSubs(inst, pk));
      },
      function didGet(inst, pk) {
        SIMULABRA.reactor().push(getSubs(inst, pk));
      },
    ]
  });

  $.Class.new({
    name: 'ConfigSlot',
    doc: 'a slot that participates in serialization via Configurable mixin'
  })

  $.Class.new({
    name: 'ConfigVar',
    doc: 'ConfigSlot-marked Var for config serialization',
    slots: [
      $.ConfigSlot,
      $.Var
    ]
  });

  $.Class.new({
    name: 'ConfigSignal',
    doc: 'ConfigSlot-marked Signal for config serialization',
    slots: [
      $.ConfigSlot,
      $.Signal
    ]
  });

  $.Class.new({
    name: 'Configurable',
    doc: 'mixin for saving and loading config json',
    slots: [
      $.Method.new({
        name: 'configSlots',
        do() {
          return this.class().allSlots().filter(s => s.isa?.($.ConfigSlot));
        }
      }),
      $.Method.new({
        name: 'configJSON',
        doc: 'serialize ConfigSlot values to a plain object',
        do() {
          const result = {};
          for (const slot of this.configSlots()) {
            result[slot.name] = this[slot.name]();
          }
          return result;
        }
      }),
      $.Method.new({
        name: 'configLoad',
        do(data) {
          for (const slot of this.configSlots()) {
            if (slot.name in data) {
              this[slot.name](data[slot.name]);
            }
          }
        }
      }),
    ]
  });

  $.Class.new({
    name: 'HistorySlot',
    doc: 'marker for slots that participate in history snapshots'
  });

  $.Class.new({
    name: 'HistorySignal',
    doc: 'HistorySlot-marked Signal for snapshot tracking',
    slots: [
      $.HistorySlot,
      $.Signal
    ]
  });

  $.Class.new({
    name: 'History',
    doc: 'mixin for undo/redo with automatic snapshot of HistorySlot slots',
    slots: [
      $.Var.new({ name: 'undoStack', default: () => [] }),
      $.Var.new({ name: 'redoStack', default: () => [] }),

      $.Method.new({
        name: 'historySlots',
        do() {
          return this.class().allSlots().filter(s => s.isa?.($.HistorySlot));
        }
      }),

      $.Method.new({
        name: 'snapshot',
        doc: 'capture current HistorySlot values',
        do() {
          const snap = {};
          for (const slot of this.historySlots()) {
            const value = this[slot.name]();
            snap[slot.name] = Array.isArray(value) ? value.slice() : value;
          }
          return snap;
        }
      }),

      $.Method.new({
        name: 'restoreSnapshot',
        do(snap) {
          for (const key in snap) {
            this[key](snap[key]);
          }
        }
      }),

      $.Method.new({
        name: 'pushUndo',
        doc: 'push snapshot onto undo stack and clear redo',
        do() {
          this.undoStack().push(this.snapshot());
          this.redoStack().length = 0;
        }
      }),

      $.Method.new({
        name: 'undo',
        doc: 'restore previous snapshot if available',
        do() {
          if (!this.undoStack().length) return false;
          this.redoStack().push(this.snapshot());
          this.restoreSnapshot(this.undoStack().pop());
          return true;
        }
      }),

      $.Method.new({
        name: 'redo',
        doc: 'reapply snapshot if available',
        do() {
          if (!this.redoStack().length) return false;
          this.undoStack().push(this.snapshot());
          this.restoreSnapshot(this.redoStack().pop());
          return true;
        }
      }),

      $.Method.new({
        name: 'canUndo',
        do() {
          return this.undoStack().length > 0;
        }
      }),

      $.Method.new({
        name: 'canRedo',
        do() {
          return this.redoStack().length > 0;
        }
      }),

      $.Method.new({
        name: 'clearHistory',
        do() {
          this.undoStack().length = 0;
          this.redoStack().length = 0;
        }
      })
    ]
  });

  $.Class.new({
    name: 'Constant',
    doc: 'read-only slot that returns a constant value',
    slots: [
      $.Var.new({ name: 'value', doc: 'constant value to return' }),
      $.Var.new({ name: 'doc' }),
      function combine(impl) {
        const self = this;
        impl.__primary = function constantAccess() {
          return self.value();
        };
        impl.__direct = true;
      }
    ]
  })

  // --- Type system ---

  $.Class.new({
    name: 'Type',
    doc: 'runtime type with predicate check and validate method',
    slots: [
      $.Var.new({ name: 'check', required: true, doc: 'predicate function (value) => boolean' }),
      function proxied() { return this; },
      $.Method.new({
        name: 'validate',
        doc: 'check value against type predicate, throw on failure, return value on success',
        do(value, slot) {
          if (!this.check()(value)) {
            throw new Error(`${this.name}: validation failed for '${slot}'`);
          }
          return value;
        }
      }),
      $.Method.new({
        name: 'nullable',
        doc: 'return a new Type that also accepts null and undefined',
        do() {
          const inner = this;
          return $.Type.new({
            name: `${this.name}?`,
            check: (v) => v === null || v === undefined || inner.check()(v),
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ArrayType',
    doc: 'type for arrays with element type validation via of()',
    slots: [
      $.Type,
      $.Method.new({
        name: 'of',
        doc: 'create an array type checking element type',
        do(inner) {
          if (!inner?.isa?.($.Type)) {
            throw new Error('ArrayType.of: argument must be a Type');
          }
          return $.Type.new({
            name: `$ArrayOf${inner.name}`,
            check: (v) => Array.isArray(v) && v.every(el => inner.check()(el)),
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: 'EnumType',
    doc: 'type for values from a fixed set of choices via of()',
    slots: [
      $.Type,
      $.Method.new({
        name: 'of',
        doc: 'create an enum type with specific choices',
        do(...choices) {
          if (choices.length === 0) {
            throw new Error('EnumType.of: must provide at least one choice');
          }
          for (const c of choices) {
            if (typeof c !== 'string' && typeof c !== 'number') {
              throw new Error('EnumType.of: each choice must be a string or number');
            }
          }
          return $.Type.new({
            name: `$EnumOf(${choices.join('|')})`,
            check: (v) => choices.includes(v),
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: 'InstanceType',
    doc: 'type for instances of a specific Simulabra class via of()',
    slots: [
      $.Type,
      $.Method.new({
        name: 'of',
        doc: 'create a type for instances of a specific class',
        do(cls) {
          if (!cls?.class?.()?.descended?.($.Class)) {
            throw new Error('InstanceType.of: argument must be a Class');
          }
          return $.Type.new({
            name: `$InstanceOf${cls.name}`,
            check: (v) => v?.isa?.(cls) ?? false,
          });
        }
      }),
    ]
  });

  const typeInstances = [
    $.Type.new({ name: '$Number', check: v => typeof v === 'number' }),
    $.Type.new({ name: '$String', check: v => typeof v === 'string' }),
    $.Type.new({ name: '$Integer', check: v => typeof v === 'number' && Number.isInteger(v) }),
    $.Type.new({ name: '$Boolean', check: v => typeof v === 'boolean' }),
    $.ArrayType.new({ name: '$Array', check: () => false }),
    $.EnumType.new({ name: '$Enum', check: () => false }),
    $.InstanceType.new({ name: '$Instance', check: () => false }),
  ];
  for (const t of typeInstances) {
    _.repos()['Class'][t.name] = t;
  }

  Function.prototype.module = function(params) {
    return $.Module.new({
      mod: this,
      ...params
    });
  }

  $.Class.new({
    name: 'Command',
    doc: 'command slot that builds a CommandContext and dispatches run',
    slots: [
      $.Var.new({ name: 'run', doc: 'handler for command execution' }),
      $.Method.new({
        name: 'load',
        doc: 'attach command and context builders to parent',
        do(parent) {
          const self = this;
          const cmdfn = `${this.name}Command`;
          parent._add(cmdfn, function(...args) {
            return $.CommandContext.new({
              command: self,
              parent: this,
              args
            });
          });
          parent._add(this.name, function(...args) {
            return this[cmdfn](...args).run();
          });
        },
      }),
    ],
  });

  $.Class.new({
    name: 'CommandContext',
    doc: 'execution context for a command invocation',
    slots: [
      $.Var.new({
        name: 'command',
      }),
      $.Var.new({
        name: 'parent',
        doc: 'parent object executing the command',
      }),
      $.Var.new({
        name: 'args',
        default: () => [],
      }),
      $.Method.new({
        name: 'run',
        doc: 'dispatch command via parent runcommand',
        do: function run(ctx) {
          return this.parent().runcommand(this);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'CommandChild',
    doc: 'marker mixin for command-related child objects',
    slots: [
    ]
  });

  $.Class.new({
    name: 'Clone',
    doc: 'mixin for cloning instances by copying set vars',
    slots: [
      $.Method.new({
        name: 'clone',
        doc: 'clone instance, optionally deep, with cycle tracking',
        do: function clone(deep = true, cloneMap = new WeakMap()) {
          if (cloneMap.has(this)) {
            return cloneMap.get(this);
          }
          const cloned = this.class().new();
          cloneMap.set(this, cloned);
          for (const varSlot of this.class().vars()) {
            const varName = varSlot.name;
            const value = this[varName]();

            if (value !== undefined && value !== varSlot.defval()) {
              if (deep && value && typeof value === 'object') {
                if (typeof value.clone === 'function') {
                  cloned[varName](value.clone(true, cloneMap));
                } else if (Array.isArray(value)) {
                  cloned[varName](value.map(item =>
                    (item && typeof item.clone === 'function')
                      ? item.clone(true, cloneMap)
                      : item
                  ));
                } else {
                  cloned[varName](value);
                }
              } else {
                cloned[varName](value);
              }
            }
          }

          return cloned;
        }
      })
    ]
  });

  $.Class.new({
    name: 'JSON',
    doc: 'mixin for JSON serialization of slot values',
    slots: [
      $.Method.new({
        name: 'json',
        doc: 'serialize slots to a JSON-ready object',
        do: function json() {
          function jsonifyValue(value) {
            if (value === null || value === undefined) return value;
            if (typeof value.json === 'function') return value.json();
            if (typeof value.uri === 'function') return value.uri();
            if (Array.isArray(value)) return value.map(jsonifyValue);
            if (value && typeof value === 'object' && value.constructor === Object) {
              const result = {};
              for (const [k, v] of Object.entries(value)) {
                result[k] = jsonifyValue(v);
              }
              return result;
            }
            return value;
          }

          const result = {};
          for (const key in this) {
            if (key.startsWith('__') && this.hasOwnProperty(key)) {
              const slotName = key.slice(2);
              const slot = this.class().getslot(slotName);
              if (slot) {
                result[slotName] = jsonifyValue(this[key]);
              }
            }
          }
          return result;
        }
      })
    ]
  });

  return _;
}

export const base = bootstrap();
export const __ = globalThis.SIMULABRA;
