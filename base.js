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
export const $object = {
    _js_prototype: Object.prototype,
    _slots: {
        init() {},
        id() {
            return this._id;
        },
        // if this object doesn't have a _name, give it that of the symbol version of name
        aname(name) {
            if (!('_name' in this)) {
                this._name = $symbol.sym(name);
            }
        },
        loadslots() {
            for (let [key, val] of Object.entries(this)) {
                val?.load && val.load(key, this);
            }
        },
        update(event) {

        }
    }
};
$object._proto = $object._slots;
Object.prototype.loadslots = $object._proto.loadslots;

export const $class = {
    _slots: {
        _name: '', // non-type, non-slot object => default
        _slots: {},
        _super: $object,
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
                obj._id = this._id.child(obj._name, this.nextid());
            }
            return obj;
        },
        name() {
            return this._name;
        },
        nextid() {
            return ++this._idctr;
        },
        super() {
            return this._super;
        },
        proto() {
            return this._proto;
        }
    }
}

Object.setPrototypeOf($class, $class._slots);
$class.init();

const $symbol = $class.new({
    _sympool: {},
    _idc: 0,
    get(name) {
        return this._sympool[name];
    },
    save(id, name) {
        this._sympool[id] = name;
        this._sympool[name] = id;
    },
    sym(name) {
        let gid = $symbol.get(name);
        if (!gid) {
            gid = $symbol.genid();
            $symbol.save(gid, name)
        }
        return this.new({
            _gid: gid,
        });
    },
    genid() {
        return ++this._idc;
    },
    _slots: {
        _gid: null,
        toString() {
            return this.name();
        },
        name() {
            return $symbol.get(this._gid);
        },
        gid() {
            return this._gid
        },
        eq(other) {
            return this.gid() === other.gid();
        },
        js() {
            return this.name();
        }
    },
});

export function $$(templ) {
    return $symbol.sym(templ[0]);
}

$symbol._name = $$`symbol`;
$object._name = $$`object`;
$class._name = $$`class`;

export const $var = $class.new({
    _name: $$`var`,
    default(val) {
        return this.new({ _default: val });
    },
    _slots: {
        _type: null, //!nulltype, wtf?
        _default: null, //fn or object
        _mutable: true,
        aname(name) {
            if (!this._name) {
                this._name = $symbol.sym(name);
            }
        },
        default(ctx) {
            if (this._default instanceof Function) {
                this._default.apply(ctx);
            } else {
                return this._default;
            }
        },
        load(name, parent) {
            const self = this;
            this.aname(name);
            let pk = '_' + name;
            if (this._mutable) {
                parent[name] = function (assign) {
                    if (assign !== undefined) {
                        this[pk] = assign;
                        this.update({ name: 'changed' });
                    } else if (!(pk in this)) {
                        this[pk] = self.default();
                    }
                    return this[pk];
                };
            } else {
                parent[name] = function() {
                    if (!(pk in this)) {
                        this[pk] = self.default();
                    }
                    return this[pk];
                };
            }
        }
    }
});

export const $method = $class.new({
    _name: $$`method`,
    do(fn) {
        return this.new({
            _do: fn
        });
    },
    _slots: {
        _do: null, // fn, meat and taters
        args: $var.default(null),
        ret: $var.default(null),
        load(name, parent) {
            this._do._method = this;
            parent[name] = this._do;
        },
    }
})

export const $id = $class.new({
    _name: $$`id`,
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

export const $primitive = $class.new({
    _name: $$`primitive`,
    _super: $class,
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

$object._class = $primitive;
Object.setPrototypeOf($object, $primitive._proto);
$primitive._slots.init.apply($object);

// wrap strings numbers booleans etc

export const $string = $primitive.new({
    _name: $$`string`,
    _js_prototype: String.prototype,
    _slots: {
        sym() {
            return $symbol.sym(this);
        }
    }
});

export const $number = $primitive.new({
    _name: $$`number`,
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
})

export const $mixin = $class.new({
    _name: $$`mixin`,
    _slots: {
        slots: $var.default({}),
        mix(base) {
            if (base == null) {
                return this;
            }
            return $mixin.new({
                _slots: {
                    ...this.slots(),
                    ...base
                },
            });
        },
    }
});
