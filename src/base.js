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
    stringify() {

    },
    display() {

    }
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
        // console.log('ss recur', k)
        ps.push(`:${k}=${simulabra_string(v, seen)}`)
      }
      return '{' + ps.join(' ') + '}';
    } else {
      // console.log('ss was', obj);
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
      console.log('frame desc')
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
            // console.log('in reified', self.name, self.primary, res)
            self._afters.forEach(a => a.apply(this, args)); // res too?
            if (self._debug) {
              __._stack.pop();
            }
            return res;
          } catch (e) {
            if (!e._logged && self._debug) {
              e._logged = true;
              debug('failed message: call', self._name, 'on', this._parent, 'with', args);
              __._stack.trace();
            }
            throw e;
          }
        };
      }
    }
  }

  function nativePassthrough(name) {
    return (typeof name === 'symbol') || ['then', 'fetch'].includes(name);
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
      this._proto._parent = parent;
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
      if (!(name in this._impls)) {
        this._impls[name] = new MethodImpl({ _name: name });
      }
      return this._impls[name];
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
      return `{~#bvar ${this.name()}}`
    }
  }

  __._stack = new FrameStack();

  Object.prototype._add = function add(name, op) {
    this[name] = op;
  }
  Object.prototype.eq = function (other) {
    return this === other;
  }
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
    }
  };
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

  function manload(components, proto) {
    for (const c of components) {
      c.load(proto);
    }
  }

  const classDef = {
    class() {
      return this._parent;
    }
  }

  const $base_components = [
    function init() {
      // mostly broken
      if (globalThis.SIMULABRA._debug) {
        const stack = (new Error()).stack;
        const line = stack.split('\n')[2];
        this.src_line(line);
      }
    },
    function description(seen) { //TODO: add depth
      const vars = this.vars().filter(v => v.value() !== v.var_ref().defval());
      const varDesc = vars.length > 0 ? `{\n${vars.map(vs => ' ' + vs?.description(seen)).join('\n')}\n}` : '';
      return `${this.class().description(seen)}.new${varDesc}`;
    },
    function vars() {
      return this.class().vars().map(v => $var_state.new({ var_ref: v, value: this[v.name()]() }));
    },
    function me() {
      return this;
    },
    function title() {
      return `${this.class().description()}#${this.name() ?? this.id()}`;
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
    classDef.class,
    BVar.new({ name: 'name' }),
    BVar.new({ name: 'id' }),
    BVar.new({ name: 'src_line' }),
  ];

  // const $base_proto = {};
  // manload($base_components, $base_proto);

  Array.prototype.load = function (target) {
    this.forEach(it => it.load(target));
  }

  const $class_components = [
    function init() {
      $base_components[0].apply(this);
      this.id_ctr(0);
      this.proto(new ClassPrototype(this));
      $base_components.load(this.proto());
      this._proto._class = this;
      this.load(this.proto());
      this.proto()._reify();
      $$().mod()?.def(this)
    },
    function load(target) {
      for (const v of this.components()) {
        v.load(target);
      }
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
    function descended(target) {
      return this.name() === target.name() || !!this.components().find(c => c.class().name() === 'class' && c.descended(target));
    },
    function vars() {
      let visited = new Set();

      const _vars = (cls) => {
        if (visited.has(cls)) return [];
        visited.add(cls);

        let vars = [];
        for (const c of cls.components()) {
          if (c.class().descended($var)) {
            vars.push(c);
          } else if (c.class().descended($class)) {
            vars = [...vars, ..._vars(c.class())];
          }
        }
        return vars;
      };

      return _vars(this);
    },
    function genid() {
      let id = this.id_ctr();
      this.id_ctr(id + 1);
      return id;
    },
    BVar.new({ name: 'name' }),
    BVar.new({ name: 'proto' }),
    BVar.new({ name: 'id_ctr' }),
    BVar.new({
      name: 'components',
      default: [],
    }),
    BVar.new({
      name: 'debug',
      default: false,
    })
  ];


  const $class_slots = new ClassPrototype(null);
  const newObj = {
    new(props = {}) {
      // console.log('class new ' + props.name);
      const obj = Object.create(this.proto()._proto);
      parametize(props, obj);
      obj.id(this.genid());
      obj.init(this);
      return obj;
    }
  };
  $class_components.push(newObj.new);

  manload($base_components, $class_slots);
  manload($class_components, $class_slots);
  $class_slots._reify();
  var $class = Object.create($class_slots._proto);
  $class._parent = $class;

  $class._name = 'class';
  $class.proto($class);

  // a missing middle
  var $var = $class.new({
    name: 'var',
    components: [
      BVar.new({ name: 'name', }),
      BVar.new({ name: 'mutable', default: true }),
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
        return this.debug() || $debug.debug();
      },
      function combine(impl) {
        const pk = '_' + this.name();
        const self = this;
        if (this.mutable()) {
          impl._primary = function mutableAccess(assign) {
            if (assign !== undefined) {
              this[pk] = assign;
              ('update' in this) && this.update({ changed: self.name() }); // best there is?
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

  const $var_state = $class.new({
    name: 'var_state',
    components: [
      $var.new({ name: 'var_ref' }),
      $var.new({ name: 'value' }),
      function description(seen) {
        let d;
        if (this.value().title instanceof Function) {
          d = this.value().title();
        } else if (!this.var_ref().debug()) {
          d = `<hidden>`;
        } else {
          d = simulabra_string(this.value(), seen);
        }
        // console.log('description!!', this.var_ref().name(), typeof this.value(), typeof this.value()._class);
        return `:${this.var_ref().name()}=${d}`;
      }
    ]
  });

  const $method = $class.new({
    name: 'method',
    components: [
      $var.new({ name: 'do' }), // fn, meat and taters
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
          if (this.override()) {
            fn._next = impl._primary;
          } else {
            throw new Error(`invalid override on ${this.title()}!`);
          }
        }
        impl._primary = fn;
        impl._debug = this.debug();
      },
    ]
  });

  const $static = $class.new({
    name: 'static',
    components: [
      $var.new({ name: 'do' }),
      function load(proto) {
        const impl = new MethodImpl({ _name: this.name() });
        let fn = this.do();
        if (typeof fn !== 'function') {
          fn = fn.fn();
        }
        impl._primary = fn;
        impl.reify(proto._proto._parent);
      }
    ]
  })

  var $debug = $class.new({
    name: 'debug',
    components: [
      $static.new({
        name: 'log',
        do: function log(...args) {
          // const stack = (new Error).stack;
          // const source = stack.split('\n')[2];
          console.log(...this.format(...args));
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
    components: [
      $var.new({ name: 'name' }),
      $var.new({ name: 'do' }),
      function combine(impl) {
        impl._befores.push(this.do());
      }
    ]
  });

  const $after = $class.new({
    name: 'after',
    components: [
      $var.new({ name: 'name' }),
      $var.new({ name: 'do', debug: false }),
      function combine(impl) {
        impl._afters.push(this.do());
      }
    ]
  });


  const $virtual = $class.new({
    name: 'virtual',
    components: [
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

  const $module = $class.new({
    name: 'module',
    // debug: true,
    components: [
      $var.new({ name: 'name' }),
      $var.new({
        name: 'imports',
        desc: 'the other modules available within this one',
        default: [],
        debug: false,
      }),
      $var.new({ name: 'on_load' }),
      $var.new({ name: 'loaded', default: false }),
      $var.new({ name: 'repos', default: () => ({}) }),
      $var.new({ name: 'classes', default: () => [] }),
      function repo(className) {
        return this.repos()[className] || {};
      },
      function instances(cls) {
        return this.classes().filter(c => c.isa(cls));
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
            return v;
          }
        })
      },
      function def(obj) {
        const className = obj.class().name();
        const name = obj.name();
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

  var _ = $module.new({ name: 'base' });
  var $ = _.proxy('class');
  __._mod = _;

  _.def($class);
  _.def($var);
  _.def($method);
  _.def($static);
  _.def($debug);
  _.def($var_state);
  _.def($virtual);
  _.def($before);
  _.def($after);
  _.def($module);

  $.class.new({
    name: 'static_var',
    components: [
      $.var,
      $.after.new({
        name: 'load',
        do(proto) {
          proto._get_impl(this.name()).reify(proto._proto._parent);
        }
      }),
    ]
  })

  $.class.new({
    name: 'simulabra_global',
    components: [
      $.var.new({
        name: 'mod',
      }),
      $.var.new({
        name: 'modules',
        default: () => {},
      }),
      $.var.new({
        name: 'stack',
        debug: false,
      }),
      $.var.new({
        name: 'debug',
        default: true, // now only, how to change while running?
      }),
      $.var.new({
        name: 'trace',
        default: true,
      }),
      $.var.new({
        name: 'tick',
        default: 0,
      }),
      $.method.new({
        name: 'start_ticking',
        do() {
          setInterval(() => {
            this.tick(this.tick() + 1);
          }, 16);
        }
      }),
      $.method.new({
        name: 'js_new',
        do(className, ...args) {
          const obj = new globalThis[className](...args);
          this.log(className, args, obj);
          return obj;
        }
      }),
      function js_get(obj, p) {
        return obj[p];
      },
      function $() {
        return this.mod().proxy('class');
      },
      function base() {
        return _;
      }
    ]
  });

  __ = $.simulabra_global.new({
    stack: new FrameStack(),
    mod: _,
    base_mod: _,
    bootstrapped: true,
  });
  globalThis.SIMULABRA = __;
  __.$$debug_class = $debug;
  __.start_ticking();

  $.class.new({
    name: 'deffed',
    components: [
      $.after.new({
        name: 'init',
        do() {
          $$().mod().def(this);
        }
      })
    ]
  });

  $.class.new({
    name: 'self',
    components: []
  });

  $.class.new({
    name: 'primitive',
    components: [
      $.class,
      $.deffed,
      $.var.new({ name: 'components', default: [] }),
      $.var.new({ name: 'js_prototype' }),
      $.var.new({ name: 'methods', default: {} }),
      $.var.new({ name: 'name' }),
      function init() {
        for (let c of this.components()) {
          c.load(this.js_prototype());
        }
        this.dlog('primitive init', this);
      },
      function extend(methods) {
        methods.map(m => m.load(this.js_prototype())); // wee-woo!
      },
      function description() {
        return `primitive ${this.name()}`;
      },
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
    components: [
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
    components: [
      $method.new({
        name: 'class',
        do() {
          return _.proxy('primitive').boolean_primitive;
        },
      }),
      function description() {
        return this.toString();
      }
    ]
  });

  $.primitive.new({
    name: 'number_primitive',
    js_prototype: Number.prototype,
    components: [
      function js() {
        return this;
      },
      function sqrt() {
        return Math.sqrt(this);
      },
      function square() {
        return this ** 2;
      },
      function print() {
        return this.toString();
      },
      $method.new({
        name: 'class',
        do() {
          return _.proxy('primitive').number_primitive;
        },
      }),
      function expand() {
        return this;
      },
      function description() {
        return this.toString();
      },
      function add(n) {
        return this + n;
      },
      function sub(n) {
        return this - n;
      },
      function pow(n) {
        return this ** n;
      },
    ]
  });

  $.class.new({
    name: 'number',
    components: [
      function primitive() {
        return _.find('primitive', 'number_primitive');
      }
    ]
  });

  $.primitive.new({
    name: 'array_primitive',
    js_prototype: Array.prototype,
    components: [
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
      function description(seen = {}) {
        return `(${this.map(it => { return simulabra_string(it) ?? '' + it }).join(' ')})`;
      },
    ]
  });

  $.primitive.new({
    name: 'function_primitive',
    js_prototype: Function.prototype,
    components: [
      function description(seen = {}) {
        return `<function_primitive ${this.name}>`;
      },
      function wrap(ctx) {
        this._closure = $.closure.new({
          fn: this,
          mod: ctx
        });
        return this;
      }
      // $method.new({
      //   name: 'class',
      //   do() {
      //     return _.proxy('primitive').function_primitive;
      //   },
      // }),
    ]
  });

  $.class.new({
    name: 'closure',
    components: [
      $.var.new({ name: 'fn' }),
      $.var.new({ name: 'mod' }),
      $.method.new({
        name: 'apply',
        do: function apply(args = []) {
          const om = $$().mod();
          $$().mod(this.mod());
          const res = this.fn(...args);
          $$().mod(om);
          return res;
        }
      }),
      $.method.new({
        name: 'do',
        do(...args) {
          return this.apply(args);
        }
      }),
      $.method.new({
        name: 'wrap',
        do() {
          const self = this;
          const fn = function(...args) { return self.fn(...args); };
          fn._closure = this;
          return fn;
        }
      })
    ]
  });

  $.class.new({
    name: 'async_closure',
    components: [
      $.closure,
      $.method.new({
        name: 'apply',
        override: true,
        do: async function apply(self, args = []) {
          const om = $$().mod();
          $$().mod(this.mod());
          const res = await this.fn().apply(self, args);
          $$().mod(om);
          return res;
        }
      }),
    ]
  });

  $.class.new({
    name: 'singleton',
    components: [
      $.static.new({
        name: 'inst',
        do(params) {
          if (!this.__inst) {
            this.__inst = this.new(params);
          }
          return this.__inst;
        }
      }),
    ]
  });


  $.class.new({
    name: 'promise',
    components: [

    ]
  })

  return _;
}

const base = bootstrap();

export default base;