import bootstrap from './base.js';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import ofs from 'fs';
import path from 'path';
import { prettyPrint, types } from 'recast';
const b = types.builders;
var __ = bootstrap();
let base_mod = __.base();

export default base_mod.find('class', 'module').new({
  name: 'lisp',
  imports: [base_mod],
  on_load(_, $) {
    $.class.new({
      name: 'stream',
      components: [
        $.var.new({ name: 'pos', default: 0 }),
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'next',
          do: function () {
            if (this.pos() < this.value().length) {
              const res = this.value()[this.pos()];
              this._pos++;
              return res;
            }
            return null;
          }
        }),
        $.method.new({
          name: 'peek',
          do: function (n = 0) {
            if (this.pos() + n < this.value().length) {
              return this.value()[this.pos() + n];
            }
            return null;
          }
        }),
        $.method.new({
          name: 'ended',
          do: function () {
            return this.pos() >= this.value().length;
          }
        }),
        $.method.new({
          name: 'line-info',
          do: function () {
            let line = 1;
            let lineStart = 0;
            for (let i = 0; i < this.pos(); i++) {
              if (this.value()[i] === '\n') {
                line++;
                lineStart = i + 1;
              }
            }
            const lineContent = this.value().substring(lineStart, this.value().indexOf('\n', lineStart));
            const currentChar = this.value()[this.pos()];
            const lineWithBracket = lineContent.slice(0, this.pos() - lineStart) + ' >>>' + currentChar + '<<< ' + lineContent.slice(this.pos() - lineStart + 1);
            return `[line ${line}] ${lineWithBracket.trim()}`;
          }
        }),
      ]
    });


    $.class.new({
      name: 'readtable',
      components: [
        $.static.new({
          name: 'standard-chain',
          do() {
            return this.new({
              table: {
                '#': $.pointer_node,
                '.': $.message_node,
                '=': $.assignment_node,
                '(': $.list_node,
                '{': $.map_node,
              }
            });
          }
        }),
        $.static.new({
          name: 'standard',
          do() {
            return this.new({
              table: {
                ':': $.symbol_node,
                '/': $.this_node,
                '(': $.list_node,
                '{': $.map_node,
                '[': $.lambda_node,
                '\'': $.quote_node,
                '`': $.quasiquote_node,
                ',': $.unquote_node,
                '.': $.message_node,
                '$': $.invoke_node,
                '_': $.it_node,
                '%': $.argref_node,
                '~': $.classref_node,
                '!': $.typeref_node,
                '^': $.return_node,
                '@': $.globalref_node,
                '"': $.string_literal_node,
              },
            });
          },
        }),
        $.var.new({ name: 'table', default: {} }),
        function get(char) {
          if (this.has_char(char)) {
            return this.table()[char];
          } else {
            throw new Error(this.format(`doesn't have ${char}`));
          }
        },
        function has_char(char) {
          return char in this.table();
        },
      ]
    });

    $.class.new({
      name: 'node',
      components: [
        $.virtual.new({
          name: 'parse'
        }),
        $.method.new({
          name: 'quote',
          do() {
            const props = {};
            for (const v of this.class().vars()) {
              const k = v.name().deskewer();
              props[k] = this[k]().quote();
            }
            return $.message_node.new({
              receiver: $.classref_node.new({ symbol: $.symbol_node.new({ value: this.class().name() }) }),
              selector: 'new',
              args: [props]
            });
          }
        }),
        $.method.new({
          name: 'children',
          do() {
            return this.vars().filter(vs => this.log(vs) || vs.value().class().descended($.node));
          }
        }),
        $.method.new({
          name: 'visit',
          do(fn, args = []) {
            const newmap = Object.fromEntries(this.vars().map(it => [it.var_ref().name().deskewer(), fn.apply(it.value(), args)]));
            return this.class().new(newmap);
          }
        }),
        $.method.new({
          name: 'expand',
          do() {
            return this.visit(function () { return this?.expand ? this.expand() : this; });
          }
        }),
        $.method.new({
          name: 'quasiexpand',
          do() {
            return $.quote_node.new({ value: this });
          }
        }),
        $.var.new({ name: 'start' }),
        $.var.new({ name: 'end' }),
        $.before.new({
          name: 'parse',
          do(reader) {
          }
        }),
      ]
    });

    $.class.new({
      name: 'symbol-node',
      components: [
        $.node,
        $.static.new({
          name: 'from',
          do(str) {
            return this.new({
              value: str
            });
          }
        }),
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect(':');
            this.value(reader.identifier());
            return this;
          }
        }),
        $.method.new({
          name: 'estree',
          do() {
            return b.stringLiteral(this.value());
          }
        }),
        $.method.new({
          name: 'print',
          do() {
            return ':' + this.value();
          }
        }),
      ],
    });

    _.find('primitive', 'array-primitive').extend([
      function quote() {
        return this.map(e => {
          return e.quote();
        });
      },
      function expand() {
        return this.map(e => {
          return e.expand();
        });
      },
      function estree() {
        return $.list_node.new({
          items: this
        }).estree();
      }
    ]);

    _.find('primitive', 'string-primitive').extend([
      function quote() {
        return b.stringLiteral(this);
      },
      function expand() {
        return this;
      }
    ]);

    $.class.new({
      name: 'this-node',
      components: [
        $.node,
        function print() {
          return '';
        },
        function estree() {
          return b.thisExpression();
        },
      ],
    });

    $.class.new({
      name: 'message-node',
      components: [
        $.node,
        $.method.new({
          name: 'chain',
          do: function chain(reader, node) {
            this.receiver(node);
            return this.parse(reader);
          }
        }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            this.receiver() ?? this.receiver($.this_node.new());
            reader.expect('.');
            this.selector(reader.identifier());
            this.args();
            if (reader.peek() === '(') {
              this.args($.list_node.new().parse(reader));
            } else if (reader.peek() === '{') {
              this.cut(true);
              this.args($.list_node.new({ items: [reader.read()] }));
            } else {
              this.args($.list_node.new());
            }
            if (reader.peek() === '.') {
              const chain = $.message_node.new({ receiver: this });
              return chain.parse(reader);
            }
            return this;
          }
        }),
        $.var.new({ name: 'receiver' }),
        $.var.new({ name: 'selector' }),
        $.var.new({ name: 'args' }),
        $.var.new({ name: 'cut', default: false }),
        function print() {
          if (this.cut()) {
            return `${this.receiver().print()}.${this.selector()}${this.args().items()[0].print()}`;
          } else {
            return `${this.receiver().print()}.${this.selector()}${this.args()?.empty() ? '' : this.args().print()}`;
          }
        },
        function estree() {
          if ('-+/*'.includes(this.selector())) {
            return b.binaryExpression(this.selector(), this.receiver().estree(), this.args().items()[0].estree());
          } else {
            let args = this.args().items().map(it => it.estree());
            if (!Array.isArray(args)) {
              args = [args];
            }
            return b.callExpression(b.memberExpression(this.receiver().estree(), b.identifier(this.selector().deskewer())), args);
          }
        },
        function expand() {
          if (this.receiver().isa($.invoke_node)) {
            const macro = _.find('macro', this.selector());
            if (!macro) {
              throw new Error(`couldn't find macro: ${this.selector()} in ${this.print()}`)
            }
            const v = macro.expand(...this.args().expand());
            if (v === undefined) {
              throw new Error(`macro expansion failed for ${macro.title()} in ${this.title()}`)
            }
            return v;
          } else {
            //TODO: supercall/next
            return this.visit(function () { return this?.expand ? this.expand() : this; });
          }
        }
      ],
    });

    $.class.new({
      name: 'invoke-node',
      components: [
        $.node,
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('$'); // parse message?
            return this;
          }
        }),
        function print() {
          return '$';
        },
      ],
    });

    $.class.new({
      name: 'it-node',
      components: [
        $.node,
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('_'); // parse message?
            return this;
          }
        }),
        function print() {
          return '_';
        },
        function estree() {
          return $.argref_node.new({ identifier: 'it' }).estree();
        }
      ],
    });

    $.class.new({
      name: 'property',
      components: [
        $.node,
        $.var.new({ name: 'key' }),
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            this.key($.symbol_node.new().parse(reader));
            reader.expect('=');
            this.value(reader.read());
            return this;
          }
        }),
        function print() {
          return `${this.key().print()}=${this.value().print()}`;
        },
        function estree() {
          return b.property('init', this.key().estree(), this.value().estree());
        },
        function expand() {
          this.dlog('expand property', this.key(), this.value())
          return this.class().new({ key: this.key(), value: this.value().expand() });
        }
      ],
    })

    $.class.new({
      name: 'assignment-node',
      components: [
        $.node,
        $.var.new({ name: 'lhs' }),
        $.var.new({ name: 'rhs' }),
        $.method.new({
          name: 'chain',
          do: function chain(reader, n) {
            this.lhs(n);
            return this.parse(reader);
          }
        }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('=');
            this.rhs(reader.read());
            return this;
          }
        }),
        function print() {
          return `${this.lhs().print()}=${this.rhs().print()}`;
        },
        function estree() {
          return b.variableDeclaration('let', [b.variableDeclarator(this.lhs().estree(), this.rhs().estree())]);
        },
      ],
    });

    $.class.new({
      name: 'call-node',
      components: [
        $.node,
        $.var.new({ name: 'fn' }),
        $.var.new({ name: 'args' }),
        function estree() {
          return b.callExpression(b.memberthis.fn().estree(), this.args().items().map(it => it.estree()));
        }
      ]
    });


    $.class.new({
      name: 'list-node',
      components: [
        $.node,
        $.var.new({ name: 'items', default: [] }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            this.items([]);
            reader.expect('(');
            while (reader.peek() !== ')') {
              reader.strip();
              this.items().push(reader.read());
              reader.strip();
            }
            reader.expect(')');
            return this;
          },
        }),
        function chain(reader, node) {
          this.parse(reader);
          return $.message_node.new({
            receiver: node,
            selector: 'apply',
            args: this.map(items => [$.this_node.new(), items]),
          });
        },
        function print() {
          return `(${this.items().map(it => it.print()).join(' ')})`;
        },
        function empty() {
          return this.items().length === 0;
        },
        function estree() {
          return b.arrayExpression(this.items().map(it => it.estree()));
        },
        function expand() {
          return this.class().new({ items: this.items().map(it => it.expand()) });
        },
        function map(fn) {
          return this.class().new({ items: fn(this.items()) });
        },
        function push(it) {
          this.items().push(it);
          return this;
        }
      ]
    });

    $.class.new({
      name: 'quoted-estree',
      components: [
        $.var.new({ name: 'estree' })
      ]
    });

    $.class.new({
      name: 'lambda-node',
      debug: true,
      components: [
        $.node,
        $.var.new({ name: 'args' }),
        $.var.new({ name: 'body' }),
        $.method.new({
          name: 'parse',
          do(reader) {
            this.args([]);
            reader.expect('[');
            if (reader.peek() === '|') {
              reader.expect('|');
              while (reader.peek() !== '|') {
                this.args().push(reader.read());
                reader.strip();
              }
              reader.expect('|');
            } else if (reader.peek() === '_') {
              this.args().push(reader.read());
            }
            reader.strip();
            const forms = [];
            while (reader.peek() !== ']') {
              forms.push(reader.read());
              reader.strip();
            }
            reader.expect(']');
            this.body($.body.new({ forms }));
            return this;
          }
        }),
        function default_args() {
          return this.args().length === 1 && this.args()[0].identifier() === 'it';
        },
        function print() {
          return `[${this.default_args() ? '' : '|' + this.args().map(a => a.print()).join(' ') + '|'}${this.body().print()}]`
        },
        function estree() {
          // return b.functionExpression(null, this.args().map(a => a.estree()), this.body().estree());
          // ~closure.new{:fn=<fn> :mod=@mod}
          // really need macros
          // ~macro.new{:name=:closure-fn :do=[%fn|`~closure.new{:fn=,fn :mod=@mod}]}
          return $.message_node.new({
            receiver: $.classref_node.new({
              identifier: 'closure',
            }),
            selector: 'new',
            args: $.list_node.new({
              items: [$.map_node.new({
                properties: [
                  $.property.new({
                    key: $.symbol_node.from('fn'),
                    value: $.quoted_estree.new({ estree: b.functionExpression(null, this.args().map(a => a.estree()), this.body().estree()) }),
                  }),
                  $.property.new({
                    key: $.symbol_node.from('mod'),
                    value: $.globalref_node.new({ identifier: 'mod' }), // @mod __.mod()
                  })
                ]
              })]
            }),
          }).estree();
        }
      ],
    });

    $.class.new({
      name: 'map-node',
      components: [
        $.node,
        $.var.new({ name: 'properties' }),
        $.var.new({ name: 'space' }),
        $.method.new({
          name: 'chain',
          do: function chain(reader, node) {
            return $.message_node.new({
              receiver: node,
              selector: 'new',
              args: $.list_node.new({ items: [$.map_node.new().parse(reader)], }),
            });
          }
        }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // {
            this.properties([]);
            if (reader.peek() === '\n') {
              this.space(true);
            } else {
              this.space(false);
            }
            while (reader.peek() !== '}') {
              reader.strip();
              this.properties().push($.property.new().parse(reader))
              reader.strip();
            }
            reader.next(); // }
            return this;
          }
        }),
        function print() {
          const props = this.properties().map(prop => prop.print());
          if (!this.space()) {
            return `{${props.join(' ')}}`;
          } else {
            return `{
${props.map(prop => '  ' + prop).join('\n')}
}`
          }
        },
        function estree() {
          return b.objectExpression(this.properties().map(p => p.estree()))
        },
        function expand() {
          return this.class().new({ properties: this.properties().map(prop => prop.expand()) });
        }
      ],
    });

    $.class.new({
      name: 'quote-node',
      components: [
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // '
            this.value(reader.read());
            return this;
          }
        }),
        function print() {
          return `'${this.value().print()}`;
        },
        function estree() {
          const it = this.value();
          return b.callExpression(b.memberExpression(b.identifier('$' + it.class().name()), b.identifier('new')), [b.objectExpression(
            it.class().vars().map(v => {
              const k = v.name().deskewer();
              return b.property('init', b.identifier(k), it[k]().quote().estree());
            })
          )])
        }
      ],
    });

    $.class.new({
      name: 'quasiquote-node',
      components: [
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // `
            let value = reader.read();
            return value.visit(function () {
              this.quasiexpand();
            });
          }
        }),
      ],
    });

    $.class.new({
      name: 'unquote-node',
      components: [
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // ,
            this.value(reader.read());
            return this;
          }
        }),
        function quasiexpand() {
          return this.value();
        },
        $.var.new({ name: 'value' }),
      ]
    });

    $.class.new({
      name: 'unquote-lst',
      components: [
      ]
    });

    $.class.new({
      name: 'number-literal',
      components: [
        $.node,
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            let n = '';
            if (reader.peek() === '-') {
              n += '-';
              reader.next();
            }
            while (reader.digit() || (reader.peek() === '.' && /[0-9]/.test(reader.peek(1)))) {
              n += reader.next();
            }
            this.value(+n);
            return this;
          }
        }),
        function print() {
          return this.value().toString();
        },
        function estree() {
          return b.literal(this.value());
        }
      ]
    });

    $.class.new({
      name: 'string-literal-node',
      debug: true,
      components: [
        $.node,
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'parse',
          do(reader) {
            let stringValue = "";
            reader.expect('"');
            while (reader.peek() !== '"') {
              const currentChar = reader.next();
              if (currentChar === '\\' && (reader.peek() === '\\' || reader.peek() === '"')) {
                stringValue += currentChar + reader.next();
              } else {
                stringValue += currentChar;
              }
            }
            reader.expect('"');
            this.value(stringValue);
            return this;
          }
        }),
        function print() {
          return `"${this.value().replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        },
        function estree() {
          return b.literal(this.value());
        }
      ],
    });


    $.class.new({
      name: 'ref-reader-macro',
      components: [
        $.node,
        $.var.new({ name: 'identifier' }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect(this.char()); // %
            this.identifier(reader.identifier());
            return this;
          }
        }),
        function print() {
          return `${this.char()}${this.identifier()}`;
        },
        function expand() {
          return this;
        }
      ],
    });

    $.class.new({
      name: 'argref-node',
      components: [
        $.ref_reader_macro,
        function char() {
          return '%';
        },
        function estree() {
          return b.identifier(`_${this.identifier()}`);
        },
      ],
    });

    $.class.new({
      name: 'classref-node',
      components: [
        $.ref_reader_macro,
        function char() {
          return '~';
        },
        function estree() {
          return b.memberExpression(b.identifier('$'), b.identifier(this.identifier()));
        },
      ],
    });

    $.class.new({
      name: 'globalref-node',
      components: [
        $.ref_reader_macro,
        function char() {
          return '@';
        },
        function estree() {
          const id = this.identifier();
          if (id === 'true' || id === 'false') {
            return b.booleanLiteral(Boolean(id));
          }
          return b.callExpression(b.memberExpression(b.memberExpression(b.identifier('globalThis'), b.identifier('SIMULABRA')), b.identifier(this.identifier())), []);
        }
      ]
    });

    $.class.new({
      name: 'typeref-node',
      components: [
        $.ref_reader_macro,
        function char() {
          return '!';
        },
        function estree() {
          return b.identifier('$TYPE_' + this.identifier());
        },
      ],
    });


    // issues with macro implementation: macros live at such an interesting part of the layer that
    // adding them requires a surgical, dedicated precision. the object itself that we invoke when
    // reading a form needs to handle the expansion of the arguments, given the environment.
    // does that mean that ($ frob (a b c)) would be an instance of the `frob` class? or is it
    // much more existential? kind of liking the idea that "macro invocations are instances of
    // the corresponding class", then macro definitions are just defining classes.
    // been running into a lot of ugliness with the class system too that I need to address -
    // my `reader-macro-class` feels kludgy to me, should be able to do that kind of class init
    // from the superclass relation. but that brings me to superclasses, and whether they should even
    // exist, or just be subsumed into a component system. remember, inheritance is a minefield!
    // and I am freer to maneuver now than evermore.
    $.class.new({
      name: 'macro',
      debug: true,
      components: [
        $.var.new({ name: 'name' }),
        $.var.new({ name: 'expand-fn', debug: false }),
        function expand(...args) {
          return this.expand_fn().apply(this, args.map(a => a.expand()));
        },
        $.after.new({
          name: 'init',
          do() {
            __._mod.def(this);
          }
        })
      ],
    });

    $.macro.new({
      name: 'macro',
      expand_fn(name, args, ...forms) {
        // compile body!
        const fn = $.lambda_node.new({
          args,
          body: $.body.new({ forms }),
        });
        $.debug.log(fn);
        console.log('estree', fn.estree());
        const fn_comp = prettyPrint(fn.estree()).code;
        return $.macro.new({
          name: name.value(),
          expand_fn: new Function(fn_comp),
        });
      }
    });

    $.class.new({
      name: 'body',
      components: [
        $.var.new({ name: 'forms' }),
        function estree() {
          return b.blockStatement(this.forms().map(f => {
            const ftree = f.estree();
            if (ftree.type.includes('Statement') || ftree.type === 'VariableDeclaration') {
              return ftree;
            } else {
              return b.expressionStatement(ftree);
            }
          }));
        },
        function expand() {
          return this.class().new({ forms: this.forms().map(f => f.expand()) });
        },
      ]
    })

    $.class.new({
      name: 'program',
      components: [
        $.var.new({ name: 'forms' }),
        function print() {
          return this.forms().map(f => f.print()).join(' ');
        },
        function estree() {
          return b.program(this.forms().map(f => {
            // this.log(f);
            const ftree = f.estree();
            if (ftree.type.includes('Statement')) {
              return ftree;
            } else {
              return b.expressionStatement(ftree);
            }
          }));
        },
        function expand() {
          let res = $.program.new({ forms: this.forms().map(f => f.expand()) });
          return res;
        }
      ],
    });

    $.class.new({
      name: 'return-node',
      components: [
        $.node,
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('^');
            this.value(reader.read());
            return this;
          }
        }),
        function print() {
          return `^${this.value().print()}`;
        },
        function estree() {
          return b.returnStatement(this.value().estree());
        }
      ]
    });

    $.class.new({
      name: 'pointer-node',
      components: [
        $.node,
        $.var.new({ name: 'class-ref' }),
        $.var.new({ name: 'ref-name' }),
        $.method.new({
          name: 'chain',
          do: function chain(reader, n) {
            this.class_ref(n);
            return this.parse(reader);
          }
        }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('#');
            this.ref_name(reader.identifier());
            return this;
          }
        }),
        function print() {
          return `${this.class_ref().print()}#${this.ref_name()}`;
        },
        function estree() {
          return b.callExpression(b.memberExpression(b.identifier('_'), b.identifier('find')), [b.literal(this.class_ref().identifier()), b.literal(this.ref_name())]);
        }
      ]
    });


    $.class.new({
      name: 'restarg-node',
      components: [
        $.node,
        $.var.new({ name: 'arg' }),
        $.method.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('@');
            this.arg(reader.read());
            return this;
          }
        }),
        function print() {
          return `@${this.arg().print()}`;
        },
        function estree() {
          return b.restElement(this.arg().estree());
        }
      ]
    });

    $.class.new({
      name: 'reader',
      doc: 'read source into forms',
      components: [
        $.var.new({ name: 'stream', debug: false }),
        $.var.new({ name: 'readtable', default: () => $.readtable.standard(), debug: false, }),
        $.var.new({ name: 'chain-table', default: () => $.readtable.standard_chain(), debug: false, }),
        $.static.new({
          name: 'from-source',
          do(source) {
            return this.new({
              stream: $.stream.new({ value: source }),
            });
          }
        }),
        function peek(n = 0) {
          return this.stream().peek(n);
        },
        function next() {
          return this.stream().next();
        },
        function expect(c) {
          if (this.stream().peek() !== c) {
            throw new Error(`expected ${c} got ${this.stream().peek()}`);
          }
          return this.stream().next();
        },
        function inc(chars) {
          return chars.includes(this.peek());
        },
        function test(re) {
          return re.test(this.peek());
        },
        function whitespace() {
          return this.inc(' \n');
        },
        function alpha() {
          return this.test(/[A-Za-z]/);
        },
        function digit() {
          return this.test(/[0-9]/);
        },
        function delimiter() {
          return this.inc('(){}[]./:=|#');
        },
        function term() {
          return this.delimiter() || this.whitespace();
        },
        function identifier() {
          let s = '';
          while (!this.term()) {
            s += this.next();
          }
          return s;
        },
        function strip() {
          while (this.whitespace() || this.peek() === ';') {
            if (this.peek() === ';') { // comment
              while (this.peek() !== '\n') {
                this.next();
              }
            }
            this.stream().next();
          }
        },
        function node() {
          const c = this.peek();
          if (this.digit() || c === '-') {
            return $.number_literal.new().parse(this);
          } else if (this.readtable().has_char(c)) {
            return this.readtable().get(c).new().parse(this);
          } else {
            throw new Error(`unhandled: ${c} at ${this.stream().pos()}`);
          }
        },
        function chain() {
        },
        function read() {
          this.strip();
          if (this.peek() === null) { // not good
            return null;
          }
          let n = this.node();
          while (this.chain_table().has_char(this.peek())) {
            n = this.chain_table().get(this.peek()).new().chain(this, n);
          }
          return n;
        },
        function program() {
          const ps = [];
          try {
            while (!this.stream().ended()) {
              const p = this.read();
              if (p) {
                ps.push(p);
              }
            }
            return $.program.new({ forms: ps });
          } catch (e) {
            this.log('reading program failed at', this.stream().line_info());
            throw e;
          }
        }
      ],
    });

    // TODO: custom in-memory loader?
    // see https://nodejs.org/api/esm.html#customizing-esm-specifier-resolution-algorithm
    $.class.new({
      name: 'module-cache',
      components: [
        $.module,
        $.var.new({
          name: 'cache',
          default: () => new Map(),
        }),
        $.method.new({
          name: 'hash',
          do(code) {
            return createHash('md5').update(code).digest('hex').substring(0, 8);
          }
        }),
        $.after.new({
          name: 'init',
          async do() {
            await this.clear_out_js();
          }
        }),
        $.method.new({
          name: 'clear-out-js',
          do() {
            try {
              const files = ofs.readdirSync('out');
              for (const file of files) {
                const filePath = path.join('out', file);
                ofs.unlinkSync(filePath);
              }
            } catch (error) {
              console.error('Error while deleting files:', error);
            }
          }
        }),
        $.method.new({
          name: 'run',
          async: true,
          async do(code) {
            const hash = this.hash(code);

            if (!this.cache().has(hash)) {
              const modulePath = path.join('out', `${hash}.mjs`);

              try {
                await fs.access(modulePath);
              } catch (err) {
                if (err.code === 'ENOENT') {
                  await fs.writeFile(modulePath, code);
                } else {
                  throw err;
                }
              }

              const importedModule = await import(`./out/${hash}.mjs`);
              this.cache().set(hash, importedModule.default);
            }

            return this.cache().get(hash);
          },
        }),
      ],
    });

    $.class.new({
      name: 'transformer',
      components: [
        $.var.new({
          name: 'module-cache',
          default: () => $.module_cache.new(),
        }),
        $.method.new({
          name: 'transform',
          do(program) {
            return program.expand().estree();
          }
        }),
        $.method.new({
          name: 'run',
          do(name, source) {
            const prelude = `
import bootstrap from '../base.js';
var __ = bootstrap();
import test_mod from '../test.js';
import lisp_mod from '../lisp2.js';
const base_mod = __._base_mod;
export default await base_mod.find('class', 'module').new({
  name: '${name}',
  imports: [base_mod, test_mod, lisp_mod],
  on_load(_, $) {
`; // file cache + dynamic imports?
            const hat = '}}).load();';

            return this.module_cache().run(prelude + source + hat);
          }
        }),
      ],
    });

    $.class.new({
      name: 'script',
      components: [
        $.var.new({
          name: 'source',
          debug: false,
        }),
        $.var.new({
          name: 'module',
        }),
        $.method.new({
          name: 'run',
          do(_transformer) {
            const program = $.reader.from_source(this.source()).program();
            const transformedCode = _transformer.transform(program);
            const code = prettyPrint(transformedCode).code;
            return _transformer.run(this.name(), code);
          }
        })
      ]
    });
  }
});
