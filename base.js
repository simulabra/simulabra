console.log('bootstrap');
globalThis.SIMULABRA = {}; // glory be
const __ = globalThis.SIMULABRA;

let symbolTable = {};
export function $s(value) {
    if (!symbolTable[value]) {
        symbolTable[value] = value;
    }
    return symbolTable[value];
}

Object.defineProperty(String.prototype, 's', {
    get() {
        return $s(this);
    }
});

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
Function.prototype.load = function(parent) {
    // console.log('fnload', this.name, parent._class._name)
    parent[this.name] = this;
};
Function.prototype.description = function() {
    return `Native Function ${this.name}`;
}
Function.prototype.overrides = function() {
    return true;
}

function bvar(name, desc) {
    const key = '_' + name;
    return {
        name() {
            return name;
        },
        load(target) {
            if (desc.static) {
                target = target._class;
            }
            target[name] = function(assign) {
                if (assign !== undefined) {
                    this[key] = assign;
                } else if (this[key] === undefined && desc.default !== undefined) {
                    this[key] = typeof desc.default === 'function' ? desc.default() : desc.default;
                }
                return this[key];
            }
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

const $base_proto = {
    init() {},
    class() {
        return this._class;
    },
    description() {
        return `{${this.class().description()} ${this._name || '???'}}`;
    }
}

const $class = {
    init() {
        this._proto = Object.create($base_proto);
        this._proto._class = this;
        this.defaultInitSlot('components', []);
        this.load(this.proto());
        if (__._mod) {
            __._mod.def(this);
            $debug.log('def', this.name())
        }
        $debug ? $debug.log('class init', this.name(), this.class()) : console.log('class init ' + this.name());
    },
    load(target) {
        for (const v of this.components()) {
            $debug ? $debug.log('component load', this, v) : '';
            v.load(target);
        }
    },
    new(props = {}) {
        // console.log('class new ' + props.name);
        const obj = Object.create(this.proto());
        parametize(props, obj);
        obj.init(this);
        return obj;
    },
    defaultInitSlot(slot, dval) {
        const pk = '_' + slot;
        if (!(pk in this)) {
            this[pk] = dval;
        }
    },
    name() {
        return this._name;
    },
    eq(other) {
        return this.name().eq(other.name());
    },
    class() {
        return this._class;
    },
    proto() {
        return this._proto;
    },
    components() {
        return this._components;
    },
    static() {
        return this._static;
    },
    abstract() {
        return this._abstract || false;
    },
    description() {
        return `~${this.name()}`;
    },
    descended(target) {
        return this === target || !!this.components().find(c => c === target);
    }
};

$class._name = 'class'.s;
$class._class = $class;
$class._proto = $class;

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
    name: 'var'.s,
    components: [
        defaultFn,
        bvar('name', {}),
        bvar('mutable', { default: true }),
        bvar('debug', {}),
        bvar('required', {}),
        bvar('static', {}),
        function should_debug() {
            return this._debug || $debug.debug();
        },
        function load(target) {
            // console.log('var load', this.name());
            const pk = '_' + this.name();
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
                        this[pk] = self.default(this);
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
                        this[pk] = self.default(this);
                    }
                    return this[pk];
                }
            }
            if (this.mutable()) {
                target[this.name()] = mutableAccess(this);
            } else {
                target[this.name()] = immutableAccess(this);
            }
        },
    ]
});

$class._name = 'class'.s;
$var._name = 'var'.s;

const $var_state = $class.new({
    name: 'var-state'.s,
    components: [
        $var.new({ name: 'v'.s }),
        $var.new({ name: 'state'.s }),
        function description(d) {
            // console.log(this.v().name());
            return `${this.v().name()}:${this.state().description()}`;
        }
    ]
});

const $method = $class.new({
    name: 'method'.s,
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
        function overrides(_proto) {
            return this._override;
        }
    ]
});

