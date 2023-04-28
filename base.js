globalThis.SIMULABRA = {
    debug() {
        return true;
    },
    mod() {
        return this._mod;
    },
    trace() {
        return false;
    },
    stringify() {

    },
    display() {

    }
};


function simulabra_display(obj) {
    if (typeof obj === 'string') {
        return obj;
    } else {
        return simulabra_string(obj);
    }
}
function simulabra_string(obj) {
    if (obj === undefined || obj === null) {
        return '' + obj;
    } else if (Object.getPrototypeOf(obj) === ClassPrototype) {
        return '#proto ' + obj._name || '?';
    } else if (typeof obj.description === 'function') {
        return obj.description();
    } else if (typeof obj === 'object') {
        const ps = [];
        for (const [k, v] of Object.entries(obj)) {
            // console.log('ss recur', k)
            ps.push(`:${k}=${simulabra_string(v)}`)
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
        return `${pry(this._receiver)}.${this._method_impl._name}(${this._args.length > 0 ? this._args.map(a => pry(a)).join('') : ''})`;
    }
}

function pry(obj) {
    if (typeof obj === 'object' && obj._class !== undefined) {
        return obj.title();
    } else {
        return `#native/${typeof obj}`;
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
        };
        Object.assign(this, defaults);
        Object.assign(this, props);
    }
    reify(proto) {
        if (!$$().debug() && this._befores.length === 0 && this._afters.length === 0) {
            proto[this._name.deskewer()] = this._primary;
            return;
        }
        const self = this;
        // console.log('reify', this.name, this.primary)
        proto[this._name.deskewer()] = function (...args) {
            const __ = globalThis.SIMULABRA;
            if (self._debug) {
                __._stack.push(new Frame(this, self, args)); // uhh
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
        }
    }
}

class ClassPrototype {
    constructor(parent) {
        this._impls = {};
        this._parent = parent;
    }

    _reify() {
        for (const impl of Object.values(this._impls)) {
            impl.reify(this);
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
    name() {
        return this._name;
    }
    load(proto) {
        const key = '_' + this.name();
        const self = this;
        proto._add(self.name(), function (assign) {
            if (assign !== undefined) {
                // console.log('bvar set', name, key);
                this[key] = assign;
            } else if (this[key] === undefined && self._desc.default !== undefined) {
                this[key] = typeof self._desc.default === 'function' ? self._desc.default() : self._desc.default;
            }
            return this[key];
        });
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

function bootstrap() {
    var __ = globalThis.SIMULABRA;
    if (__._bootstrapped) {
        return __;
    }

    console.log('~%~%~%~%~%~%~%~%~%~%~%~%~%~%~%~%~%~%~');
    console.log('STARTING SIMULABRA: INFINITE SOFTWARE');
    __._stack = new FrameStack();

    Object.prototype._add = function add(name, op) {
        this[name.deskewer()] = op;
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
            }
        }
    };
    Number.prototype.description = function () {
        return this.toString();
    };
    Array.prototype.description = function (seen = {}) {
        return `[${this.map(e => e.description(seen)).join(' ')}]`;
    }

    String.prototype.deskewer = function () {
        return this.replace(/-/g, '_');
    };
    String.prototype.skewer = function () {
        return this.replace(/_/g, '-');
    };


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
        function init() {},
        function description(seen = {}) { //TODO: add depth
            if (seen[this]) {
                return '*circ*';
            } else {
                seen[this] = true;
            }
            // this.log('base desc', this._class._name)
            const vars = this.vars().filter(v => v.value() !== v.var_ref().defval());
            const varDesc = vars.length > 0 ? `{\n${vars.map(vs => ' ' + vs?.description(seen)).join('\n')}\n}` : '';
            return `${this.class().description(seen)}.new${varDesc}`;
        },
        function vars() {
            return this.class().vars().map(v => $var_state.new({ var_ref: v, value: this[v.name().deskewer()]() }));
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
            return this.class().descended(cls);
        },
        classDef.class,
        BVar.new({ name: 'name' }),
        BVar.new({ name: 'id' }),
    ];

    // const $base_proto = {};
    // manload($base_components, $base_proto);

    Array.prototype.load = function (target) {
        this.forEach(it => it.load(target));
    }

    const $class_components = [
        function init() {
            this.id_ctr(0);
            this.proto(new ClassPrototype(this));
            $base_components.load(this.proto());
            this._proto._class = this;
            this.load(this.proto());
            this.proto()._reify();
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
            return this === target || !!this.components().find(c => c === target);
        },
        function vars() {
            let vars = [];
            for (const c of this.components()) {
                if (c.class().descended($var)) {
                    vars.push(c);
                } else if (c.class().descended($class)) {
                    vars = [...vars, ...c.class().vars()];
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
        BVar.new({ name: 'id-ctr' }),
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
    $class_slots.new = function (props = {}) {
        // console.log('class new ' + props.name);
        const obj = Object.create(this.proto());
        parametize(props, obj);
        obj.id(this.genid());
        obj.init(this);
        __.mod()?.def(obj)
        return obj;
    };

    manload($base_components, $class_slots);
    manload($class_components, $class_slots);
    $class_slots._reify();
    var $class = Object.create($class_slots);
    $class._parent = $class;

    $class._name = 'class';
    $class.proto($class);

    const defaultFn = {
        load(target) {
            target['default'] = function (ctx) {
                if (this._default instanceof Function) {
                    return this._default.apply(ctx);
                } else {
                    return this._default;
                }
            };
        },
        name: 'default',
    }

    defaultFn.name = 'default';

    var $var = $class.new({
        name: 'var',
        components: [
            BVar.new({ name: 'name', }),
            BVar.new({ name: 'mutable', default: true }),
            BVar.new({ name: 'debug', default: true }),
            BVar.new({ name: 'default', }),
            BVar.new({ name: 'default-init', }),
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
                const pk = '_' + this.name().deskewer();
                var self = this;
                if (this.mutable()) {
                    impl._primary = function mutableAccess(assign) {
                        if (assign !== undefined) {
                            this[pk] = assign;
                            ('update' in this) && this.update({ changed: self.name() }); // best there is?
                            return this;
                        }
                        if (!(pk in this)) {
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
        name: 'var-state',
        components: [
            $var.new({ name: 'var-ref' }),
            $var.new({ name: 'value' }),
            function description() {
                // this.log('description!!', this.var_ref().name(), this.value());
                return `:${this.var_ref().name()}=${this.var_ref().debug() ? simulabra_string(this.value()) : 'hidden'}`;
            }
        ]
    });

    const $method = $class.new({
        name: 'method',
        components: [
            $var.new({ name: 'do' }), // fn, meat and taters
            $var.new({ name: 'message' }),
            $var.new({ name: 'name' }),
            $var.new({ name: 'debug', default: true }),
            function combine(impl) {
                if (impl._name !== this.name()) {
                    throw new Error('tried to combine method on non-same named impl');
                }
                impl._primary = this.do();
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
                impl._primary = this.do();
                impl.reify(proto._parent);
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
            $var.new({ name: 'on-load' }),
            $var.new({ name: 'loaded', default: false }),
            $var.new({ name: 'repos', default: () => ({}) }),
            function repo(className) {
                return this.repos()[className] || {};
            },
            function find(className, name) {
                // totally dies to recursion!
                const v = this.repo(className)[name];
                if (v) {
                    return v;
                } else {
                    for (const imp of this.imports()) {
                        const iv = imp.find(className, name);
                        if (iv) {
                            return iv;
                        }
                    }
                    return undefined;
                }
            },
            function proxy(className) {
                return new Proxy(this, {
                    get(target, p) {
                        const v = target.find(className, p.skewer());
                        if (v === undefined) {
                            // target.log(target.repo(className))
                            throw new Error(`failed to find ~${className}#${p}`);
                        }
                        return v;
                    }
                })
            },
            function symname(sym) {
                return '_' + sym.deskewer();
            },
            function def(obj) {
                const className = obj.class().name();
                const name = obj.name();
                if (!this.repos().hasOwnProperty(className)) {
                    this.repos()[className] = {};
                }
                this.repos()[className][name] = obj;
            },
            function child(moddef) {
                return $.module.new({
                    imports: [this, ...moddef.imports],
                    ...moddef
                })
            },
            async function load() {
                if (!this.loaded() && this.on_load()) {
                    this.loaded(true);
                    for (const imp of this.imports()) {
                        await imp.load();
                    }
                    const om = __.mod();
                    __.mod(this);
                    await this.on_load().apply(this, [this, this.proxy('class')]);
                    __.mod(om);
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
        name: 'simulabra-global',
        components: [
            $.var.new({ name: 'mod' }),
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
                default: false,
            }),
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

    $.class.new({
        name: 'deffed',
        components: [
            $.after.new({
                name: 'init',
                do() {
                    // this.log('deffin');
                    // __.mod().log('deffo')
                    __.mod().def(this);
                }
            })
        ]
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
        name: 'object-primitive',
        js_prototype: Object.prototype,
    });

    // Object.prototype.class = function() {
    //     return $.object_primitive;
    // }

    $.primitive.new({
        name: 'string-primitive',
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
        ]
    });

    $.primitive.new({
        name: 'boolean-primitive',
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
        name: 'number-primitive',
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

    $.primitive.new({
        name: 'array-primitive',
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
                return `(${this.map(it => { debug(it, it.description); return simulabra_string(it) ?? '' + it }).join(' ')})`;
            },
        ]
    });

    $.primitive.new({
        name: 'function-primitive',
        js_prototype: Function.prototype,
        components: [
            function description(seen = {}) {
                return `<function-primitive ${this.name}>`;
            },
            // $method.new({
            //     name: 'class',
            //     do() {
            //         return _.proxy('primitive').function_primitive;
            //     },
            // }),
        ]
    });

    return __;
}

bootstrap();

export default bootstrap;
