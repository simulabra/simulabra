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

import { parse } from "acorn";

// hook up object to class
let object = {
    _slots: {
        init() {},
    }
}

let klass = {
    _slots: {
        _name: '', // non-type, non-slot object => default
        _slots: {},
        _super: object,
        _mixins: [],
        new(props = {}) {
            let obj = props;
            // should we clone the default props?
            if (this._mixins.length > 0) {
                let parent = this._mixins.reduce((prev, cur) => {
                    return cur.mix(prev);
                }, {});
                Object.setPrototypeOf(parent, this._slots);
                Object.setPrototypeOf(obj, parent);
            } else {
                Object.setPrototypeOf(obj, this._slots);
            }
            Object.entries(this._slots).forEach(([varName, varVal]) => {
                // need to explicitly copy default value
                if (varName[0] === '_' && varVal instanceof Function) {
                    obj[varName] = varVal();
                }
            });
            obj._class = this;
            obj.init();
            return obj;
        },
        init() {
            Object.setPrototypeOf(this._slots, this._super._slots);
        },
        super() {
            return this._super._slots;
        },
        name() {
            return this._name;
        },
    }
}


Object.setPrototypeOf(klass, klass._slots);

let symbol = klass.new({
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
        let gid = symbol.get(name);
        if (!gid) {
            gid = symbol.genid();
            symbol.save(gid, name)
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
            return symbol.get(this._gid);
        },
        gid() {
            return this._gid
        },
        eq(other) {
            return this.gid() === other.gid();
        }
    },
});

let envKlass = klass.new({
    _name: symbol.sym('env'),
    _slots: {
        _parent: null,
        define(cls) {
            this[cls._name.name().replace(/-/g, '_')] = cls;
        },
        child() {
            let c = {};
            Object.setPrototypeOf(c, this);
            return c;
        },
    }
});

let env = envKlass.new();

object._name = symbol.sym('object');
klass._name = symbol.sym('klass');
symbol._name = symbol.sym('symbol');

env.define(object);
env.define(klass);
env.define(symbol);
env.define(envKlass);
env.define(env.klass.new({
    _name: symbol.sym('primitive'),
    _slots: {
        _proto: null,
        _methods: {},
        init() {
            for (let [name, fn] of Object.entries(this._methods)) {
                _proto[name] = fn;
            }
        }
    }
}));

// wrap strings numbers booleans etc

env.primitive.new({
    _name: env.symbol.sym('string'),
});

env.define(env.klass.new({
    _name: env.symbol.sym('mixin'),
    _slots: {
        _slots: {},
        mix(base) {
            return {
                ...this._slots,
                ...base
            }
        },
    }
}));

// TEMPLATE
env.define(env.klass.new({
    _name: env.symbol.sym(''),
    _slots: {
    },
}));

env.define(env.klass.new({
    _name: env.symbol.sym('program'),
    _slots: {
        _expressions: [],
        js() {
            return this._expressions.map(e => e.js()).reduce((prev, cur, idx) => {
                if (idx == this._expressions.length - 1) {
                    return prev + 'return ' + cur + ';';
                } else {
                    return prev + cur + ';\n';
                }
            }, '');
        },
        expressions() {
            return this._expressions;
        },
        run(e) {
            return new Function('_', this.js()).apply(e);
        }
    },
}));

env.define(env.klass.new({
    _name: env.symbol.sym('binop'),
    _slots: {
        _op: null,
        _left: null,
        _right: null,
        js() {
            return `${this._left} ${this._op} ${this._right}`;
        }
    },
}));

env.define(env.klass.new({
    _name: env.symbol.sym('parser'),
    _slots: {
        _js: '',
        _acorn_repr: {},
        acorn() {
            return parse(this._js, { ecmaVersion: 2021 });
        },
        init() {
            this._acorn_repr = this.acorn();
        },
        node(n) {
            switch (n.type) {
                case 'ExpressionStatement':
                    return this.node(n.expression);
                case 'BinaryExpression':
                    return env.binop.new({
                        _op: n.operator,
                        _left: n.left.value,
                        _right: n.right.value,
                    });
            }
        },
        program() {
            return env.program.new({
                _expressions: this._acorn_repr.body.map(n => this.node(n)),
            });
        }
    }
}));

export { env };
