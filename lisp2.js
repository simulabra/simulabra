/*
 * probably let's just burn it all
 * start afresh with syntax
 * make it lispier?
 *
 * (. msg-name %x %y)
 * symbol .this-msg ~class-name !type-name %arg-name ^return :symbol $.macro-name |pipe-name
 * (. msg-name %x %y) ($ macro-name s (./frob))
 * (%arg msg .) (~debug log "testing") (. x |+ 5 |sqrt)
 * [2 4 6 8]
 * {name :something value (%x * 42 |pow 3)}
 *
 * ($.def ~class point {
 *   :slots {
 *     :x (~var new)
 *     :y (~var new)
 *     :dist ($.fn [other] ^(. x |- (%other x) |pow 2 |+ (. y |- (%other y |pow 2)) |sqrt))
 *   }
 * })
 *
 * quasiquotes
 * "Backquote expressions are just a handy notation for writing complicated
 * combinations of calls to list constructors." (Bawden)
 * ($.macro :cpt (%name))
 * `(.add {:,%name {:value (.,%name)}})
 * ($.cpt :x) => (.add {:x {:value (.x)}})
 *
 * traits?
 * desires for the shape of something?
 *
 * ObjectLiteral
 * Literal
 */

import bootstrap from './base.js';
import { prettyPrint, types } from 'recast';
var __ = bootstrap();
let base_mod = __.mod();
export default __.new_module({
  name: 'lisp',
  imports: [base_mod],
  on_load(_, $) {
    const $primitive = _.proxy('primitive');
    const b = types.builders;

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
          do: function () {
            if (this.pos() < this.value().length) {
              return this.value()[this.pos()];
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
          name: 'standard',
          do() {
            return this.new({
              table: {
                ':': $.symbol,
                '/': $.this,
                '(': $.list,
                '{': $.map,
                '[': $.lambda,
                '\'': $.quote,
                '`': $.quasiquote,
                ',': $.unquote,
                '.': $.message,
                '$': $.invoke,
                '%': $.argref,
                '~': $.classref,
                '!': $.typeref,
                '&': $.do,
                '^': $.return,
                '@': $.restarg,
              },
            });
          },
        }),
        $.var.new({ name: 'table', default: {} }),
        function add(macro, char) {
          // $.debug.log(`rt add ${macro.char()} ${macro.name()}`);
          this.table()[char] = macro;
        },
        function get(char) {
          // $.debug.log(`rt get ${char} ${this.table()[char]}`);
          return this.table()[char];
        },
        function has_char(char) {
          // $.debug.log(char)
          if (char in this.table()) {
            // $.debug.log(this.table()[char]);
            return true;
          }
          return false;
        },
      ]
    });

    $.class.new({
      name: 'node',
      components: [
        function quote() {
          const props = {};
          for (const v of this.class().vars()) {
            const k = v.name().deskewer();
            props[k] = this[k]().quote();
          }
          return $.message.new({
            receiver: $.classref.new({ symbol: $.symbol.new({ value: this.class().name() }) }),
            message: $.symbol.new({ value: 'new' }),
            args: [props]
          });
        },
        function children() {
          return this.vars().filter(vs => this.log(vs) || vs.value().class().descended($.node));
        },
        function visit(fn, args = []) {
          const newmap = Object.fromEntries(this.vars().map(it => [it.var_ref().name(), fn.apply(it.value(), args)]));
          return this.class().new(newmap);
        },
        function expand() {
          return this;
        },
        function quasiexpand() {
          return $.quote.new({ value: this });
        },

      ]
    })

    $.class.new({
      name: 'symbol',
      components: [
        $.node,
        $.var.new({ name: 'value' }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect(':');
            return this.new({ value: reader.symbol().value() });
          }
        }),
        $.static.new({
          name: 'of',
          do: function of(reader) {
            return this.new({ value });
          }
        }),
        function estree() {
          return b.stringLiteral(this.value());
        },
        function print() {
          return ':' + this.value();
        },
      ],
    });

    // $primitive.object_primitive.extend($.method.new({
    //   name: 'expand',
    //   do: function() {
    //     return this;
    //   },
    // }));

    $primitive.array_primitive.extend($.method.new({
      name: 'quote',
      do: function () {
        return this.map(e => {
          return e.quote();
        });
      },
    }))

    $primitive.string_primitive.extend($.method.new({
      name: 'quote',
      do: function () {
        return b.stringLiteral(this);
      },
    }));

    $.class.new({
      name: 'this',
      components: [
        $.node,
        function print() {
          return '.';
        },
        function estree() {
          return b.thisExpression();
        },
      ],
    });

    $.class.new({
      name: 'message',
      debug: true,
      components: [
        $.node,
        $.static.new({
          name: 'parse',
          do: function parse(reader, receiver = null) {
            if (!receiver) {
              receiver = $.this.new();
            }
            reader.expect('.');
            const selector = reader.symbol();
            let args;
            if (reader.peek() === '(') {
              args = $.list.parse(reader);
            }
            return this.new({ receiver, selector, args });
          }
        }),
        $.var.new({ name: 'receiver' }),
        $.var.new({ name: 'selector' }),
        $.var.new({ name: 'args' }),
        function print() {
          return `${this.receiver().print()}.${this.selector().print()}${this.args()?.print()}`;
        },
      ],
    });

    // $.class.new({
    //   name: 'call',
    //   components: [
    //     $.node,
    //     $.static.new({
    //       name: 'finish-parsing',
    //       do(reader, receiver) {
    //         let call = this.new({ receiver });
    //         while (reader.peek() === '.') {
    //           call.add_message($.message.parse(reader));
    //         }
    //         return call;
    //       }
    //     }),
    //     $.var.new({ name: 'receiver' }),
    //     $.var.new({ name: 'messages', default: [] }),
    //     function print() {
    //       return `${this.receiver().print()}${this.messages().map(m => m.print()).join('')}`;
    //     },
    //     $.method.new({
    //       name: 'add-message',
    //       do(message) {
    //         this.messages().push(message);
    //       }
    //     }),
    //     function estree() {
    //       return b.callExpression(b.memberExpression(this.receiver().estree(), this.message().estree()), this.args().map(a => a.estree()));
    //     },
    //   ]
    // });

    $.class.new({
      name: 'property',
      components: [
        $.node,
        $.var.new({ name: 'key' }),
        $.var.new({ name: 'value' }),
        function print() {
          this.log(this.value().print());
          return `${this.key().print()} ${this.value().print()}`;
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
      name: 'list',
      components: [
        $.var.new({ name: 'items', default: [] }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('(');
            const items = [];
            while (reader.peek() !== ')') {
              reader.strip();
              items.push(reader.read());
              reader.strip();
            }
            reader.expect(')');
            return this.new({ items });
          },
        }),
        function print() {
          return `(${this.items().map(it => it.print()).join(' ')})`;
        },
        function estree() {
          // $.debug.log(this, this.items());
          // console.log('oh')
          // this.log(this.items());
          return b.arrayExpression(this.items().map((it, idx) => {
            try {
              it.estree()
            } catch (e) {
              // $.debug.log(this.items(), it, idx);
              throw e;
            }
          }));
        },
        function expand() {
          return this.class().new({ items: this.items().map(it => it.expand()) });
        },
        function map(fn) {
          return this.class().new({ items: this.items().map(fn) });
        },
        function push(it) {
          this.items().push(it);
          return this;
        }
      ]
    });

    $.class.new({
      name: 'lambda',
      debug: true,
      components: [
        $.var.new({ name: 'args' }),
        $.var.new({ name: 'body' }),
        $.static.new({
          name: 'parse',
          do(reader) {
            reader.expect('[');
            reader.strip();
            const args = reader.peek() === '(' ? $.list.parse(reader) : $.list.new({
              items: [$.argref.new({  })]
            })
            const body = [];
            while (reader.peek() !== ']') {
              reader.strip();
              body.push(reader.read());
              reader.strip();
            }
            reader.expect(']');
            return this.new({ args, body });
          }
        }),
        function print() {
          return `[${this.args}]`
        },
        function estree() {
          this.log('estree');
          return b.functionExpression(null, this.args().items().map(a => b.identifier('_' + a)), this.body().estree());
        }
      ],
    });

    $.class.new({
      name: 'map',
      components: [
        $.node,
        $.var.new({ name: 'properties' }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // {
            const properties = [];
            while (reader.peek() !== '}') {
              reader.strip();
              const key = reader.symbol();
              reader.strip();
              const value = reader.read();
              properties.push($.property.new({ key, value }))
              reader.strip();
            }
            reader.next(); // }
            return this.new({ properties });
          }
        }),
        function print() {
          return `{ ${this.properties().map(prop => prop.print()).join(' ')} }`;
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
      name: 'quote',
      components: [
        $.var.new({ name: 'value' }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // '
            return this.new({
              value: reader.read(),
            });
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
      name: 'quasiquote',
      components: [
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // `
            let value = reader.read();
            // this.log(value);
            return value.visit(function () {
              // $.debug.log('visit for quasiexpand', this);
              this.quasiexpand();
            });
          }
        }),
      ],
    });

    $.class.new({
      name: 'unquote',
      components: [
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // ,
            return this.new({ value: reader.read() });
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
      name: 'invoke',
      components: [
        $.node,
        $.var.new({ name: 'macro' }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('$');
            return this.new();
          }
        }),
        $.static.new({
          name: 'inst',
          do: function inst() {
            if (!this._inst) {
              this._inst = this.new();
            }
            return this._inst;
          }
        }),
        function print() {
          return '$';
        },
        function estree() {
          return b.identifier('$$');
        },
        function expand() {

        }
      ],
    });

    $.class.new({
      name: 'ref-reader-macro',
      components: [
        $.node,
        $.var.new({ name: 'symbol' }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect(this.char()); // %
            return this.new({ symbol: reader.symbol() })
          }
        }),
        function print() {
          return `${this.char()}${this.symbol().print()}`;
        },
        function expand() {
          return this;
        }
      ],
    })

    $.class.new({
      name: 'argref',
      components: [
        $.ref_reader_macro,
        $.static.new({
          name: 'char',
          do() {
            return '%';
          }
        }),
        function char() {
          return '%';
        },
        function estree() {
          return b.identifier(`_${this.symbol().value()}`);
        },
      ],
    });

    $.class.new({
      name: 'classref',
      components: [
        $.ref_reader_macro,
        $.static.new({
          name: 'char',
          do() {
            return '~';
          }
        }),
        function char() {
          return '~';
        },
        function estree() {
          return b.memberExpression(b.identifier('$'), this.symbol().estree());
        },
      ],
    });

    $.class.new({
      name: 'typeref',
      components: [
        $.ref_reader_macro,
        function char() {
          return '!';
        },
        function estree() {
          return this.quote();
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
          this.log('expand');
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
      name: 'lambda',
      expand_fn(args, body) {
        return $.lambda.new({ args, body });
      }
    })

    $.macro.new({
      name: 'macro',
      expand_fn(name, args, ...forms) {
        // compile body!
        const fn = $.lambda.new({
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
    })

    $.class.new({
      name: 'body',
      components: [
        $.var.new({ name: 'forms' }),
        function estree() {
          this.log('vars', this.vars());
          return b.blockStatement(this.forms().map(f => {
            const ftree = f.estree();
            if (ftree.type.includes('Statement')) {
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

    $.macro.new({
      name: 'do',
      expand_fn(...forms) {
        return $.lambda.new({
          args: $.list.new({ items: [$.identifier.new({ value: 'it' })] }),
          body: $.body.new({ forms: forms.map(f => f.expand()) }),
        })
      },
    });

    $.class.new({
      name: 'program',
      components: [
        $.var.new({ name: 'forms' }),
        function print() {
          return this.forms().map(f => f.print()).join(' ');
        },
        function estree() {
          return b.program(this.forms().map(f => {
            this.log(f);
            const ftree = f.estree();
            if (ftree.type.includes('Statement')) {
              return ftree;
            } else {
              return b.expressionStatement(ftree);
            }
          }));
        },
        function expand() {
          return $.program.new({ forms: this.forms().map(f => f.expand()) });
        }
      ],
    });

    $.class.new({
      name: 'identifier',
      components: [
        $.node,
        $.var.new({ name: 'value' }),
        function print() {
          return this.value();
        },
        function estree() {
          return b.identifier(this.value());
        },
      ],
    });

    $.class.new({
      name: 'do',
      components: [
        $.node,
        $.var.new({ name: 'value' }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.expect('&');
            return this.new({ value: reader.read() });
          }
        }),
      ]
    })

    $.class.new({
      name: 'return',
      components: [
        $.node,
        $.var.new({ name: 'value' }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // ^
            return this.new({ value: reader.read() });
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
      name: 'restarg',
      components: [
        $.node,
        $.var.new({ name: 'arg' }),
        $.static.new({
          name: 'parse',
          do: function parse(reader) {
            reader.next(); // @
            return this.new({ arg: reader.read() });
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
        $.var.new({ name: 'readtable', default: $.readtable.standard(), debug: false, }),
        $.static.new({
          name: 'from-source',
          do(source) {
            return this.new({
              stream: $.stream.new({ value: source }),
            });
          }
        }),
        function peek() {
          return this.stream().peek();
        },
        function next() {
          return this.stream().next();
        },
        function expect(c) {
          const sc = this.stream().next();
          if (sc !== c) {
            throw new Error(`expected ${c} got ${sc}`);
          }
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
          return this.inc('(){}[].');
        },
        function term() {
          return this.delimiter() || this.whitespace();
        },
        function number() {
          let n = '';
          while (this.digit() || this.peek() === '.') {
            n += this.next();
          }
          return new Number(n);
        },
        function symbol() {
          let s = '';
          while (!this.term()) {
            s += this.next();
          }
          return $.identifier.new({ value: s });
        },
        function strip() {
          while (this.whitespace()) {
            this.stream().next();
          }
        },
        function read() {
          this.strip();
          let c = this.peek();
          if (c === null) {
            return;
          }
          if (this.readtable().has_char(c)) {
            const res = this.readtable().get(c).parse(this);
            this.log('from readtable', res);
            // this.log(c, this.peek());
            if (this.peek() === '.') {
              return $.message.parse(this, res);
            } else {
              return res;
            }
          } else {
            this.dlog('not in readtable:', c);
          }
          if (c === '-') {
            this.next();
            if (this.digit()) {
              return -this.number();
            } else {
              return $.symbol.of('-');
            }
          }
          if (this.digit()) {
            return this.number();
          }
          if (this.alpha()) {
            return this.symbol();
          }
          throw new Error(`unhandled: ${c} at ${this.stream().pos()}`);
        },
        function program() {
          const ps = [];
          try {
            while (!this.stream().ended()) {
              const p = this.read();
              if (p) {
                ps.push(p);
              } else {
                this.log('read returned nothing?');
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

    $.class.new({
      name: 'source-module',
      components: [
        $.module,
        $.var.new({
          name: 'source',
          debug: false,
        }),
        $.static.new({
          name: 'run',
          do(name, source) {
            this.new({ name, source }).load();
          }
        }),
        $.method.new({
          name: 'load',
          do() {
            const program = $.reader.from_source(this.source()).program();
            this.log(program.print());
            const code = prettyPrint(program.expand().estree()).code;
            this.log('code', code, typeof code);
            const head = `
var __ = globalThis.SIMULABRA;
const _ = __.mod().find('class', 'module').new({
  name: '${this.name()}',
  imports: [__.mod()],
});
__.mod(_);
var $ = _.proxy('class');
`
            eval(head + code);
          }
        })
      ]
    })
  }
});