var $debug = $class.new({
    name: 'debug'.s,
    components: [
        $method.new({
            name: 'log',
            static: true,
            do: function log(...args) {
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
    name: 'before'.s,
    components: [
        $var.new({ name: 'name'.s }),
        $var.new({ name: 'do'.s }),
        function load(parent) {
            const self = this;
            const orig = parent[this.name()];
            if (!orig) {
                throw new Error('before loaded on missing method ' + this.description());
            }
            parent[this.name()] = function(...args) {
                self.do.apply(this, args);
                return orig.apply(this, args);
            }
        }
    ]
});

const $after = $class.new({
    name: 'after'.s,
    components: [
        $var.new({ name: 'name'.s }),
        $var.new({ name: 'do'.s }),
        function load(parent) {
            $debug.log('after load', this, parent.class());
            const self = this;
            const orig = parent[this.name()];
            if (!orig) {
                throw new Error('before loaded on missing method ' + this.description());
            }
            parent[this.name()] = function(...args) {
                const ret = orig.apply(this, args);
                $debug.log('after do', this, self, parent._class);
                self.do().apply(this, args);
                return ret;
            }
        }
    ]
});


const $virtual = $class.new({
    name: 'virtual'.s,
    components: [
        $var.new({ name: 'name'.s }),
        function load(parent) {
            $debug.log('virtual load', this);
            parent[this.name()] = function() { throw new Error(`not implemented: ${this.name()}`); };
            parent[this.name()].virtual = true;
        },
        function overrides() {
            return false;
        },
    ]
});

String.prototype.deskewer = function() {
    return this.replace(/-/g, '_');
};

String.prototype.description = function() {
    return this;
};

const $module = $class.new({
    name: 'module'.s,
    components: [
        $var.new({ name: 'name'.s }),
        $var.new({
            name: 'env'.s,
            default: () => ({}),
            debug: false,
        }),
        $var.new({
            name: 'classes'.s,
            desc: 'locally defined classes',
            default: {},
            debug: false,
        }),
        $var.new({
            name: 'macros'.s,
            desc: 'macro definitions',
            default: {},
            debug: false,
        }),
        $var.new({
            name: 'imports'.s,
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
            $debug.log(className, this, this.repo(className))
            const v = this.repo(className)[this.key(name)];
            if (v) {
                return v;
            } else {
                for (const imp of this.imports()) {
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
                    $debug.log('proxy', className, p, target, target.find(className, p))
                    return target.find(className, p);
                }
            })
        },
        function symname(sym) {
            return '_' + sym.deskewer();
        },
        function def(obj) {
            const className = this.key(obj.class().name());
            const name = this.key(obj.name());
            if (this.env()[className] === undefined) {
                $debug.log('env init for class', className);
                this.env()[className] = {};
            }
            $debug.log('def', className, name)
            this.env()[className][name] = obj;
        },
        function defmacro(macro) {
            $.debug.log('defmacro', macro.name().deskewer());
            this.macros()['_' + macro.name().deskewer()] = macro;
        },
        function macro(name) {
            $.debug.log('get macro', name);
            return this.macros()['_' + name];
        }
    ]
});

__._base = $module.new({ name: 'base'.s });
var _ = __._base;
__._mod = _;
__.mod = function mod(name) {
    const m = $module.new({ name })
    __._mod = m;
    return m;
}
const $ = _.proxy('class');
__.$base = $;

_.def($class);
_.def($var);
_.def($method);
_.def($debug);
_.def($var_state);
_.def($virtual);
_.def($before);
_.def($after);
_.def($module);


$.class.new({
    name: 'primitive'.s,
    components: [
        $var.new({ name: 'components'.s, default: [] }),
        $var.new({ name: 'js_prototype'.s }),
        $var.new({ name: 'methods'.s, default: {} }),
        $var.new({ name: 'name'.s }),
        function init() {
            for (let c of this.components()) {
                c.load(this._js_prototype);
            }
            _.def(this);
            $.debug.log('primitive init', this);
        },
        function extend(method) {
            method.load(this.js_prototype()); // wee-woo!
        }
    ]
});


$.primitive.new({
    name: 'object-primitive'.s,
    js_prototype: Object.prototype,
});

// Object.prototype.class = function() {
//     return $.object_primitive;
// }

$.primitive.new({
    name: 'string-primitive'.s,
    super: $.primitive,
    js_prototype: String.prototype,
    components: [
        $method.new({
            name: 'class'.s,
            do() {
                return $.string_primitive;
            },
        }),
        function description() {
            return this;
        },
    ]
});

$.primitive.new({
    name: 'boolean-primitive'.s,
    js_prototype: Boolean.prototype,
    components: [
        $method.new({
            name: 'class'.s,
            do() {
                return $.boolean_primitive;
            },
        }),
        function description() {
            return this.toString();
        }
    ]
});

$.primitive.new({
    name: 'number-primitive'.s,
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
            name: 'class'.s,
            do() {
                return $.number_primitive;
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
    name: 'array-primitive'.s,
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
            name: 'class'.s,
            do() {
                return $.boolean_primitive;
            },
        }),
        function description() {
            return `[${this.map(a => a.description()).join(' ')}]`;
        },
    ]
});

$.primitive.new({
    name: 'function-primitive'.s,
    js_prototype: Function.prototype,
});
