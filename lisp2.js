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
import { createHash } from 'crypto';
import fs from 'fs/promises';
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
                ':': $.symbol_node,
                '/': $.this_node,
                '(': $.list_node,
                '[': $.lambda_node,
                '{': $.map_node,
                '\'': $.quote_node,
                '`': $.quasiquote_node,
                ',': $.unquote_node,
                '.': $.message_node,
                '$': $.invoke_node,
                '%': $.argref_node,
                '~': $.classref_node,
                '!': $.typeref_node,
                '&': $.do_node,
                '^': $.return_node,
                '@': $.restarg_node,
                '"': $.string_literal_node,
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
          if (this.has_char(char)) {
            return this.table()[char];
          } else {
            throw new Error(this.format(`doesn't have ${char}`));
          }
        },
        function has_char(char) {
          // $.debug.log(char)
          if (this.table()[char]) {
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
            const newmap = Object.fromEntries(this.vars().map(it => [it.var_ref().name(), fn.apply(it.value(), args)]));
            return this.class().new(newmap);
          }
        }),
        $.method.new({
          name: 'expand',
          do() {
            return this;
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
      debug: true,
      components: [
        $.node,
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
          if (this.selector() === '+') {
            return b.binaryExpression('+', this.receiver().estree(), this.args().items()[0].estree());
          } else {
            let args = this.args().items().map(it => it.estree());
            if (!Array.isArray(args)) {
              args = [args];
            }
            return b.callExpression(b.memberExpression(this.receiver().estree(), b.identifier(this.selector())), args);
          }
        },
        function expand() {
          if (this.receiver().isa($.invoke_node)) {
            this.log('find macro', this.selector());
            const macro = _.find('macro', this.selector());
            const v = macro.expand(...this.args().expand());
            if (v === undefined) {
              throw new Error(`macro expansion failed for ${macro.title()} in ${this.title()}`)
            }
            return v;
          } else {
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
        function print() {
          return `(${this.items().map(it => it.print()).join(' ')})`;
        },
        function empty() {
          return this.items().length === 0;
        },
        function estree() {
          this.log(this.items());
          return b.arrayExpression(this.items().map(it => it.estree()));
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
            while (reader.peek() !== '|') {
              this.args().push(reader.read());
              reader.strip();
            this.log(reader.peek());
            }
            reader.expect('|');
            reader.strip();
            const forms = [];
            while (reader.peek() !== ']') {
              forms.push(reader.read());
              reader.strip();
            }
            this.log(reader.peek());
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
          return b.functionExpression(null, this.args().map(a => a.estree()), this.body().estree());
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
            while (reader.digit() || reader.peek() === '.') {
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
    })

    $.class.new({
      name: 'argref-node',
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
          return b.identifier(`_${this.identifier()}`);
        },
      ],
    });

    $.class.new({
      name: 'classref-node',
      components: [
        $.ref_reader_macro,
        $.method.new({
          name: 'char',
          do() {
            return '~';
          }
        }),
        function char() {
          return '~';
        },
        function estree() {
          return b.memberExpression(b.identifier('$'), b.identifier(this.identifier()));
        },
      ],
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
    })

    $.class.new({
      name: 'body',
      components: [
        $.var.new({ name: 'forms' }),
        function estree() {
          // this.log('vars', this.vars());
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
          return this.inc('(){}[]./:=|');
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
          while (this.whitespace()) {
            this.stream().next();
          }
        },
        function read() {
          this.strip();
          let c = this.peek();
          if (c === null) {
            return null;
          }
          if (this.readtable().has_char(c)) {
            const res = this.readtable().get(c).new().parse(this);
            // this.log('from readtable', res);
            // this.log(c, this.peek());
            if (this.peek() === '.') {
              return $.message_node.new({ receiver: res }).parse(this);
            } else if (this.peek() === ':') {
              return $.pointer_node.new({ class: res }).parse(this);
            } else {
              return res;
            }
          } else {
            this.dlog('not in readtable:', c);
          }
          if (this.digit() || c === '-') {
            return $.number_literal.new().parse(this);
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
        $.method.new({
          name: 'run',
          async: true,
          async do(code) {
            this.log('run', code);
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
