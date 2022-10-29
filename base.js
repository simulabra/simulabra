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

import { parseScript } from "meriyah";

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

export function $$(templ) {
    return _.symbol.sym(templ[0]);
}

_.define(_.klass.new({
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
}));

_.klass._id = _.id.new({ _name: $$`klass` });

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
    _name: $$`string`,
    _proto: String.prototype,
    _methods: {
        sym() {
            return _.symbol.sym(this);
        }
    }
});

_.primitive.new({
    _name: $$`number`,
    _proto: Number.prototype,
    _methods: {
        js() {
            return this;
        }
    }
})

_.define(_.klass.new({
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
}));

// TEMPLATE
_.define(_.klass.new({
    _name: _.symbol.sym(''),
    _slots: {
    },
}));

_.define(_.klass.new({
    _name: $$`node`,
    _slots: {
        parent() {
            /*!virtual*/
        },
        children() {
            /*!virtual*/
        }
    }
}))

_.define(_.klass.new({
    _name: $$`program`,
    _slots: {
        _expressions: [],
        js() {
            return this._expressions.map(e => e.js()).reduce((prev, cur, idx) => {
                return prev + cur + ';\n';
            }, '');
        },
        compile() {
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
    _name: $$`this`,
    _slots: {
        js() {
            return 'this';
        }
    },
}));

_.define(_.klass.new({
    _name: $$`identifier`,
    _slots: {
        _sym: null,
        js() {
            return this._sym.name();
        }
    },
}));

_.define(_.klass.new({
    _name: $$`binop`,
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
    _name: $$`variable`,
    _slots: {
        _name: null,
        _val: null,
        js() {
            return `let ${this._name.name()} = ${this._val.js()}`;
        }
    },
}));

_.define(_.klass.new({
    _name: $$`property`,
    _slots: {
        _name: null,
        _val: null,
        js() {
            return `${this._name.js()}: ${this._val.js()},`;
        }
    },
}));

_.define(_.klass.new({
    _name: $$`object_expression`,
    _slots: {
        _props: [],
        js() {
            return `{${this._props.map(p => p.js()).join('\n')}}`;
        }
    }
}))

_.define(_.klass.new({
    _name: $$`member_expression`,
    _slots: {
        _object: null, //!expression
        _property: null, //!symbol
        js() {
            return `${this._object.js()}.${this._property.js()}`;
        }
    }
}));

_.define(_.klass.new({
    _name: $$`computed_member_expression`,
    _slots: {
        _object: null, //!expression
        _property: null, //!expression
        js() {
            return `${this._object.js()}[${this._property.js()}]`;
        }
    }
}));

_.define(_.klass.new({
    _name: $$`call_expression`,
    _slots: {
        _callee: null,
        _arguments: [],
        js() {
            return `{${this._props.map(p => p.js()).join('\n')}}`;
        }
    }
}));

_.define(_.klass.new({
    _name: $$`array_expression`,
    _slots: {
        _elements: [],
        js() {
            return ``;
        }
    }
}));

_.define(_.klass.new({
    _name: $$`function_expression`,
    _slots: {
        _params: [],
        _body: null,
        js() {
            return ``;
        }
    }
}));

_.define(_.klass.new({
    _name: $$`return_statement`,
    _slots: {
        _argument: null,
        js() {
            return `return ${this._argument.js()};`;
        }
    }
}));

_.define(_.klass.new({
    _name: $$`assignment_expression`,
    _slots: {
        _left: null,
        _operator: '=',
        _right: null,
        js() {
            return `${this._left.js()} ${this._operator} ${this._right.js()};`;
        }
    }
}));


_.define(_.klass.new({
    _name: $$`parser`,
    _desc: 'the parser manages the relationship between the source Javascript and Simulabra nodes',
    _slots: {
        _js: '',
        _acorn_repr: {},
        _comments: [],
        esparse() {
            let self = this;
            return parseScript(this._js, {
                onComment(type, value) {
                    self._comments.push(value);
                }
            });
        },
        init() {
            this._acorn_repr = this.esparse();
        },
        // recursive descent estree representation from meriyah into real objects
        esnode(n) {
            switch (n.type) {
                case 'Identifier':
                    return _.identifier.new({
                        _sym: _.symbol.sym(n.name),
                    });
                case 'ThisExpression':
                    return _.this.new();
                case 'ExpressionStatement':
                    return this.esnode(n.expression);
                case 'BinaryExpression':
                    return _.binop.new({
                        _op: n.operator,
                        _left: this.esnode(n.left),
                        _right: this.esnode(n.right),
                    });
                case 'BlockStatement':
                    return _.program.new({
                        _expressions: n.body.map(e => this.esnode(e)),
                    });
                case 'VariableDeclaration':
                    return this.esnode(n.declarations[0]);
                case 'VariableDeclarator':
                    return _.variable.new({
                        _name: this.esnode(n.id),
                        _val: this.esnode(n.init),
                    });
                case 'ObjectExpression':
                    return _.object_expression.new({
                        _props: n.properties.map(p => _.property.new({
                            _name: this.esnode(p.key),
                            _val: this.esnode(p.value),
                        }))
                    });
                case 'Literal':
                    return n.value; // already extended the prototypes
                case 'CallExpression':
                    return _.call_expression.new({
                        _callee: this.esnode(n.callee),
                        _arguments: n.arguments.map(arg => this.esnode(arg)),
                    });
                case 'MemberExpression':
                    if (n.computed) {
                        return _.computed_member_expression.new({
                            _object: this.esnode(n.object),
                            _property: this.esnode(n.property),
                        });
                    } else {
                        return _.computed_member_expression.new({
                            _object: this.esnode(n.object),
                            _property: this.esnode(n.property),
                        });
                    }
                case 'ArrayExpression':
                    return _.array_expression.new({
                        _elements: n.elements.map(e => this.esnode(e)),
                    });
                case 'FunctionExpression':
                    return _.function_expression.new({
                        _params: n.params.map(p => this.esnode(p)),
                        _body: this.esnode(n.body),
                    });
                case 'ReturnStatement':
                    return _.return_statement.new({
                        _argument: this.esnode(n.argument),
                    });
                case 'AssignmentExpression':
                    return _.assignment_expression.new({
                        _left: this.esnode(n.left),
                        _operator: n.operator,
                        _right: this.esnode(n.right),
                    });
                default:
                    console.log(JSON.stringify(n, null, 2));
                    throw new Error('Unhandled type: ' + n.type);


            }
        },
        program() {
            return _.program.new({
                _expressions: this._acorn_repr.body.map(n => this.esnode(n)),
            });
        }
    }
}));

_.define(_.klass.new({
    _name: 'context'.sym(),
}));

export { _ };
