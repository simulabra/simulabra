console.log('bootstrap');
var __ = {
    _frames: [],
    pushframe(impl, receiver, args) {
        // console.log('pushframe', f.name);
        this._frames.push()
    },
    popframe() {

    },
    mod() {
        return this._mod;
    },
};

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
            // console.trace('call', self._name);
            __.pushframe(self, this, args); // uhh
            try {
                self._befores.forEach(b => b.apply(this, args));
                let res = self._primary.apply(this, args);
                // console.log('in reified', self.name, self.primary, res)
                self._afters.forEach(a => a.apply(this, args)); // res too?
                __.popframe();
                return res;
            } catch (e) {
                // $debug.log('failed message: call', self._name, 'on', this, 'with', args);
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


Object.prototype._add = function add(name, op) {
    this[name.deskewer()] = op;
}
Object.prototype.eq = function(other) {
    return this === other;
}
// Object.prototype.description = function() {
//     return `Native Object (${typeof this})`;
// }
Object.prototype.contains = function(i) {
    return i in this;
}
Object.prototype.print = function() {
    return this.toString();
}
// Object.prototype.estree = function() {
//     return {
//         type: 'Literal',
//         value: this,
//     };
// }
Function.prototype.load = function(proto) {
    // console.log('fnload', this.name, proto);
    proto._add(this.name, this);
};
Function.prototype.combine = function(impl) {
    impl._primary = this;
};
Function.prototype.description = function() {
    return `Native Function ${this.name}`;
}
Function.prototype.overrides = function() {
    return true;
}
Function.prototype.class = function() {
    return {
        descended() {
            return false;
        }
    }
};

String.prototype.deskewer = function() {
    return this.replace(/-/g, '_');
};

function bvar(name, desc = {}) {
    const key = '_' + name;
    return {
        name() {
            return name;
        },
        load(proto) {
            proto._add(name, function(assign) {
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

const $base_components = [
    function init() {},
    function description() {
        const vs = this.class().vars().map(v => {
            const k = v.name().deskewer();
            if (v.debug() && this[k]) {
                // $debug.log(v.name(), v.name().deskewer())
               return `${v.name()} ${this[v.name().deskewer()]()?.description()}`;
            } else {
                return null;
            }
        }).filter(s => s !== null).join(' ');
        return `{${this.class().description()}${vs.length > 0 ? ' ' : ''}${vs}}`;
    },
    function vars() {
        return this.class().vars().map(v => $var_state.new({ var_ref: v, value: this[v.name().deskewer()]() }));
    },
    function log(...args) {
        $debug.log(this.class().name() + '/' + this.name(), ...args);
    },
    function dlog(...args) {
        if ($debug && this.class().debug()) {
            this.log(...args);
        }
    },
    function load(proto) {
        proto._add(this.name(), this);
    },
    bvar('class'),
    bvar('name', { default: '?' }),
];

// const $base_proto = {};
// manload($base_components, $base_proto);

Array.prototype.load = function(target) {
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
$class_slots.new = function(props = {}) {
    // console.log('class new ' + props.name);
    const obj = Object.create(this.proto());
    parametize(props, obj);
    obj.init(this);
    return obj;
};

$class_slots._parent = $class_slots;

manload($base_components, $class_slots);
manload($class_components, $class_slots);
$class_slots._reify();
var $class = Object.create($class_slots);

$class.name('class');
$class.class($class);
$class.proto($class);

const defaultFn = {
    load(target) {
        target['default'] = function(ctx) {
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
            return `${this.var_ref().description()}=${this.value().description()}`;
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
                console.trace();
                console.log(...this.format(...args));
                return this;
            }
        }),
        $static.new({
            name: 'format',
            do: function format(...args) {
                return args.map(a => a && a.description ? a.description() : typeof a);
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
            this.dlog('load', this, target);
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
            parent[this.name()] = function() { throw new Error(`not implemented: ${this.name()}`); };
            parent[this.name()].virtual = true;
        },
        function overrides() {
            return false;
        },
    ]
});

String.prototype.description = function() {
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

// _.def($.class.new({
//     name: 'simulabra',
//     components: [
//         $.var.new({ name: 'mod' }),
//         function pushframe() {}
//     ]
// }));

// __ = $.simulabra.new({
//     mod: _,
// });


$.class.new({
    name: 'primitive',
    components: [
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
        }
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

globalThis.SIMULABRA = __;
