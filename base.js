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
    }
}

export const $class = {
    _slots: {
        _name: '', // non-type, non-slot object => default
        _slots: {},
        _super: $object,
        _mixins: [],
        _idctr: 0,
        new(props = {}) {
            let obj = props;
            // should we clone the default props?
            Object.setPrototypeOf(obj, this._parent);
            Object.entries(this._slots).forEach(([varName, varVal]) => {
                // need to explicitly copy default value
                if (varName[0] === '_' && varVal instanceof Function) {
                    obj[varName] = varVal();
                }
            });
            obj._class = this;
            obj.init();
            if (this._id) {
                obj._id = this._id.child(obj._name || this.nextid());
            }
            return obj;
        },
        init() {
            // $object._slots.init.apply(this);
            for (let key of Object.keys(this._slots)) {
                if (key[0] === '_' && key[1] !== '_') {
                    let name = key.slice(1);
                    if (!(name in this._slots)) {
                        // console.log(`load slot ${this._name} ${name}`);
                        this._slots[name] = function(val) {
                            // console.log('use slot', key, name, this);
                            if (val !== undefined) {
                                this[key] = val;
                            }
                            return this[key];
                        }
                    }
                }
            }

            this._super = this._super._slots;
            Object.setPrototypeOf(this._slots, this._super);

            if (this._mixins.length > 0) {
                this._parent = this._mixins.reduce((prev, cur) => {
                    return cur.mix(prev);
                }, {});
                Object.setPrototypeOf(this._parent, this._slots);
            } else {
                this._parent = this._slots;
            }
        },
        super() {
            return this._super;
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
            return {
                ...this._slots,
                ...base
            }
        },
    }
});
