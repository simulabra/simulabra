/*
Your task: to construct a better object system on top of Javascript

Ultimately all objects belong to a class.
Type system is like that of Strongtalk, using f-bounded polymorphism. 
The class methods object is used as the instance's prototype
Class methods' prototype is superclass' class methods (side chain?)
Instance can override them locally (it's still prototypical) 
Subject to typechecking (which can be ignored or lied to, at peril!)
Single inheritance with mixins, merged into intermediate anonymous parent
Every object has an identity
*/

// hook up object to class
console.log('bootstrap');
export const DEBUG = false;
export function debug(...args) {
    console.log(...args.map(a => a.shortDescription()));
}

export const BaseObject = {
    _name: 'BaseObject',
    _slots: {
        init() { },
        class() {
            if (this._class) {
                return this._class;
            } else {
                return null;
            }
        },
        name() {
            if ('_name' in this) {
                return this._name;
            }
        },
        displayName() {
            return this.name() || '?';
        },
        shortDescription() {
            return `[${this.displayName()} class:${this.class().name()} id:${this._intid}]`;
        },
        super(message, ...args) {
            return this.class().super().proto()[message].apply(this, args);
        },
    },
    proto() {
        return this._slots;
    }
};

Object.prototype.eq = function(other) {
    return this === other;
}

Object.prototype.class = function() {
    return null;
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

Object.prototype.shortDescription = function() {
    return `Native Object (${typeof this})`;
}

function parametize(obj) {
    const ret = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k[0] !== '_') {
            ret['_' + k] = v;
        } else {
            throw new Error('unneeded _');
            ret[k] = v;
        }
    }
    return ret;
}

function nameSlots(obj) {
    for (const [k, v] of obj.entries()) {
            // console.log('?nameslot', k, v);
        if (v && typeof v.name === 'function' && !v.name()) {
            // console.log('nameslot', k);
            v.name(k);
        }
    }
}

