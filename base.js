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
const _BaseObject = {
    _name: 'BaseObject',
    _slots: {
        init() { },
        eq(other) {
            return this === other;
        },
        class() {
            if (this._class) {
                return this._class;
            } else {
                return null;
            }
        },
        name() {
            return this._name;
        },
    },
    name() {
        return this._name;
    },
    proto() {
        return this._proto;
    }
};

_BaseObject._proto = _BaseObject._slots;

Object.prototype.eq = function(other) {
    return this === other;
}

Object.prototype.className = function() {
    return this.class()?.name() || typeof this;
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
    for (const [k, v] of Object.entries(obj)) {
            // console.log('?nameslot', k, v);
        if (v && typeof v.name === 'function' && !v.name()) {
            // console.log('nameslot', k);
            v.name(k);
        }
    }
}

const _Class = {
    _slots: {
        _name: 'Class', // non-type, non-slot object => default
        _idctr: 0,
        _super: _BaseObject,
        init(_parent) {
            this._vars = [];
            this._methods = [];
            this._subclasses = [];
            this._proto = {};
            this.defaultInitSlot('slots', {});
            this.defaultInitSlot('static', {});
            this.defaultInitSlot('implements', []);
            nameSlots(this.slots());
            nameSlots(this.static());
            // console.log(this.name(), this.super().name());

            Object.setPrototypeOf(this.proto(), this.super().proto());
            // this.implements().map(iface => iface.satisfies(this));
            for (const [k, v] of Object.entries(this.static())) {
                // console.log('static? ' + k, v, this)
                v.load(this);
            }
            for (const [k, v] of Object.entries(this.slots())) {
                // console.log('slots? ' + k, v, this)
                v?.load && v.load(this.proto());
            }
            for (const [k, v] of Object.entries(this.mixed())) {
                // console.log('mix? ' + k, v, this)
                v?.load && v.load(this.proto());
            }
        },
        new(props = {}) {
            let obj = parametize(props);
            Object.setPrototypeOf(obj, this.proto());
            obj._class = this;
            if (this._id) {
                obj._id = this._id.child(obj.name(), this.nextid());
            }
            if (obj._super && obj._super.addSubclass) {
                obj._super.addSubclass(obj);
            } else if (obj._super == undefined) {
                obj._super = _BaseObject;
            }
            if ('init' in obj) {
                obj.init(this);
            }
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
            return _Class;
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
        vars() {
            return this._vars;
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
}

Object.setPrototypeOf(_Class, _Class._slots); // prototypical roots mean we can avoid Metaclasses

_Class.init();

const _Var = _Class.new({
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
        load(parent) {
            // console.log('var load', this.name());
            const pk = '_' + this.name();
            function mutableAccess(self) {
                return function(assign) {
                    if (assign !== undefined) {
                        this[pk] = assign;
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
            if (typeof parent.vars === 'function') {
                parent.vars().push(this);
            }
        }
    }
});

const _Message = _Class.new({
    name: 'Message',
    slots: {
        args: _Var.default([]),
        ret: _Var.default(null),
        name: _Var.new(),
    },
})

const _Method = _Class.new({
    name: 'Method',
    slots: {
        do: _Var.new(), // fn, meat and taters
        message: _Var.new(),
        name: _Var.new(),
        init() {
            if (!this.message()) {
                this.message(_Message.new({
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

_Method.do = function(fn) {
    return _Method.new({ do: fn });
}

const _Arg = _Class.new({
    name: 'Arg',
    slots: {
        type: _Var.new(),
    },
});

_Class.super(_BaseObject);
_Class._proto._super = _BaseObject;

const _Id = _Class.new({
    name: 'Id',
    slots: {
        _parent: null,
        _name: null,
        child(name, num) {
            return _.id.new({
                parent: this,
                name: name,
                num: num,
            });
        },
        toString() {
            return `${this._parent ? this._parent.toString() : ':'}:${this._name.name()}`;
        },
    },
});

const _Primitive = _Class.new({
    name: 'Primitive',
    super: _Class,
    slots: {
        _js_prototype: null,
        _methods: {},
        init() {
            for (const [name, fn] of Object.entries(this._slots)) {
                this._js_prototype[name] = fn;
            }
        },
    }
});

const _Module = _Class.new({
    name: 'Module',
    slots: {
        exports: _Var.default([]),
        init() {
            for (const item of this.exports()) {
                this[item.name()] = item;
            }
        }
    },
});
const _String = _Primitive.new({
    name: 'String',
    js_prototype: String.prototype,
    slots: {
        html() {
            return this;
        },
        class() {
            return _String;
        }
    }
});
const _Number = _Primitive.new({
    name: 'Number',
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
            return _Number;
        }
    }
});
const _Array = _Primitive.new({
    name: 'Array',
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
            return _Array;
        }
    }
});
const _Function = _Primitive.new({
    name: 'Function',
    js_prototype: Function.prototype,
    slots: {
    },
});

const _Mixin = _Class.new({
    name: 'Mixin',
    slots: {
        slots: _Var.default({}),
        mix(base) {
            if (base === null) {
                return this;
            }
            return _Mixin.new({
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

const _Interface = _Class.new({
    name: 'Interface',
    slots: {
        name: _Var.new(),
        slots: _Var.default({}),
        slotList: _Method.do(function() {
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

const _$Slot = _Interface.new({
    name: 'Slot',
    slots: {
        load: _Message.new({
            args: [
                _Arg.new({
                    name: 'parent',
                })
            ],
        })
    }
})

const _ = _Module.new({
    exports: [
        _Class,
        _BaseObject,
        _Var,
        _Method,
        _Id,
        _Primitive,
        _Method,
        _Message,
        _Module,
        _String,
        _Number,
        _Array,
        _Function,
        _Mixin,
        _Interface,
    ],
});

export default _;
