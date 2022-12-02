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
const _Object = {
    _name: 'Object',
    _js_prototype: Object.prototype,
    _slots: {
        init() { },
        // if this object doesn't have a _name, give it that of the symbol version of name
        loadslots() {
            for (const val of Object.values(this)) {
                val?.load && val.load(this);
            }
        },
        update(event) {

        },
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
        proto() {
            return null;
        }
    }
};

_Object._proto = _Object._slots;
Object.prototype.loadslots = _Object._proto.loadslots;
Object.prototype.proto = _Object._proto.proto;
Object.prototype.eq = function(other) {
    return this === other;
}
Object.prototype.className = function() {
    if (this.hasOwnProperty('_class')) {
        return this._class.name();
    } else {
        return typeof this;
    }
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

const _Class = {
    simple(name, easyslots, sup=_Object) {
        const slots = {};
        for (const v of easyslots) {
            switch (v.className()) {
                case 'string':
                    slots[v] = _Var.new();
                    break;
                case 'Var':
                    slots[v.name()] = v;
                    break;
            }
        }
        return _Class.new({
            name: name,
            super: sup,
            slots: slots,
        });
    },
    _slots: {
        _name: 'Class', // non-type, non-slot object => default
        _slots: {},
        _static: {},
        _super: {
            proto() {
                return {};
            }
        },
        _subclasses: null,
        _vars: null,
        _methods: null,
        _implements: [],
        _idctr: 0,
        init(_parent) {
            this._vars = [];
            this._methods = [];
            this._subclasses = [];
            this._proto = {
                ...this.mixed(),
                ...this._slots,
            };
            this.nameSlots();
            this.proto().loadslots();
            this.super(this.super());
            this.implements().map(iface => iface.satisfies(this));
            for (const [k, v] of Object.entries(this._static)) {
                // console.log('static? ' + k, v, this)
                v.load(this);
            }
            for (const [k, v] of Object.entries(this._slots)) {
                if (v && v.name instanceof Function && !v.name()) {
                    v.name(k);
                }
                if (v && v.class instanceof Function) {
                    if (v.class() === _Var) {
                        this._vars.push(v);
                    } else if (v.class === _Method) {
                        this._methods.push(v);
                    }
                }
            }
        },
        new(props = {}) {
            let obj = parametize(props);
            Object.setPrototypeOf(obj, this.proto());
            obj._class = this;
            if ('init' in obj) {
                obj.init(this);
            }
            if (this._id) {
                obj._id = this._id.child(obj.name(), this.nextid());
            }
            if (obj._super && obj._super.addSubclass) {
                obj._super.addSubclass(obj);
            }
            return obj;
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
        super(superclass) {
            if (superclass !== undefined) {
                this._super = superclass;
                Object.setPrototypeOf(this.proto(), this.super().proto());
            }
            return this._super;
        },
        addSubclass(subclass) {
            this._subclasses.push(subclass);
        },
        subclasses() {
            return this._subclasses;
        },
        nameSlots() {
            for (const [k, v] of Object.entries(this.slots())) {
                if (v && typeof v.name === 'function' && !v.name()) {
                    v.name(k);
                }
            }
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
        _mutable: true,
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
                        throw new Error(`Attempt to set immutable variable ${this.name()}`);
                    }
                    if (!(pk in this)) {
                        this[pk] = self.default(this);
                    }
                    return this[pk];
                }
            }
            if (this._mutable) {
                parent[this.name()] = mutableAccess(this);
            } else {
                parent[this.name()] = immutableAccess(this);
            }
            if (parent.vars instanceof Function) {
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
    },
})

const _Method = _Class.new({
    name: 'Method',
    static: {
        do(fn) {
            return this.new({
                do: fn
            });
        },
    },
    slots: {
        do: _Var.new({ mutable: false }), // fn, meat and taters
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
            this._do._method = this;
            parent[this.name()] = this._do;
            if (parent.methods instanceof Function) {
                parent.methods().push(this);
            }
        },
    }
});

const _Arg = _Class.new({
    name: 'Arg',
    slots: {
        type: _Var.new(),
    },
});

const _ComputedVar = _Class.new({
    name: 'ComputedVar',
    slots: {
        deps: _Var.new(),
        formula: _Var.new(),
        dirty: _Var.default(true),
        cached: _Var.new(),
        get: _Method.do(function get() {
            if (this.dirty()) {
                this.cached(this.formula());
            }
            return this.cached();
        }),
        load(parent) {

        }
    }
});

const _BaseObject = _Class.new({
    name: 'BaseObject',
    super: {},
    slots: {
        init() {},
        class() {
            return this._class;
        },
    }
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
        }
    }
});

_Object._class = _Primitive;
Object.setPrototypeOf(_Object, _Primitive._proto);
// maybe don't?
// _Primitive._slots.init.apply(_Object);



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
    super: _Class, // tests pass I guess?
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

const _Command = _Interface.new({
    name: 'Command',
    slots: {

    }
});

const _ = _Module.new({
    exports: [
        _Class,
        _Object,
        _Var,
        _Method,
        _Id,
        _Primitive,
        _Method,
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
