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

const $class = {
    init() {
        this._proto = Object.create($class);
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
$class.init();

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
    static: {
        default(val) {
            return this.new({ default: val });
        },
    },
    components: [
        defaultFn,
        function name(assign) {
            if (assign) {
                this._name = assign;
            }
            return this._name;
        },
        function mutable() {
            if ('_mutable' in this) {
                return this._mutable;
            } else {
                return true;
            }
        },
        function debug() {
            return this._debug;
        },
        function should_debug() {
            return this._debug || $debug.debug();
        },
        function required() {
            return this._required || false;
        },
        function load(parent) {
            // console.log('var load', this.name());
            const pk = '_' + this.name();
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
                parent[this.name()] = mutableAccess(this);
            } else {
                parent[this.name()] = immutableAccess(this);
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
                console.log(...this.formatArgs(...args));
                return this;
            }
        }),
        $method.new({
            name: 'formatArgs',
            static: true,
            do: function formatArgs(...args) {
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
        function find_class(name) {
            // totally dies to recursion!
            return this.classes()['_' + name] || this.imports().reduce((prev, cur) => prev ? prev : cur.find_class(name), undefined);
        },
        function class_proxy() {
            return new Proxy(this, {
                get(target, p) {
                    return target.find_class(p);
                }
            })
        },
        function symname(sym) {
            return '_' + sym.deskewer();
        },
        function def(obj) {
            if (obj.class().descended($class)) {
                console.log(obj.name());
                $debug.log(obj)
                this.classes()['_' + obj.name().deskewer()] = obj;
            }
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

_.def($class);
_.def($var);
_.def($method);
_.def($debug);
_.def($var_state);
_.def($virtual);
_.def($before);
_.def($after);

const $ = _.class_proxy();

$class.new({
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

Object.prototype.class = function() {
    return $.object_primitive;
}

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
