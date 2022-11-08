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
    _slots: {
        init() {},
        id() {
            return this._id;
        },
        aname(name) {
            if (!('_name' in this)) {
                this._name = $symbol.sym(name);
            }
        }
    }
}

export const $class = {
    _slots: {
        _name: '', // non-type, non-slot object => default
        _slots: {},
        _super: $object,
        _mixins: [],
        _vars: [],
        _idctr: 0,
        new(props = {}) {
            let obj = props;
            // should we clone the default props?
            Object.setPrototypeOf(obj, this._proto);
            obj._class = this;
            obj.init(this);
            if (this._id) {
                obj._id = this._id.child(obj._name || this.nextid());
            }
            return obj;
        },
        init(parent) {
            // $object._slots.init.apply(this);
            for (let [key, val] of Object.entries(this._slots)) {
                if (val?.init) {
                    val.init(this);
                }
                if (val?._class?._name.name() === 'var') {
                    val.aname(key);
                    this._vars.push(val);
                    let pk = '_' + key;
                    this._slots[key] = function (assign) {
                        if (assign !== undefined) {
                            this[pk] = assign;
                        } else if (!(pk in this)) {
                            this[pk] = val.default();
                        }
                        return this[pk];
                    }
                }
            }

            Object.setPrototypeOf(this._slots, this._super._slots);

            if (this._mixins.length > 0) {
                this._proto = this._mixins.reduce((prev, cur) => {
                    return cur.mix(prev);
                }, $mixin.new()).proto(this._slots);
            } else {
                this._proto = this._slots;
            }
        },
        superslots() {
            return this._super._slots;
        },
        name() {
            return this._name;
        },
        nextid() {
            return ++this._idctr;
        }
    }
}

Object.setPrototypeOf($class, $class._slots);
$class.init();

let $symbol = $class.new({
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
    _slots: {
        _type: null, //!nulltype, wtf?
        _default: null, //fn or object
        default(ctx) {
            if (this._default instanceof Function) {
                this._default.apply(ctx);
            } else {
                return this._default;
            }
        },
    }
})

export const $id = $class.new({
    _name: $$`id`,
    _slots: {
        _parent: null,
        _name: null,
        child(name) {
            return _.id.new({
                _parent: this,
                _name: name,
            });
        },
        toString() {
            return `${this._parent ? this._parent.toString() : ':'}:${this._name.name()}`;
        },
    },
});

export const $primitive = $class.new({
    _name: $$`primitive`,
    _slots: {
        _proto: null,
        _methods: {},
        init() {
            for (let [name, fn] of Object.entries(this._methods)) {
                this._proto[name] = fn;
            }
        }
    }
});

// wrap strings numbers booleans etc

export const $string = $primitive.new({
    _name: $$`string`,
    _proto: String.prototype,
    _methods: {
        sym() {
            return $symbol.sym(this);
        }
    }
});

export const $number = $primitive.new({
    _name: $$`number`,
    _proto: Number.prototype,
    _methods: {
        js() {
            return this;
        }
    }
})

export const $mixin = $class.new({
    _name: $$`mixin`,
    _slots: {
        _slots: {},
        mix(base) {
            return $mixin.new({
                _slots: {
                    ...this._slots,
                    ...base
                },
            });
        },
        proto(parent) {
            let o = {
                ...this._slots
            };
            Object.setPrototypeOf(o, parent);
            return o;
        }
    }
});
