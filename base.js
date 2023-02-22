console.log('bootstrap');
var __ = {};

let symbolTable = {};
function $s(value) {
    if (!symbolTable[value]) {
        symbolTable[value] = value;
    }
    return symbolTable[value];
}

function MethodImpl(name) {
    this.name = name;
    this.primary = null;
    this.befores = [];
    this.afters = [];
}

MethodImpl.prototype.reify = function(proto) {
    const self = this;
    proto[this.name] = function(...args) {
        __.pushframe(self); // uhh
        self.befores.forEach(b => b.apply(this, args));
        let res = self.primary.apply(this, args);
        self.afters.forEach(a => a.apply(this, args)); // res too?
        return res;
    }
}

function ClassPrototype() {
    this._impls = {};
}

ClassPrototype.prototype._reify = function reify() {
    for (const impl of Object.values(this._impls)) {
        impl.reify(this);
    }
}

ClassPrototype.prototype._add = function add(name, op) {
    if (!(name in this._impls)) {
        this._impls[name] = new MethodImpl(name);
    }
    op.combine(this._impls[name]);
}

Object.prototype.eq = function(other) {
    return this === other;
}
Object.prototype.className = function() {
    return this.class()?.name() || typeof this;
}
Object.prototype.entries = function() {
    return Object.entries(this);
}
Object.prototype.values = function() {
    return Object.values(this);
}
Object.prototype.displayName = function() {
    return typeof this;
}
Object.prototype.description = function() {
    return `Native Object (${typeof this})`;
}
Object.prototype.contains = function(i) {
    return i in this;
}
Object.prototype.print = function() {
    return this.toString();
}
Object.prototype.estree = function() {
    return {
        type: 'Literal',
        value: this,
    };
}
Function.prototype.load = function(proto) {
    console.log('fnload', this.name, proto);
    proto._add(this.name, this);
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
}

