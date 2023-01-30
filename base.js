console.log('bootstrap');
globalThis.SIMULABRA = {}; // glory be
const __ = globalThis.SIMULABRA;

export const $base_object = {
// $.base_object = {
    _name: 'base-object',
    _slots: {
        //=!object
        init() { },
        class() {
            if (this._class) {
                return this._class;
            } else {
                return null;
            }
        },
        supercall(message, ...args) {
            return this.class().super().proto()[message].apply(this, args);
        },
        // name() {
        //     if ('_name' in this) {
        //         return this._name;
        //     }
        // },
        //=!stringify
        toString() {
            return this.description();
        },
        //=!debug-target
        should_debug() {
            return $.debug.debug() || this._should_debug;
        },
        debug(...args) {
            if (this.should_debug()) {
                $.debug.log(...args);
            }
        },
        //=!description
        displayName() {
            return this._name || '?';
        },
        base_description() {
            return `${this.displayName()} class:${this.class().name()} id:${this._intid}`;
        },
        short_description() {
            return `{${this.base_description()}}`;
        },
        description() {
            return `{${this.base_description()}${this.var_description()}}`
        },
        //=!private
        var_description() {
            return this.vars().filter(v => v.debug()).map(v => ` ${v.description()}`).join('');
        },
        vars() {
            let vs = [];
            for (const v of this.class().vars()) {
                const o = this[v.name()]();
                // $.debug.log('vars var', v.name(), o);
                if (o) {
                    vs.push($var_state.new({
                        v,
                        state: o,
                    }));
                }
            }
            return vs;
        },
    },
    description() {
       return '~base-object';
    },
    static() {
        return {};
    },
    load() {
        return;
    },
    components() {
        return [];
    },
    proto() {
        return this._slots;
    },
    descended(target) {
        return target === this;
    }
};

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
Object.prototype.short_description = function() {
    return `Native Object (${typeof this})`;
}
Object.prototype.description = function() {
    return this.short_description();
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
    // console.log('fnload', this.name)
    parent[this.name] = this;
};
Function.prototype.short_description = function() {
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

function nameSlots(obj) {
    for (const [k, v] of obj.entries()) {
        if (v && typeof v.name === 'function' && !v.name()) {
            v.name(k);
        }
    }
}

const classSlots = {
    init() {
        if (this.super() == undefined) {
            this._super = this.default_superclass();
        }
        if (this.super()?.subclasses) {
            this._super.subclasses().push(this);
        }
        this._vars = [];
        this._methods = [];
        this._subclasses = [];
        this._idctr = 0;
        this._proto = Object.create(this.super().proto());
        this._proto._class = this;
        this.defaultInitSlot('slots', {});
        this.defaultInitSlot('static', {});
        this.defaultInitSlot('implements', []);
        this.defaultInitSlot('components', []);
        this.defaultInitSlot('default_superclass', $base_object);
        nameSlots(this.slots());
        nameSlots(this.static());

        // this.implements().map(iface => iface.satisfies(this));
        this.load(this);
        if (__._mod) {
            __._mod.def(this);
            $debug.log('def', this.name())
        }
        $debug ? $debug.log('class init', this.name(), this.class()) : console.log('class init', this.name());
    },
    load(target) {
        this.super().load(target);
        for (const [k, v] of this._static.entries()) {
            v.load(target);
        }
        for (const v of this.components()) {
            v?.load && v.load(target);
        }
        for (const [k, v] of this.slots().entries()) {
            // console.log(`loadslot ${k} from ${this.name()} onto ${target.name()}`);

            // if (k in target.proto() && !v.overrides(target.proto())) {
            //     throw new Error(`attempt to define already bound slot ${k} with ${$.debug.formatArgs(v)}`);
            // }
            v?.load && v.load(target.proto());
            if (v && v.class && v.class() === $var) {
                this._vars.push(v);
            }
        }
    },
    new(props = {}) {
        const obj = Object.create(this.proto());
        parametize(props, obj);
        if (!obj._intid) {
            obj._intid = this.nextid();
        }
        obj.init(this);
        this.validate(obj);
        return obj;
    },
    default_superclass(c) {
        if (c) {
            // $.debug.log('set default superclass', this, c);
            this._default_superclass = c;
            return this;
        } else {
            return this._default_superclass || $base_object;
        }
    },
    validate(obj) {
        for (const v of this.vars()) {
            if (v.required() && !('_' + v.name() in obj)) {
                throw new Error(`var ${v.name()} required in ${obj.description()}`);
            }
        }
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
    nextid() {
        return ++this._idctr;
    },
    super() {
        return this._super;
    },
    class() {
        return this._class;
    },
    subclasses() {
        return this._subclasses;
    },
    implements() {
        return this._implements;
    },
    proto() {
        return this._proto;
    },
    vars() {
        return this._vars || [];
    },
    methods() {
        return this._methods;
    },
    mixins() {
        return this._mixins;
    },
    slots() {
        return this._slots;
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
        return `~${this.name().value()}`;
    },
    short_description() {
        return `~${this.name().value()}`;
    },
    descended(target) {
        return this === target || this.super().descended(target);
    }
};

const $class = Object.create(classSlots);
$class._slots = classSlots;
$class._idctr = 0;
$class._name = 'class';
$class._super = $base_object;
$class._class = $class;
$class.init();

var $var = $class.new({
    name: 'var',
    static: {
        default(val) {
            return this.new({ default: val });
        },
    },
    slots: {
        default(ctx) {
            if (this._default instanceof Function) {
                return this._default.apply(ctx);
            } else {
                return this._default;
            }
        },
        name(assign) {
            if (assign) {
                this._name = assign;
            }
            return this._name;
        },
        mutable() {
            if ('_mutable' in this) {
                return this._mutable;
            } else {
                return true;
            }
        },
        debug() {
            return this._debug;
        },
        should_debug() {
            return this._debug || $debug.debug();
        },
        required() {
            return this._required || false;
        },
        load(parent) {
            // console.log('var load', this.name());
            const pk = '_' + this.name();
            function mutableAccess(self) {
                return function(assign) {
                    if (assign !== undefined) {
                        this[pk] = assign;
                        this.debug(`set ${this.short_description()}.${self.name()} = ${assign.short_description()}`);
                        ('update' in this) && this.update({ changed: self.name() });
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
        overrides(_proto) {
            return this._override;
        }
    }
});

const $symbol = $class.new({
    slots: {
        value: $var.new(),
        description() {
            return ':' + this.value();
        },
        eq(other) {
            return this.value() === other.value();
        },
        deskewer() {
            return this.value().replace(/-/g, '_');
        },
    }
});

export function $s(value) {
    return $symbol.new({ value });
}

$class._name = $s('class');
$var._name = $s('var');

const $var_state = $class.new({
    name: $s('var-state'),
    slots: {
        v: $var.new(),
        state: $var.new(),
        description(d) {
            console.log(this.v().name());
            return `${this.v().name()}:${this.state().description()}`;
        }
    }
});

const $description = $class.new({
    name: $s('description'),
    slots: {
        visited: $var.default({}),
    },
});

var $debug = $class.new({
    name: $s('debug'),
    static: {
        debug: $var.default(false),
        log(...args) {
            console.log(...this.formatArgs(...args));
            return this;
        },
        formatArgs(...args) {
            return args.map(a => a ? a.description() : '' + a)
        },
        
    }
});

const $message = $class.new({
    name: $s('message'),
    slots: {
        args: $var.default([]),
        ret: $var.default(null),
        name: $var.new(),
    },
})

const $method = $class.new({
    name: $s('method'),
    static: {
        do(fn) {
            return this.new({ do: fn })
        }
    },
    slots: {
        do: $var.new(), // fn, meat and taters
        message: $var.new(),
        name: $var.new(),
        init() {
            const self = this;
            if ($debug.debug()) {
                const fn = this.do();
                this.do(function(...args) {
                    console.log(`${this.displayName()}.${self.name()}(${args.map(a => a.displayName())})`);
                    return fn.apply(this, args);
                });
            }
            if (!this.message()) {
                this.message($message.new({
                    args: this._args,
                    ret: this._ret,
                }));
            }
        },
        load(parent) {
            this.do()._method = this;
            parent[this.name()] = this.do();
            if (parent.methods instanceof Function) {
                parent.methods().push(this);
            }
        },
        overrides(_proto) {
            return this._override;
        }
    }
});

const $before = $class.new({
    name: $s('before'),
    slots: {
        name: $var.new(),
        do: $var.new(),
        load(parent) {
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
    }
});

const $after = $class.new({
    name: $s('after'),
    slots: {
        name: $var.new(),
        do: $var.new(),
        load(parent) {
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
    }
});


const $virtual = $class.new({
    name: $s('virtual'),
    slots: {
        name: $var.new(),
        load(parent) {
            $debug.log('virtual load', this);
            parent[this.name()] = function() { throw new Error(`not implemented: ${this.name()}`); };
            parent[this.name()].virtual = true;
        },
        overrides() {
            return false;
        },
    }
});

$class.super($base_object);
$class._proto._super = $base_object;

String.prototype.deskewer = function() {
    return this.replace(/-/g, '_');
};

String.prototype.description = function() {
    return this;
};

const $module = $class.new({
    name: $s('module'),
    slots: {
        name: $var.new(),
        classes: $var.new({
            desc: 'locally defined classes',
            default: {},
            debug: false,
        }),
        macros: $var.new({
            desc: 'macro definitions',
            default: {},
            debug: false,
        }),
        imports: $var.new({
            desc: 'the other modules available within this one',
            default: [],
        }),
        find_class(name) {
            // totally dies to recursion!
            return this.classes()['_' + name] || this.imports().reduce((prev, cur) => prev ? prev : cur.find_class(name), undefined);
        },
        class_proxy() {
            return new Proxy(this, {
                get(target, p) {
                    return target.find_class(p);
                }
            })
        },
        symname(sym) {
            return '_' + sym.deskewer();
        },
        def(obj) {
            if (obj.class().descended($class)) {
                this.classes()['_' + obj.name().deskewer()] = obj;
            }
        },
        defmacro(macro) {
            $.debug.log('defmacro', macro.name().deskewer());
            this.macros()['_' + macro.name().deskewer()] = macro;
        },
        macro(name) {
            $.debug.log('get macro', name);
            return this.macros()['_' + name];
        }
    }
});

__._base = $module.new({ name: $s('base') });
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
_.def($message);
_.def($debug);
_.def($description);
_.def($var_state);
_.def($virtual);
_.def($before);
_.def($after);

const $ = _.class_proxy();

$.class.new({
    name: $s('primitive'),
    abstract: true,
    static: {
        instances: $.var.default({}),
        for_type(type) {
            return this.instances()[type + '_primitive'];
        }
    },
    slots: {
        slots: $.var.default({}),
        js_prototype: $.var.new(),
        methods: $.var.default({}),
        name: $.var.new(),
        init() {
            for (const [name, fn] of this.slots().entries()) {
                // console.log(`jack in to primitive ${this.name()} ${name}`)
                this._js_prototype[name] = fn;
            }
            $.debug.log('primitive init', this);
            $.primitive.instances()[this.name().deskewer()] = this;
        },
        extend(method) {
            this.slots[method.name().deskewer()] = method;
            this._js_prototype[method.name().deskewer()] = method.do();
        }
        // extend(iface, slots) {}
    }
});

$.primitive.new({
    name: $s('object-primitive'),
    js_prototype: Object.prototype,
});

Object.prototype.class = function() {
    return $.object_primitive;
}

$.primitive.new({
    name: $s('string-primitive'),
    super: $.primitive,
    js_prototype: String.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return $.string_primitive;
        },
        short_description() {
            return this;
        },
        js() {
            return this;
        },
        className() {
            return 'string';
        }
    }
});

$.primitive.new({
    name: $s('boolean-primitive'),
    js_prototype: Boolean.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return $.boolean_primitive;
        },
        short_description() {
            return this.toString();
        }
    }
});

$.primitive.new({
    name: $s('number-primitive'),
    js_prototype: Number.prototype,
    slots: {
        js() {
            return this;
        },
        sqrt() {
            return Math.sqrt(this);
        },
        square() {
            return this ** 2;
        },
        class() {
            return $.number_primitive;
        },
        short_description() {
            return this.toString();
        },
        add(n) {
            return this + n;
        },
        sub(n) {
            return this - n;
        },
        pow(n) {
            return this ** n;
        },
    }
});

$.primitive.new({
    name: $s('array-primitive'),
    js_prototype: Array.prototype,
    slots: {
        intoObject() {
            const res = {};
            for (const it of this) {
                res[it.name()] = it;
            }
            return res;
        },
        class() {
            return $.array_primitive;
        },
        short_description() {
            return `[${this.map(a => a.short_description()).join(' ')}]`;
        },
        description() {
            return `[${this.map(a => a.description()).join(' ')}]`;
        },
    }
});

$.primitive.new({
    name: $s('function-primitive'),
    js_prototype: Function.prototype,
    slots: {
        overrides(_proto) {
            return true;
        }
    },
});

$.class.new({
    name: $s('mixin'),
    slots: {
        slots: $.var.default({}),
        mix(base) {
            if (base === null) {
                return this;
            }
            return $.mixin.new({
                slots: {
                    ...this.slots(),
                    ...base
                },
            });
        },
        init() {
            nameSlots(this.slots());
        },
        name() {
            return this._name;
        }
    }
});

$.class.new({
    name: $s('interface'),
    slots: {
        name: $.var.new(),
        slots: $.var.default({}),
        slotList: $.method.do(function() {
            return Object.values(this.slots());
        }),
        init() {
            nameSlots(this.slots());
        },
        satisfies(klass) {
            // console.log(`check satisfies ${this.name()} for class ${klass.name()}`);
            const missing = this.slotList().filter(slot => {
                return !(slot.name() in klass.proto());
            });
            if (missing.length > 0) {
                throw new Error(`class ${klass.name()} doesn't satisfy interface ${this.name()}: ${missing.map(mi => mi.name()).join(', ')}`);
            }
            return true;
        },
    },
});
