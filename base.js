/*
Your task: to construct a better object system on top of Javascript

Ultimately all objects belong to a class.
Type system is like that of Strongtalk, using f-bounded polymorphism. 
The class methods object is used as the instance's prototype
_.class methods' prototype is superclass' class methods (side chain?)
Instance can override them locally (it's still prototypical) 
Subject to typechecking (which can be ignored or lied to, at peril!)
Single inheritance with mixins, merged into intermediate anonymous parent
Every object has an identity
*/

// hook up object to class
console.log('bootstrap');
globalThis.SIMULABRA = {}; // glory be
const _ = globalThis.SIMULABRA;

_.base_object = {
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
        name() {
            if ('_name' in this) {
                return this._name;
            }
        },
        abstract() {
            return this._abstract || false;
        },
        //=!stringify
        toString() {
            return this.description();
        },
        //=!debug-target
        should_debug() {
            return _.debug.debug() || this._should_debug;
        },
        debug(...args) {
            if (this.should_debug()) {
                _.debug.log(...args);
            }
        },
        //=!description
        displayName() {
            return this.name() || '?';
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
                    vs.push(_.var_state.new({
                        v,
                        state: o,
                    }));
                }
            }
            return vs;
        },
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
Object.prototype.class = function() {
    return _.object_primitive;
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

function parametize(obj) {
    const ret = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k[0] !== '_') {
            ret['_' + k] = v;
        } else {
            throw new Error('unneeded _');
        }
    }
    return ret;
}

function nameSlots(obj) {
    for (const [k, v] of obj.entries()) {
        if (v && typeof v.name === 'function' && !v.name()) {
            v.name(k);
        }
    }
}

_.class = {
    _slots: {
        _name: 'class',
        _idctr: 0,
        _super: _.base_object,
        init() {
            this._vars = [];
            this._methods = [];
            this._subclasses = [];
            this._idctr = 0;
            this._proto = { _class: this };
            this.defaultInitSlot('slots', {});
            this.defaultInitSlot('static', {});
            this.defaultInitSlot('implements', []);
            nameSlots(this.slots());
            nameSlots(this.static());

            Object.setPrototypeOf(this.proto(), this.super().proto());
            // this.implements().map(iface => iface.satisfies(this));
            this.load(this);
        },
        load(target) {
            for (const [k, v] of this.static().entries()) {
                v.load(target);
            }
            for (const [k, v] of this.components().entries()) {
                // console.log(`loadslot ${k} from ${this.name()} onto ${target.name()}`);
                v?.load && v.load(target.proto());
            }
        },
        new(props = {}) {
            const obj = parametize(props);
            Object.setPrototypeOf(obj, this.proto());
            if (!obj._intid) {
                obj._intid = this.nextid();
            }
            if (obj._super && obj._super.subclasses) {
                obj._super.subclasses().push(obj);
            } else if (obj._super == undefined) {
                obj._super = _.base_object;
            }
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
        nextid() {
            return ++this._idctr;
        },
        super() {
            return this._super;
        },
        class() {
            return _.class;
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
            return this.slots().values().filter(v => v.className() === '_.var');
        },
        methods() {
            return this._methods;
        },
        mixins() {
            return this._mixins;
        },
        mixed() {
            if (this.mixins()?.length > 0) {
                return this.mixins().reduce((prev, cur) => {
                    return cur.mix(prev);
                }, null).slots();
            } else {
                return {};
            }
        },
        slots() {
            return this._slots;
        },
        components() {
            return [...this._slots.values(), ...this.super().components()];
        },
        static() {
            return this._static;
        },
    }
}

Function.prototype.load = function(parent) {
    parent[this.name] = this;
};

Function.prototype.short_description = function() {
    return `Native Function ${this.name}`;
}

Object.setPrototypeOf(_.class, _.class._slots); // prototypical roots mean we can avoid Metaclasses

_.class.init();

_.var = _.class.new({
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
            return this._debug || _.debug.debug();
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
                    } else if (!(pk in this)) {
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
        }
    }
});

