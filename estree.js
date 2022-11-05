import { parseScript } from "meriyah";

// TODO: properly set the parent class on all of these,

export default _.module.new({
  _classes: [
    _.klass.new({
      _name: $$`node`,
      _slots: {
        parent() {
          /*!virtual*/
        },
        children() {
          /*!virtual*/
        }
      }
    }),

    _.klass.new({
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
    }),

    _.klass.new({
      _name: $$`this`,
      _slots: {
        js() {
          return 'this';
        }
      },
    }),

    _.klass.new({
      _name: $$`identifier`,
      _slots: {
        _sym: null, //!symbol
        js() {
          return this._sym.name();
        }
      },
    }),

    _.klass.new({
      _name: $$`symbol_expression`,
      _slots: {
        _name: null, //!string
        js() {
          return `$$\`${this._name}\``; // blech
        }
      }
    }),

    _.klass.new({
      _name: $$`binop`,
      _slots: {
        _op: null, //!string
        _left: null, //!node
        _right: null, //!node
        js() {
          return `${this._left.js()} ${this._op} ${this._right.js()}`;
        }
      },
    }),

    _.klass.new({
      _name: $$`variable`,
      _slots: {
        _name: null,
        _val: null,
        js() {
          return `let ${this._name.name()} = ${this._val.js()}`;
        }
      },
    }),

    _.klass.new({
      _name: $$`property`,
      _slots: {
        _name: null,
        _val: null,
        js() {
          return `${this._name.js()}: ${this._val.js()},`;
        }
      },
    }),

    _.klass.new({
      _name: $$`object_expression`,
      _slots: {
        _props: [],
        js() {
          return `{${this._props.map(p => p.js()).join('\n')}}`;
        }
      }
    }),

    _.klass.new({
      _name: $$`member_expression`,
      _slots: {
        _object: null, //!expression
        _property: null, //!symbol
        js() {
          return `${this._object.js()}.${this._property.js()}`;
        }
      }
    }),

    _.klass.new({
      _name: $$`computed_member_expression`,
      _slots: {
        _object: null, //!expression
        _property: null, //!expression
        js() {
          return `${this._object.js()}[${this._property.js()}]`;
        }
      }
    }),

    _.klass.new({
      _name: $$`call_expression`,
      _slots: {
        _callee: null,
        _arguments: [],
        js() {
          return `{${this._props.map(p => p.js()).join('\n')}}`;
        }
      }
    }),

    _.klass.new({
      _name: $$`array_expression`,
      _slots: {
        _elements: [],
        js() {
          return ``;
        }
      }
    }),

    _.klass.new({
      _name: $$`function_expression`,
      _slots: {
        _params: [],
        _body: null,
        js() {
          return ``;
        }
      }
    }),

    _.klass.new({
      _name: $$`return_statement`,
      _slots: {
        _argument: null,
        js() {
          return `return ${this._argument.js()};`;
        }
      }
    }),

    _.klass.new({
      _name: $$`assignment_expression`,
      _slots: {
        _left: null,
        _operator: '=',
        _right: null,
        js() {
          return `${this._left.js()} ${this._operator} ${this._right.js()};`;
        }
      }
    }),


    _.klass.new({
      _name: $$`parser`,
      _desc: 'the parser manages the relationship between the source javascript and simulabra nodes',
      _slots: {
        _js: '',
        _estree: {},
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
          this._estree = this.esparse();
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
            case 'TaggedTemplateExpression':
              if (n.tag.name === '$$') {
                return _.symbol
              }
            default:
              console.log(JSON.stringify(n, null, 2));
              throw new Error('unhandled type: ' + n.type);


          }
        },
        program(_) {
          return _.program.new({
            _expressions: this._estree.body.map(n => this.esnode(n)),
          });
        }
      }
    })
  ]
})
