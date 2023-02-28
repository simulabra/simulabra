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

import './base.js';
const __ = globalThis.SIMULABRA;
const _ = __.mod().find('class', 'module').new({
  name: 'lisp2',
  imports: [__.mod()],
});
const $ = _.proxy('class');
const $primitive = _.proxy('primitive');
import { prettyPrint, types } from 'recast';
const b = types.builders;

$.class.new({
  name: 'stream',
  components: [
    $.var.new({ name: 'pos', default: 0 }),
    $.var.new({ name: 'value' }),
    $.method.new({
      name: 'next',
      do: function() {
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
      do: function() {
        if (this.pos() < this.value().length) {
          return this.value()[this.pos()];
        }
        return null;
      }
    }),
    $.method.new({
      name: 'ended',
      do: function() {
        return this.pos() >= this.value().length;
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
            '.': $.this,
            '[': $.list,
            '(': $.message,
            '{': $.map,
            '\'': $.quote,
            '`': $.quasiquote,
            ',': $.unquote,
            '$': $.invoke,
            '%': $.argref,
            '~': $.classref,
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
      // return b.callExpression(b.memberExpression(b.identifier('$' + this.class().name()), b.identifier('new')), [b.objectExpression(
      //   this.class().vars().map(v => {
      //     const k = v.name().deskewer();
      //     return b.property('init', b.identifier(k), this[k]().quote());
      //   })
      // )])
    },
    function expand() {
      return this;
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
        reader.next(); // :
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
    function description() {
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
  do: function() {
    return this.map(e => {
      return e.quote();
    });
  },
}))

$primitive.string_primitive.extend($.method.new({
  name: 'quote',
  do: function() {
    return b.stringLiteral(this);
  },
}));

$.class.new({
  name: 'this',
  components: [
    $.static.new({
      name: 'parse',
      do: function parse(reader) {
        reader.next();
        return this.new();
      }
    }),
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
    $.static.new({
      name: 'parse',
      do: function parse(reader) {
        reader.next(); // (
        reader.strip();

        let receiver = reader.read();
        let message = reader.read();
        let args = [];
        while (reader.peek() !== ')') {
          reader.strip();
          if (reader.peek() === '|') {
            receiver = this.new({ receiver, message, args });
            reader.next();
            reader.strip();
            message = reader.read();
            args = [];
          } else {
            args.push(reader.read());
          }
          reader.strip();
        }
        reader.next(); // )
        return this.new({ receiver, message, args });
      }
    }),
    $.var.new({ name: 'receiver' }),
    $.var.new({ name: 'message' }),
    $.var.new({ name: 'args', default: [] }),
    function vau() {
      return this.receiver().class().name() === 'invoke';
    },
    function print() {
      return `(${this.receiver().print()} ${this.message().print()} ${this.args().map(c => c.print()).join(' ')})`;
    },
    function estree() {
      return b.callExpression(b.memberExpression(this.receiver().estree(), this.message().estree()), this.args().map(a => a.estree()));
    },
    function expand() {
      this.log('expand invoke', this.receiver().class().name());
      if (this.vau()) {
        // find macro
        const m = _.find('macro', this.message().value());
        this.log('invoke', this.message().value(), m);
        // apply macro
        let v = m.expand(...this.args());
        if (v == undefined) {
          throw new Error(`macro expansion failed for ${m.description()} in ${this.description()}`);
        }
      } else {
        this.receiver().log('receiver');
        return $.message.new({
          receiver: this.receiver().expand(),
          message: this.message(),
          args: this.args().map(a => a.expand()),
        });
      }
    }
  ],
});

$.class.new({
  name: 'property',
  components: [
    $.node,
    $.var.new({ name: 'key' }),
    $.var.new({ name: 'value' }),
    function print() {
      return `${this.name().print()} ${this.value().print()}`;
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
  debug: true,
  components: [
    $.var.new({ name: 'items' }),
    $.static.new({
      name: 'parse',
      do: function parse(reader) {
        reader.next(); // [
        const items = [];
        while (reader.peek() !== ']') {
          reader.strip();
          items.push(reader.read());
          reader.strip();
        }
        reader.next(); // ]
        return this.new({ items });
      },
    }),
    function print() {
      return `[${this.items().map(it => it.print()).join(' ')}]`;
    },
    function estree() {
      $.debug.log(this, this.items());
      console.log('oh')
      this.log(this.items());
      return b.arrayExpression(this.items().map((it, idx) => {
        try {
          it.estree()
        } catch (e) {
          $.debug.log(this.items(), it, idx);
          throw e;
        }
      }));
    },
    function expand() {
      return this.class().new({ items: this.items().map(it => it.expand()) });
    },
    function map(fn) {
      return this.class().new({ items: this.items().map(fn) });
    }
  ]
});

$.class.new({
  name: 'map',
  components: [
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
      return `{${this.properties().map(prop => prop.print()).join(' ')}}`;
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
    $.var.new({ name: 'value' }),
    $.static.new({
      name: 'parse',
      do: function parse(reader) {
        reader.next(); // `
        let value = reader.read();
        return this.new({
          value
        });
      }
    }),
    function print() {
      return `'${this.value().print()}`;
    },
    function expand() {
        // convert all forms to quoted except unquotes
      // this.value().map(it =>                                                )
      $.debug.log('quasiquote expand', this.value());
    },
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
    $.method.new({
      name: 'quote',
      do: function quote() {
        return this.value();
      }
    }),
    $.var.new({ name: 'value' }),
  ]
});

$.class.new({
  name: 'invoke',
  components: [
    $.node,
    $.static.new({
      name: 'parse',
      do: function parse(reader) {
        reader.next();
        return this.inst();
      }
    }),
    $.static.new({
      name: 'inst',
      do: function inst(reader) {
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
    $.var.new({ name: 'symbol' }),
    $.static.new({
      name: 'parse',
      do: function parse(reader) {
        reader.next(); // %
        return this.new({ symbol: reader.read() })
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
    function char() {
      return '~';
    },
    function estree() {
      return b.memberExpression(b.identifier('$'), this.symbol().estree());
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
      return this.expand_fn().apply(this, args);
    },
    $.after.new({
      name: 'init',
      do() {
        __._mod.def(this);
      }
    })
  ],
});

$.class.new({
  name: 'lambda',
  debug: true,
  components: [
    $.var.new({ name: 'args' }),
    $.var.new({ name: 'body' }),
    function estree() {
      this.log('estree');
      return b.functionExpression(null, this.args().items().map(a => b.identifier('_' + a)), this.body().estree());
    }
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
      return b.blockStatement(this.forms().map(f => {
        const ftree = f.estree();
        if (ftree.type.includes('Statement')) {
          return ftree;
        } else {
          return b.expressionStatement(ftree);
        }
      }));
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
    $.var.new({ name: 'value' }),
    function print() {
      return this.value();
    },
    function estree() {
      return b.identifier(this.value());
    },
    function expand() {
      return this;
    }
  ],
});

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
    $.var.new({ name: 'stream' }),
    $.var.new({ name: 'readtable', default: $.readtable.standard() }),
    function peek() {
      return this.stream().peek();
    },
    function next() {
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
      return this.inc('(){}[]');
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
      if (this.peek() === null) {
        return;
      }
      if (this.readtable().has_char(this.peek())) {
        try {
          return this.readtable().get(this.peek()).parse(this);
        } catch (e) {
          $.debug.log('failed readtable', this.peek(), this.readtable().get(this.peek()));
          throw e;
        }
      } else {
        this.dlog('not in readtable:', this.peek());
      }
      if (this.peek() === '-') {
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
      throw new Error(`unhandled: ${this.peek()} at ${this.stream().pos()}`);
    },
    function program() {
      const ps = [];
      while (!this.stream().ended()) {
        const p = this.read();
        if (p) {
          ps.push(p);
        }
      }
      return $.program.new({ forms: ps });
    }
  ],
});

$.class.new({
  name: 'source-module',
  debug: true,
  components: [
    $.module,
    $.var.new({
      name: 'source',
      debug: false,
    }),
    $.method.new({
      name: 'load',
      do() {
        const program = $.reader.new({ stream: $.stream.new({ value: this.source() }) }).program();
        const code = prettyPrint(program.expand().estree()).code;
        console.log(code);
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

const ex = `
($ macro quickmeth [name args @forms]
  \`(~method new {
      name ,%name
      do ($ lambda ,%args ,%forms)
    })
)

(~class new {
  name :point
  components [
    (~var new {
      name :x
      default 0
    })
    (~var new {
      name :y
      default 0
    })
    (~method new {
      name :dist
      do ($ do ^(. x | sub (%it x) | pow 2 | add (. y | sub (%it y) | pow 2) | sqrt))
    })
    ($ quickmeth translate [other]
      (. x (. x | add (%other x)))
      (. y (. y | add (%other y)))
    )
  ]
})
(~debug log (~point new {x 3 y 4} | dist (~point new)))

`;

$.source_module.new({
  name: 'test',
  source: ex,
}).load();