_.var_state = _.class.new({
    name: 'var-state',
    slots: {
        v: _.var.new(),
        state: _.var.new(),
        description(d) {
            return `${this.v().name()}:${this.state().description()}`;
        }
    }
});

_.description = _.class.new({
    name: 'description',
    slots: {
        visited: _.var.default({}),
    },
});

_.debug = _.class.new({
    name: 'debug',
    static: {
        debug: _.var.default(false),
        log(...args) {
            console.log(...args.map(a => '' + a));
        },
        logt(...args) {
            console.log(args.map(a => a.toString()).join(''));
        }
    }
});

_.message = _.class.new({
    name: 'message',
    slots: {
        args: _.var.default([]),
        ret: _.var.default(null),
        name: _.var.new(),
    },
})

_.method = _.class.new({
    name: 'method',
    slots: {
        do: _.var.new(), // fn, meat and taters
        message: _.var.new(),
        name: _.var.new(),
        init() {
            const self = this;
            if (_.debug.debug()) {
                const fn = this.do();
                this.do(function(...args) {
                    console.log(`${this.displayName()}.${self.name()}(${args.map(a => a.displayName())})`);
                    return fn.apply(this, args);
                });
            }
            if (!this.message()) {
                this.message(_.message.new({
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
    }
});

_.method.do = function(fn) {
    return _.method.new({ do: fn });
}

_.virtual = _.class.new({
    slots: {
        name: _.var.new(),
        load(parent) {
            // console.log(`virtual load ${this.name()} ${parent._class.name()}`)
            if (!parent._class.abstract() && !(this.name() in parent)) {
                throw new Error(`need to implement ${this.name()} for ${parent._class.name()}`);
            }
        },
    }
});

_.arg = _.class.new({
    name: 'arg',
    slots: {
        type: _.var.new(),
    },
});

_.class.super(_.base_object);
_.class._proto._super = _.base_object;

_.primitive = _.class.new({
    name: 'primitive',
    abstract: true,
    slots: {
        slots: _.var.default({}),
        js_prototype: _.var.new(),
        methods: _.var.default({}),
        init() {
            for (const [name, fn] of this.slots().entries()) {
                // console.log(`jack in to primitive ${this.name()} ${name}`)
                this._js_prototype[name] = fn;
            }
        },
        // extend(iface, slots) {}
    }
});

_.object_primitive = _.primitive.new({
    name: 'object-primitive',
    js_prototype: Object.prototype,
});

_.string_primitive = _.primitive.new({
    name: 'string-primitive',
    super: _.primitive,
    js_prototype: String.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return _.string_primitive;
        },
        short_description() {
            return `'${this}'`;
        },
        js() {
            return this;
        }
    }
});

_.boolean_primitive = _.primitive.new({
    name: 'boolean-primitive',
    js_prototype: Boolean.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return _.boolean_primitive;
        },
        short_description() {
            return this.toString();
        }
    }
});

_.number_primitive = _.primitive.new({
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
            return _.number_primitive;
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

_.array_primitive = _.primitive.new({
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
            return _.array_primitive;
        },
        short_description() {
            return `(${this.map(a => a.short_description()).join(' ')})`;
        },
        description() {
            return `(${this.map(a => a.description()).join(' ')})`;
        },
    }
});

_.function_primitive = _.primitive.new({
    name: 'function-primitive',
    js_prototype: Function.prototype,
    slots: {
    },
});

_.mixin = _.class.new({
    name: 'mixin',
    slots: {
        slots: _.var.default({}),
        mix(base) {
            if (base === null) {
                return this;
            }
            return _.mixin.new({
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

_.interface = _.class.new({
    name: 'interface',
    slots: {
        name: _.var.new(),
        slots: _.var.default({}),
        slotList: _.method.do(function() {
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