function bvar(name, desc = {}) {
    const key = '_' + name;
    return {
        name() {
            return name;
        },
        load(target) {
            if (desc.static) {
                target = target._class;
            }
            // console.log('bvar load', name, key, target);
            target[name] = function(assign) {
                if (assign !== undefined) {
                    // console.log('bvar set', name, key);
                    this[key] = assign;
                } else if (this[key] === undefined && desc.default !== undefined) {
                    this[key] = typeof desc.default === 'function' ? desc.default() : desc.default;
                }
                return this[key];
            }
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
    function log(...args) {
        if ($debug && this.class().debug()) {
            $debug.log(this.class().name() + '/' + this.name(), ...args);
        }
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
        this.proto(new ClassPrototype());
        $base_components.load(this.proto());
        this._proto._class = this;
        this.load(this.proto());
        if (__.mod) {
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


const $class_slots = new ClassPrototype();
$class_slots.new = function(props = {}) {
    // console.log('class new ' + props.name);
    const obj = Object.create(this.proto());
    parametize(props, obj);
    obj.init(this);
    return obj;
};

manload($base_components, $class_slots);
manload($class_components, $class_slots);
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
        bvar('static', {}),
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
        function load(target) {
            // console.log('var load', this.name());
            const pk = '_' + this.name().deskewer();
            if (this.static()) {
                target = target._class;
            }
            function mutableAccess(self) {
                return function(assign) {
                    if (assign !== undefined) {
                        this[pk] = assign;
                        ('update' in this) && this.update({ changed: self.name() }); // best there is?
                        return this;
                    }
                    if (!(pk in this)) {
                        this[pk] = self.defval(this);
                    }
                    return this[pk];
                }
            };
            function immutableAccess(self) {
                return function(assign) {
                    if (assign !== undefined) {
                        throw new Error(`Attempt to set immutable variable ${self.name()} ${pk}`);
                    }
                    if (!(pk in this)) {
                        // should this not be set?
                        this[pk] = self.defval(this);
                    }
                    return this[pk];
                }
            }
            if (this.mutable()) {
                target[this.name().deskewer()] = mutableAccess(this);
            } else {
                target[this.name().deskewer()] = immutableAccess(this);
            }
        },
    ]
});

String.prototype.deskewer = function() {
    return this.replace(/-/g, '_');
};

const $var_state = $class.new({
    name: 'var-state',
    components: [
        $var.new({ name: 'v' }),
        $var.new({ name: 'state' }),
        function description(d) {
            // console.log(this.v().name());
            return `${this.v().name()}:${this.state().description()}`;
        }
    ]
});

const $method = $class.new({
    name: 'method',
    components: [
        $var.new({ name: 'do' }), // fn, meat and taters
        $var.new({ name: 'message' }),
        $var.new({ name: 'name' }),
        $var.new({ name: 'static', default: false }),
        function load(target) {
            if (this.static()) {
                target = target._class;
            }
            this.do()._method = this;
            target[this.name()] = this.do();
        },
    ]
});

var $debug = $class.new({
    name: 'debug',
    components: [
        $method.new({
            name: 'log',
            static: true,
            do: function log(...args) {
                // console.trace();
                console.log(...this.format(...args));
                return this;
            }
        }),
        $method.new({
            name: 'format',
            static: true,
            do: function format(...args) {
                return args.map(a => a ? a.description() : '' + a)
            }
        }),
    ]
});

const $before = $class.new({
    name: 'before',
    components: [
        $var.new({ name: 'name' }),
        $var.new({ name: 'do' }),
        $var.new({ name: 'static', default: false }),
        function load(target) {
            if (this.static()) {
                target = target._class;
            }
            const self = this;
            const orig = target[this.name()];
            if (!orig) {
                throw new Error('before loaded on missing method ' + this.description());
            }
            target[this.name()] = function(...args) {
                self.do.apply(this, args);
                return orig.apply(this, args);
            }
        }
    ]
});

const $after = $class.new({
    name: 'after',
    components: [
        $var.new({ name: 'name' }),
        $var.new({ name: 'do', debug: false }),
        $var.new({ name: 'static', default: false }),
        function load(target) {
            if (this.static()) {
                target = target.class();
            }
            this.log('load', this, target);
            const self = this;
            const orig = target[this.name()];
            if (!orig) {
                throw new Error('after loaded on missing method ' + this.description());
            }
            target[this.name()] = function(...args) {
                const ret = orig.apply(this, args);
                self.log('do', self, this);
                self.do().apply(this, args);
                return ret;
            }
        }
    ]
});


const $virtual = $class.new({
    name: 'virtual',
    components: [
        $var.new({ name: 'name' }),
        function load(parent) {
            this.log('virtual load', this);
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
                for (const imp of this.imports()) {
                    this.log('find', className, name, imp);
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
            this.log('def', obj, obj.class());
            const className = this.key(obj.class().name());
            const name = this.key(obj.name());
            if (this.env()[className] === undefined) {
                this.log('env init for class', className);
                this.env()[className] = {};
            }
            this.env()[className][name] = obj;
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

_.def($class);
_.def($var);
_.def($method);
_.def($debug);
_.def($var_state);
_.def($virtual);
_.def($before);
_.def($after);
_.def($module);

_.def($.class.new({
    name: 'simulabra',
    components: [
        $.var.new({ name: 'mod' }),
    ]
}));

__ = $.simulabra.new({
    mod: _,
});


$.class.new({
    name: 'primitive',
    components: [
        $.var.new({ name: 'components', default: [] }),
        $.var.new({ name: 'js_prototype' }),
        $.var.new({ name: 'methods', default: {} }),
        $.var.new({ name: 'name' }),
        function init() {
            for (let c of this.components()) {
                c.load(this._js_prototype);
            }
            _.def(this);
            this.log('primitive init', this);
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
            return `[
${this.map(a => a ? a.description() : '???').map(e => '  ' + e).join('\n')}
]`;
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
