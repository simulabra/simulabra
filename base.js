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
        id() {
            return this._id;
        }
    }
}

let klass = {
    _slots: {
        _name: '', // non-type, non-slot object => default
        _slots: {},
        _super: object,
        _mixins: [],
        _idctr: 0,
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
            if (this._id) {
                obj._id = this._id.child(obj._name || this.nextid());
            }
            return obj;
        },
        init() {
            object._slots.init.apply(this);
            Object.setPrototypeOf(this._slots, this._super._slots);
        },
        super() {
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


Object.setPrototypeOf(klass, klass._slots);
Object.setPrototypeOf(klass._slots, object._slots);

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
        },
        js() {
            return this.name();
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

let _ = envKlass.new();

object._name = symbol.sym('object');
klass._name = symbol.sym('klass');
symbol._name = symbol.sym('symbol');

_.define(object);
_.define(klass);
_.define(symbol);
_.define(envKlass);

_.define(_.klass.new({
    _name: _.symbol.sym('id'),
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
}))

_.klass._id = _.id.new({ _name: _.symbol.sym('klass') });

_.define(_.klass.new({
    _name: symbol.sym('primitive'),
    _slots: {
        _proto: null,
        _methods: {},
        init() {
            for (let [name, fn] of Object.entries(this._methods)) {
                this._proto[name] = fn;
            }
        }
    }
}));

// wrap strings numbers booleans etc

_.primitive.new({
    _name: _.symbol.sym('string'),
    _proto: String.prototype,
    _methods: {
        sym() {
            return _.symbol.sym(this);
        }
    }
});

_.primitive.new({
    _name: _.symbol.sym('number'),
    _proto: Number.prototype,
    _methods: {
        js() {
            return this;
        }
    }
})

_.define(_.klass.new({
    _name: _.symbol.sym('mixin'),
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
_.define(_.klass.new({
    _name: _.symbol.sym(''),
    _slots: {
    },
}));

_.define(_.klass.new({
    _name: _.symbol.sym('program'),
    _slots: {
        _expressions: [],
        js() {
            return this._expressions.map(e => e.js()).reduce((prev, cur, idx) => {
                return prev + cur + ';\n';
            }, '');
        },
        init() {
            this._fn = new Function('_', this.js());
        },
        expressions() {
            return this._expressions;
        },
        run(e) {
            return this._fn.apply(e);
        }
    },
}));

_.define(_.klass.new({
    _name: _.symbol.sym('binop'),
    _slots: {
        _op: null,
        _left: null,
        _right: null,
        js() {
            return `${this._left.js()} ${this._op} ${this._right.js()}`;
        }
    },
}));

_.define(_.klass.new({
    _name: _.symbol.sym('variable'),
    _slots: {
        _name: null,
        _val: null,
        js() {
            return `let ${this._name.name()} = ${this._val.js()}`;
        }
    },
}));

_.define(_.klass.new({
    _name: _.symbol.sym('property'),
    _slots: {
        _name: null,
        _val: null,
        js() {
            return `${this._name.js()}: ${this._val.js()},`;
        }
    },
}));

_.define(_.klass.new({
    _name: _.symbol.sym('object_expression'),
    _slots: {
        _props: [],
        js() {
            return `{${this._props.map(p => p.js()).join('\n')}}`;
        }
    }

}))

_.define(_.klass.new({
    _name: _.symbol.sym('parser'),
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
                    return _.binop.new({
                        _op: n.operator,
                        _left: n.left.value,
                        _right: n.right.value,
                    });
                case 'BlockStatement':
                    return _.program.new({
                        _expressions: n.body.map(e => this.node(e)),
                    });
                case 'VariableDeclaration':
                    return this.node(n.declarations[0]);
                case 'VariableDeclarator':
                    return _.variable.new({
                        _name: _.symbol.sym(n.id.name),
                        _val: this.node(n.init),
                    });
                case 'ObjectExpression':
                    return _.object_expression.new({
                        _props: n.properties.map(p => _.property.new({
                            _name: p.key.name.sym(),
                            _val: this.node(p.value),
                        }))
                    });
                case 'Literal':
                    return n.value;


            }
        },
        program() {
            return _.program.new({
                _expressions: this._acorn_repr.body.map(n => this.node(n)),
            });
        }
    }
}));

_.define(_.klass.new({
    _name: 'context'.sym(),
}));

export { _ };
