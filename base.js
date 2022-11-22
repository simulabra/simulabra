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
            for (let [key, val] of Object.entries(this)) {
                val?.load && val.load(key, this);
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
            }
        },
        name() {
            return this._name;
        }
    }
};
_Object._proto = _Object._slots;
Object.prototype.loadslots = _Object._proto.loadslots;

const _Class = {
    _slots: {
        _name: 'Class', // non-type, non-slot object => default
        _slots: {},
        _super: _Object,
        _mixins: [],
        _vars: [],
        _idctr: 0,
        init(_parent) {
            let mixslots = this._mixins.length > 0 ? this._mixins.reduce((prev, cur) => {
                return cur.mix(prev);
            }, null).slots() : {};
            this._proto = {
                ...mixslots,
                ...this._slots,
            };
            this._proto.loadslots();
            Object.setPrototypeOf(this._proto, this._super._proto);
        },
        new(props = {}) {
            let obj = props;
            Object.setPrototypeOf(obj, this._proto);
            obj._class = this;
            obj.init(this);
            if (this._id) {
                obj.id(this._id.child(obj.name(), this.nextid()));
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
        super() {
            return this._super;
        },
        proto() {
            return this._proto;
        },
        type() {

        }
    }
}

Object.setPrototypeOf(_Class, _Class._slots);
_Class.init();

const _Var = _Class.new({
    _name: 'Var',
    default(val) {
        return this.new({ _default: val });
    },
    _slots: {
        _type: null, //!nulltype, wtf?
        _default: null, //fn or object
        _mutable: true,
        default(ctx) {
            if (this._default instanceof Function) {
                return this._default.apply(ctx);
            } else {
                return this._default;
            }
        },
        load(name, parent) {
            const self = this;
            let pk = '_' + name;
            if (this._mutable) {
                parent[name] = function (assign) {
                    if (assign !== undefined) {
                        this[pk] = assign;
                        this.update({ changed: name });
                    } else if (!(pk in this)) {
                        this[pk] = self.default();
                    }
                    return this[pk];
                };
            } else {
                parent[name] = function () {
                    if (!(pk in this)) {
                        this[pk] = self.default();
                    }
                    return this[pk];
                };
            }
        }
    }
});

const _Method = _Class.new({
    _name: 'Method',
    do(fn) {
        return this.new({
            _do: fn
        });
    },
    _slots: {
        _do: null, // fn, meat and taters
        args: _Var.default([]),
        ret: _Var.default(null),
        load(name, parent) {
            this._do._method = this;
            parent[name] = this._do;
        },
    }
})

const _Id = _Class.new({
    _name: 'Id',
    _slots: {
        _parent: null,
        _name: null,
        child(name, num) {
            return _.id.new({
                _parent: this,
                _name: name,
                _num: num,
            });
        },
        toString() {
            return `${this._parent ? this._parent.toString() : ':'}:${this._name.name()}`;
        },
    },
});

const _Primitive = _Class.new({
    _name: 'Primitive',
    _super: _Class,
    _slots: {
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
_Primitive._slots.init.apply(_Object);



const _Module = _Class.new({
    _name: 'Module',
    _slots: {
        exports: _Var.default([]),
        init() {
            for (const item of this.exports()) {
                this[item.name()] = item;
            }
        }
    },
});
const _String = _Primitive.new({
    _name: 'String',
    _js_prototype: String.prototype,
    _slots: {
        html() {
            return this;
        }
    }
});
const _Number = _Primitive.new({
    _name: 'Number',
    _js_prototype: Number.prototype,
    _slots: {
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
    _name: 'Array',
    _js_prototype: Array.prototype,
    _slots: {
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
    _name: 'Function',
    _js_prototype: Function.prototype,
    _slots: {
    },
});
const _Mixin = _Class.new({
    _name: 'Mixin',
    _slots: {
        slots: _Var.default({}),
        mix(base) {
            if (base === null) {
                return this;
            }
            return _Mixin.new({
                _slots: {
                    ...this.slots(),
                    ...base
                },
            });
        },
    }
});

const _Interface = _Class.new({
    _name: 'Interface',
    _slots: {
        name: _Var.new(),
        _methods: {},
    },
    of() {

    }
});

const _Command = _Interface.new({
    _name: 'Command',
    _slots: {

    }
});

const _ = _Module.new({
    _exports: [
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