export const Class = {
    _slots: {
        _name: 'Class', // non-type, non-slot object => default
        _idctr: 0,
        _super: BaseObject,
        init(_parent) {
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
            // console.log(this.name(), this.super().name());

            Object.setPrototypeOf(this.proto(), this.super().proto());
            // this.implements().map(iface => iface.satisfies(this));
            for (const [k, v] of this.static().entries()) {
                // console.log('static? ' + k, v, this)
                v.load(this);
            }
            for (const [k, v] of this.slots().entries()) {
                // console.log('slots? ' + k, v, this)
                v?.load && v.load(this.proto());
            }
            for (const [k, v] of this.mixed().entries()) {
                // console.log('mix? ' + k, v, this)
                v?.load && v.load(this.proto());
            }
        },
        new(props = {}) {
            let obj = parametize(props);
            Object.setPrototypeOf(obj, this.proto());
            if (!obj._intid) {
                obj._intid = this.nextid();
            }
            if (obj._super && obj._super.addSubclass) {
                obj._super.addSubclass(obj);
            } else if (obj._super == undefined) {
                obj._super = BaseObject;
            }
            if ('init' in obj) {
                obj.init(this);
            }
            DEBUG && debug(`new ${obj.shortDescription()}`);
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
            return Class;
        },
        addSubclass(subclass) {
            this._subclasses.push(subclass);
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
        addVar(v) {
            this._vars.push(v);
        },
        vars() {
            return this.slots().values().filter(v => v.className() === 'Var');
        },
        addMethod(m) {
            this._methods.push(m);
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
        static() {
            return this._static;
        },
        addslot(slot) {
            if (slot.name() in this._slots) {
                throw new Error('already in slots: ' + slot.name());
            }
            this._slots[slot.name()] = slot;
            slot.load(this._proto);
        },
        type() {

        },
    }
}

Function.prototype.load = function(parent) {
    parent[this.name] = this;
};

Function.prototype.shortDescription = function() {
    return `Native Function ${this.name}`;
}

Object.setPrototypeOf(Class, Class._slots); // prototypical roots mean we can avoid Metaclasses

Class.init();

// export const Id = Class.new({
//     name: 'Id',
//     slots: {
//         child(name, num) {
//             return _.id.new({
//                 parent: this,
//                 name: name,
//                 num: num,
//             });
//         },
//         toString() {
//             return `${this._parent ? this._parent.toString() : ':'}:${this._name.name()}`;
//         },
//     },
// });

// export const BaseId = Id.new({
//     name: 'Base',
// })

// Class._id = Id.new({
//     name: 'Class',
//     parent: BaseId,
// });

export const Var = Class.new({
    name: 'Var',
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
            return this._debug || DEBUG;
        },
        load(parent) {
            // console.log('var load', this.name());
            const pk = '_' + this.name();
            function mutableAccess(self) {
                return function(assign) {
                    if (assign !== undefined) {
                        this[pk] = assign;
                        if (self.debug()) {
                            debug(`set ${this.shortDescription()}.${self.name()} = ${assign.shortDescription()}`);
                        }
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

export const Message = Class.new({
    name: 'Message',
    slots: {
        args: Var.default([]),
        ret: Var.default(null),
        name: Var.new(),
    },
})

export const Method = Class.new({
    name: 'Method',
    slots: {
        do: Var.new(), // fn, meat and taters
        message: Var.new(),
        name: Var.new(),
        init() {
            const self = this;
            if (DEBUG) {
                const fn = this.do();
                this.do(function(...args) {
                    console.log(`${this.displayName()}.${self.name()}(${args.map(a => a.displayName())})`);
                    return fn.apply(this, args);
                });
            }
            if (!this.message()) {
                this.message(Message.new({
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

Method.do = function(fn) {
    return Method.new({ do: fn });
}

export const Arg = Class.new({
    name: 'Arg',
    slots: {
        type: Var.new(),
    },
});

Class.super(BaseObject);
Class._proto._super = BaseObject;

export const Primitive = Class.new({
    name: 'Primitive',
    super: Class,
    slots: {
        _js_prototype: null,
        _methods: {},
        init() {
            for (const [name, fn] of Object.entries(this._slots)) {
                this._js_prototype[name] = fn;
            }
        },
        extend(iface, slots) {

        }
    }
});

export const Module = Class.new({
    name: 'Module',
    slots: {
        exports: Var.default([]),
        init() {
            for (const item of this.exports()) {
                this[item.name()] = item;
            }
        }
    },
});

export const StringPrimitive = Primitive.new({
    name: 'StringPrimitive',
    js_prototype: String.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return String;
        },
        shortDescription() {
            return `'${this}'`;
        },
        js() {
            return this;
        }
    }
});

export const BooleanPrimitive = Primitive.new({
    name: 'BooleanPrimitive',
    js_prototype: Boolean.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return Boolean;
        },
        shortDescription() {
            return this.toString();
        }
    }
});

export const NumberPrimitive = Primitive.new({
    name: 'NumberPrimitive',
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
            return Number;
        },
        shortDescription() {
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

export const ArrayPrimitive = Primitive.new({
    name: 'ArrayPrimitive',
    js_prototype: Array.prototype,
    slots: {
        intoMap() {
            const res = {};
            for (const it of this) {
                res[it.name()] = it;
            }
            return res;
        },
        class() {
            return Array;
        }
    }
});

export const FunctionPrimitive = Primitive.new({
    name: 'FunctionPrimitive',
    js_prototype: Function.prototype,
    slots: {
    },
});

export const Mixin = Class.new({
    name: 'Mixin',
    slots: {
        slots: Var.default({}),
        mix(base) {
            if (base === null) {
                return this;
            }
            return Mixin.new({
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

export const Interface = Class.new({
    name: 'Interface',
    slots: {
        name: Var.new(),
        slots: Var.default({}),
        slotList: Method.do(function() {
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
                throw new Error(`Class ${klass.name()} doesn't satisfy interface ${this.name()}: ${missing.map(mi => mi.name()).join(', ')}`);
            }
            return true;
        },
    },
});

export const $Slot = Interface.new({
    name: 'Slot',
    slots: {
        load: Message.new({
            args: [
                Arg.new({
                    name: 'parent',
                })
            ],
        })
    }
})
