globalThis.SIMULABRA = {
    mod() {
        return this._mod;
    },
};

function debug(...args) {
    let __ = globalThis.SIMULABRA;
    if (typeof __.$ === 'function') {
        __.$().debug.log(...args);
    } else {
        console.log(...args.map(a => a.description ? a.description() : a));
    }
}

class Frame {
    constructor(receiver, method_impl, args) {
        this._receiver = receiver;
        this._method_impl = method_impl;
        this._args = args;
    }
    description() {
        return `${this._receiver.title()}(${this._method_impl._name}${this._args.map(a => a?.description ? ' ' + a.description() : ' ' + a).join('')})`
    }
}

class FrameStack {
    constructor() {
        this._frames = new Array(1000);
        this._frame_idx = -1;
    }
    push(frame) {
        // console.log('pushframe', f.name);
        this._frame_idx++;
        this._frames[this._frame_idx] = frame;
        return this;
    }
    pop() {
        this.clear();
        this._frame_idx--;
    }
    frame() {
        return this._frames[this._frame_idx];
    }
    clear() {
        delete this._frames[this._frame_idx];
    }
    trace() {
        for (let i = 0; i <= this._frame_idx; i++) {
            debug('stack frame', i, this._frames[i]);
        }
    }
}

class MethodImpl {
    constructor(name, direct = false) {
        this._name = name;
        this._primary = null;
        this._befores = [];
        this._afters = [];
        this._direct = direct;
    }
    reify(proto) {
        if (this._direct && this._befores.length === 0 && this._afters.length === 0) {
            proto[this._name.deskewer()] = this._primary;
            return;
        }
        const self = this;
        // console.log('reify', this.name, this.primary)
        proto[this._name.deskewer()] = function (...args) {
            var __ = globalThis.SIMULABRA;
            // console.trace('call', self._name);
            __._stack.push(new Frame(this, self, args)); // uhh
            try {
                self._befores.forEach(b => b.apply(this, args));
                let res = self._primary.apply(this, args);
                // console.log('in reified', self.name, self.primary, res)
                self._afters.forEach(a => a.apply(this, args)); // res too?
                __._stack.pop();
                return res;
            } catch (e) {
                if (!e._logged) {
                    debug('failed message: call', self._name, 'on', this._parent, 'with', args);
                    __._stack.trace();
                    e._logged = true;
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
            this._impls[name] = new MethodImpl(name);
        }
        return this._impls[name];
    }
}


function bootstrap() {
    var __ = globalThis.SIMULABRA;
    if (__._bootstrapped) {
        return __;
    }

    console.log('bootstrap');
    __._stack = new FrameStack();

    Object.prototype._add = function add(name, op) {
        this[name.deskewer()] = op;
    }
    Object.prototype.eq = function (other) {
        return this === other;
    }
    // Object.prototype.description = function() {
    //     return `Native Object (${typeof this})`;
    // }
    Object.prototype.contains = function (i) {
        return i in this;
    }
    Object.prototype.print = function () {
        return this.toString();
    }
    // Object.prototype.estree = function() {
    //     return {
    //         type: 'Literal',
    //         value: this,
    //     };
    // }
    Function.prototype.load = function (proto) {
        // console.log('fnload', this.name, proto);
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
    Array.prototype.description = function () {
        return `[${this.map(e => e.description()).join(' ')}]`;
    }

    String.prototype.deskewer = function () {
        return this.replace(/-/g, '_');
    };

    function bvar(name, desc = {}) {
        const key = '_' + name;
        return {
            name() {
                return name;
            },
            load(proto) {
                proto._add(name, function (assign) {
                    if (assign !== undefined) {
                        // console.log('bvar set', name, key);
                        this[key] = assign;
                    } else if (this[key] === undefined && desc.default !== undefined) {
                        this[key] = typeof desc.default === 'function' ? desc.default() : desc.default;
                    }
                    return this[key];
                });
            },
            class() {
                return {
                    name() {
                        return 'bvar';
                    },
                    descended(ancestor) {
                        return ancestor === $var;
                    },
                }
            },
            debug() {
                return desc.debug || false;
            }
        }
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
        function init() {},
        function description() {
            return `{${this.class().description()}${this.vars().map(vs => ' ' + vs.description()).join('')}}`;
        },
        function vars() {
            return this.class().vars().map(v => $var_state.new({ var_ref: v, value: this[v.name().deskewer()]() }));
        },
        function title() {
            return this.class().description() + '/' + this.name();
        },
        function log(...args) {
            $debug.log(this.title(), ...args);
        },
        function dlog(...args) {
            if ($debug && this.class().debug()) {
                this.log(...args);
            }
        },
        function load(proto) {
            proto._add(this.name(), this);
        },
        classDef.class,
        bvar('name', { default: '?' }),
    ];

    // const $base_proto = {};
    // manload($base_components, $base_proto);

    Array.prototype.load = function (target) {
        this.forEach(it => it.load(target));
    }

    const $class_components = [
        function init() {
            this.proto(new ClassPrototype(this));
            $base_components.load(this.proto());
            this._proto._class = this;
            this.load(this.proto());
            this.proto()._reify();
            if (__._mod) {
                // console.log('deffin', this.name());
                __.mod().def(this);
            }
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
        bvar('name'),
        bvar('proto'),
        bvar('components', {
            default: [],
        }),
        bvar('debug', {
            default: false,
        })
    ];


    const $class_slots = new ClassPrototype(null);
    $class_slots.new = function (props = {}) {
        // console.log('class new ' + props.name);
        const obj = Object.create(this.proto());
        parametize(props, obj);
        obj.init(this);
        return obj;
    };

    manload($base_components, $class_slots);
    manload($class_components, $class_slots);
    $class_slots._reify();
    var $class = Object.create($class_slots);
    $class._parent = $class;

    $class.name('class');
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
            bvar('name', {}),
            bvar('mutable', { default: true }),
            bvar('debug', { default: true }),
            bvar('default'),
            bvar('default-init'),
            bvar('required', {}),
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
            function description(d) {
                // console.log(this.v().name());
                // console.log(this.var_ref(), JSON.stringify(this.value()));
                return `${this.var_ref().title()}=${this.value().description()}`;
            }
        ]
    });

    const $method = $class.new({
        name: 'method',
        components: [
            $var.new({ name: 'do' }), // fn, meat and taters
            $var.new({ name: 'message' }),
            $var.new({ name: 'name' }),
            $var.new({ name: 'direct' }),
            function combine(impl) {
                impl._primary = this.do();
                if (this.direct()) {
                    impl._direct = this.direct();
                }
            },
        ]
    });

    const $static = $class.new({
        name: 'static',
        components: [
            $var.new({ name: 'do' }),
            function load(proto) {
                proto._parent[this.name().deskewer()] = this.do();
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
                    return args.map(a => a?.description ? a.description() : typeof a);
                }
            }),
        ]
    });

    const $before = $class.new({
        name: 'before',
        components: [
            $var.new({ name: 'name' }),
            $var.new({ name: 'do' }),
            function load(target) {
                this.dlog('load', this, target);
                target._get_impl(this.name())._befores.push(this.do());
            }
        ]
    });

    const $after = $class.new({
        name: 'after',
        debug: true,
        components: [
            $var.new({ name: 'name' }),
            $var.new({ name: 'do', debug: false }),
            function load(target) {
                target._get_impl(this.name())._afters.push(this.do());
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

    String.prototype.description = function () {
        return this;
    };

    const $module = $class.new({
        name: 'module',
        // debug: true,
        components: [
            $var.new({ name: 'name' }),
            $var.new({
                name: 'env',
                default: () => ({}),
                debug: false,
            }),
            $var.new({
                name: 'imports',
                desc: 'the other modules available within this one',
                default: [],
            }),
            $var.new({ name: 'on-load' }),
            function key(name) {
                return '$' + name.deskewer();
            },
            function repo(className) {
                return this.env()[this.key(className)] || {};
            },
            function find(className, name) {
                // totally dies to recursion!
                const v = this.repo(className)[this.key(name)];
                if (v) {
                    return v;
                } else {
                    this.dlog('imports', this.imports());
                    for (const imp of this.imports()) {
                        this.dlog('find', className, name, imp);
                        const iv = imp.find(className, name);
                        if (iv) {
                            return iv;
                        }
                    }
                }
                throw new Error('fail to find ' + className + '/' + name);
            },
            function proxy(className) {
                return new Proxy(this, {
                    get(target, p) {
                        return target.find(className, p);
                    }
                })
            },
            function symname(sym) {
                return '_' + sym.deskewer();
            },
            function def(obj) {
                this.dlog('def', obj, obj.class());
                const className = this.key(obj.class().name());
                const name = this.key(obj.name());
                const env = this.env();
                if (!env.hasOwnProperty(className)) {
                    this.dlog('env init for class', className);
                    env[className] = {};
                }
                env[className][name] = obj;
            },
            function child(moddef) {
                return $.module.new({
                    imports: [this, ...moddef.imports],
                    ...moddef
                })
            },
            function load() {
                this.on_load().apply(this, [this, this.proxy('class')]);
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
            }),
            function $() {
                return this.mod().proxy('class');
            },
            function new_module(moddef) {
                const m = $module.new(moddef);
                m.load();
            }
        ]
    });

    __ = $.simulabra_global.new({
        stack: new FrameStack(),
        mod: _,
        bootstrapped: true,
    });
    globalThis.SIMULABRA = __;

    $.class.new({
        name: 'primitive',
        components: [
            $.class,
            $.var.new({ name: 'components', default: [] }),
            $.var.new({ name: 'js_prototype' }),
            $.var.new({ name: 'methods', default: {} }),
            $.var.new({ name: 'name' }),
            function init() {
                for (let c of this.components()) {
                    c.load(this.js_prototype());
                }
                _.def(this);
                this.dlog('primitive init', this);
            },
            function extend(method) {
                method.load(this.js_prototype()); // wee-woo!
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
                return this;
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
            function description() {
                return `[${$.debug.format(...this).join(' ')}]`;
            },
        ]
    });

    $.primitive.new({
        name: 'function-primitive',
        js_prototype: Function.prototype,
        components: [
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
