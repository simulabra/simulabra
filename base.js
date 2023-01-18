console.log('bootstrap');
globalThis.SIMULABRA = {}; // glory be
const $_ = globalThis.SIMULABRA;

export const $base_object = {
// $base_object = {
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
            return $debug.debug() || this._should_debug;
        },
        debug(...args) {
            if (this.should_debug()) {
                $debug.log(...args);
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
            return this.vars().map(v => ` ${v.description()}`).join('');
        },
        vars() {
            let vs = [];
            for (const v of this.class().vars()) {
                const o = this[v.name()]();
                this.debug(v.name(), o);
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
Function.prototype.load = function(parent) {
    // console.log('fnload', this.name, parent._name)
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
        nameSlots(this.slots());
        nameSlots(this.static());

        // this.implements().map(iface => iface.satisfies(this));
        this.load(this);
        $_.mod?.addClass(this);
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
            //     throw new Error(`attempt to define already bound slot ${k} with ${$debug.formatArgs(v)}`);
            // }
            v?.load && v.load(target.proto());
            if (v && 'class' in v && v.class().name() === 'var') {
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
        if (obj._super && obj._super.subclasses) {
            obj._super.subclasses().push(obj);
        } else if (obj._super == undefined) {
            obj._super = $base_object;
        }
        obj.init(this);
        this.validate(obj);
        return obj;
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
        return $class;
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
        return this._vars;
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
};

export const $class = Object.create(classSlots);
$class._slots = classSlots;
$class._name = 'class';
$class._idctr = 0;
$class._super = $base_object;
$class.init();

export const $var = $class.new({
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

export const $var_state = $class.new({
    name: 'var-state',
    slots: {
        v: $var.new(),
        state: $var.new(),
        description(d) {
            return `${this.v().name()}:${this.state().description()}`;
        }
    }
});

export const $description = $class.new({
    name: 'description',
    slots: {
        visited: $var.default({}),
    },
});

export const $debug = $class.new({
    name: 'debug',
    static: {
        debug: $var.default(false),
        log(...args) {
            console.log(...this.formatArgs(...args));
            return this;
        },
        formatArgs(...args) {
            return args.map(a => a ? a.short_description() : '' + a)
        },
        
    }
});

export const $message = $class.new({
    name: 'message',
    slots: {
        args: $var.default([]),
        ret: $var.default(null),
        name: $var.new(),
    },
})

export const $method = $class.new({
    name: 'method',
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

export const $virtual = $class.new({
    name: 'virtual',
    slots: {
        name: $var.new(),
        load(parent) {
            // $debug.log('virtual load', this);
            // parent[this.name()] = function() { throw new Error(`not implemented: ${this.name()}`); };
            // parent[this.name()].virtual = true;
        },
        overrides() {
            return false;
        },
    }
});

export const $arg = $class.new({
    name: 'arg',
    slots: {
        type: $var.new(),
    },
});

$class.super($base_object);
$class._proto._super = $base_object;

export const $primitive = $class.new({
    name: 'primitive',
    abstract: true,
    slots: {
        slots: $var.default({}),
        js_prototype: $var.new(),
        methods: $var.default({}),
        init() {
            for (const [name, fn] of this.slots().entries()) {
                // console.log(`jack in to primitive ${this.name()} ${name}`)
                this._js_prototype[name] = fn;
            }
        },
        name() {
            return this.class().name();
        }
        // extend(iface, slots) {}
    }
});

export const $object_primitive = $primitive.new({
    name: 'object-primitive',
    js_prototype: Object.prototype,
});

Object.prototype.class = function() {
    return $object_primitive;
}

export const $string_primitive = $primitive.new({
    name: 'string-primitive',
    super: $primitive,
    js_prototype: String.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return $string_primitive;
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

export const $boolean_primitive = $primitive.new({
    name: 'boolean-primitive',
    js_prototype: Boolean.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return $boolean_primitive;
        },
        short_description() {
            return this.toString();
        }
    }
});

export const $number_primitive = $primitive.new({
    name: 'number-primitive',
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
            return $number_primitive;
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

export const $array_primitive = $primitive.new({
    name: 'array-primitive',
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
            return $array_primitive;
        },
        short_description() {
            return `[${this.map(a => a.short_description()).join(' ')}]`;
        },
        description() {
            return `[${this.map(a => a.description()).join(' ')}]`;
        },
    }
});

export const $function_primitive = $primitive.new({
    name: 'function-primitive',
    js_prototype: Function.prototype,
    slots: {
        overrides(_proto) {
            return true;
        }
    },
});

export const $mixin = $class.new({
    name: 'mixin',
    slots: {
        slots: $var.default({}),
        mix(base) {
            if (base === null) {
                return this;
            }
            return $mixin.new({
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

export const $interface = $class.new({
    name: 'interface',
    slots: {
        name: $var.new(),
        slots: $var.default({}),
        slotList: $method.do(function() {
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
