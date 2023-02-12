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

import { $s } from './base.js';
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
    $.var.new({ static: true, name: 'standard' }),
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

$.readtable.standard($.readtable.new());

$.class.new({
  name: 'reader-macro',
  components: [
    $.after.new({
      name: 'init',
      static: true,
      do() {
        $.debug.log('init reader-macro', this)
        $.readtable.standard().add(this, this.char());
      }
    }),
    $.var.new({
      name: 'char',
      static: true,
    }),
    function quote() {
      return b.callExpression(b.memberExpression(b.identifier('$' + this.class().name()), b.identifier('new')), [b.objectExpression(
        this.class().vars().map(v => {
          const k = v.name().deskewer();
          return b.property('init', b.identifier(k), this[k]().quote());
        })
      )])
    },
    function expand() {
      return this;
    },
  ],
})

$.class.new({
  name: 'reader-macro-class',
  components: [
    $.class,
    $.var.new({ name: 'char' }),
    $.after.new({
      name: 'init',
      do: function() {
        this.log('add to readtable', this, this.char());
        $.readtable.standard().add(this);
      }
    })
  ],
});

$.class.new({
  name: 'symbol',
  components: [
    $.reader_macro,
    $.var.new({ name: 'value' }),
    $.method.new({
      name: 'parse',
      static: true,
      do: function parse(reader) {
        reader.next(); // :
        return this.new({ value: reader.symbol().value() });
      }
    }),
    $.method.new({
      name: 'of',
      static: true,
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
    function quote() {
      return b.stringLiteral(this.value());
    }
  ],
});

$.readtable.standard().add($.symbol, ':');

$primitive.object_primitive.extend($.method.new({
  name: 'quote',
  do: function() {
    return b.literal(this);
  },
}));

$primitive.object_primitive.extend($.method.new({
  name: 'expand',
  do: function() {
    return this;
  },
}));

$primitive.array_primitive.extend($.method.new({
  name: 'quote',
  do: function() {
    return b.arrayExpression(this.map(e => e.quote()));
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
    $.method.new({
      name: 'parse',
      static: true,
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
    function quote() {
      return b.identifier('$' + this.class().name());
    }
  ],
});
$.readtable.standard().add($.this, '.');

$.class.new({
  name: 'message',
  components: [
    $.reader_macro,
    $.method.new({
      name: 'parse',
      static: true,
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
        try {
          return m.expand(...this.args());
        } catch(e) {
          $.debug.log('error in macro expansion', this, m);
          throw e;
        }
      } else {
        return $.message.new({
          receiver: this.receiver().expand(),
          message: this.message(),
          args: this.args().map(a => a.expand()),
        });
      }
    }
  ],
});
$.readtable.standard().add($.message, '(');

$.class.new({
  name: 'property',
  components: [
    $.var.new({ name: 'name' }),
    $.var.new({ name: 'value' }),
    function print() {
      return `${this.name().print()} ${this.value().print()}`;
    },
    function estree() {
      return b.property('init', this.name().estree(), this.value().estree());
    },
    function expand() {
      this.log('expand property', this.name(), this.value())
      return this.class().new({ name: this.name(), value: this.value().expand() });
    }
  ],
})

$.class.new({
  name: 'list',
  components: [
    $.reader_macro,
    $.var.new({ name: 'items' }),
    $.method.new({
      name: 'parse',
      static: true,
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
      return b.arrayExpression(this.items().map(it => it.estree()));
    },
    function expand() {
      return this.class().new({ items: this.items().map(it => it.expand()) });
    },
    function map(fn) {
      return this.class().new({ items: this.items().map(fn) });
    }
  ]
});
$.readtable.standard().add($.list, '[');

$.class.new({
  name: 'map',
  components: [
    $.reader_macro,
    $.var.new({ name: 'properties' }),
    $.method.new({
      name: 'parse',
      static: true,
      do: function parse(reader) {
        reader.next(); // {
        const properties = [];
        while (reader.peek() !== '}') {
          reader.strip();
          const name = reader.symbol();
          reader.strip();
          const value = reader.read();
          properties.push($.property.new({ name, value }))
          reader.strip();
        }
        reader.next(); // }
        return this.new({ properties });
      }
    }),
    function print() {
      return `{${this.properties().map(prop => prop.print()).join('\n')}}`;
    },
    function estree() {
      return b.objectExpression(this.properties().map(p => p.estree()))
    },
    function expand() {
      return this.class().new({ properties: this.properties().map(prop => prop.expand()) });
    }
  ],
});
$.readtable.standard().add($.map, '{');

$.class.new({
  name: 'quote',
  components: [
    $.reader_macro,
    $.var.new({ name: 'value' }),
    $.method.new({
      name: 'parse',
      static: true,
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
          return b.property('init', b.identifier(k), it[k]().quote());
        })
      )])
    }
  ],
});
$.readtable.standard().add($.quote, '\'');

$.class.new({
  name: 'quasiquote',
  components: [
    $.reader_macro,
    $.var.new({ name: 'value' }),
    $.method.new({
      name: 'parse',
      static: true,
      do: function parse(reader) {
        // convert all forms to quoted except unquotes
        reader.next(); // `
        return reader.read().quote();
      }
    }),
    function print() {
      return `'${this.value().print()}`;
    },
    function expand() {
      return this.value().quote();
    },
    function estree() {
      return this.value().quote();
    }
  ],
});
$.readtable.standard().add($.quasiquote, '`');

$.class.new({
  name: 'unquote',
  components: [
    $.method.new({
      name: 'parse',
      static: true,
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
$.readtable.standard().add($.unquote, ',');

$.class.new({
  name: 'invoke',
  components: [
    $.method.new({
      name: 'parse',
      static: true,
      do: function parse(reader) {
        reader.next();
        return this.inst();
      }
    }),
    $.method.new({
      name: 'inst',
      static: true,
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
    }
  ],
});
$.readtable.standard().add($.invoke, '$');

$.class.new({
  name: 'ref-reader-macro',
  components: [
    $.reader_macro,
    $.var.new({ name: 'symbol' }),
    $.method.new({
      name: 'parse',
      static: true,
      do: function parse(reader) {
        reader.next(); // %
        return this.new({ symbol: reader.read() })
      }
    }),
    function print() {
      return `${this.char()}${this.symbol().print()}`;
    },
  ],
})

$.class.new({
  name: 'argref',
  components: [
    $.ref_reader_macro,
    $.var.new({ name: 'char', default: '%' }),
    function estree() {
      return b.identifier(`_${this.symbol().value()}`);
    },
  ],
});
$.readtable.standard().add($.argref, '%');

$.class.new({
  name: 'classref',
  components: [
    $.ref_reader_macro,
    $.var.new({ name: 'char', default: '~' }),
    function estree() {
      return b.memberExpression(b.identifier('$'), this.symbol().estree());
    },
  ],
});
$.readtable.standard().add($.classref, '~');


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
  components: [
    $.var.new({ name: 'name' }),
    $.var.new({ name: 'expand-fn', debug: false }),
    function expand(...args) {
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
  components: [
    $.var.new({ name: 'args' }),
    $.var.new({ name: 'body' }),
    function estree() {
      return b.functionExpression(null, this.args().map(a => b.identifier('_' + a)), this.body().estree());
    }
  ],
});

$.macro.new({
  name: 'lambda',
  expand_fn(args, body) {
    return $.lambda.new({ args, body });
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
      args: ['it'],
      body: $.body.new({ forms }),
    })
  },
});

$.class.new({
  name: 'program',
  components: [
    $.var.new({ name: 'forms' }),
    function print() {
      return this.forms().map(f => f.print()).join('\n');
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
    $.reader_macro,
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
    $.reader_macro,
    $.var.new({ name: 'value' }),
    $.method.new({
      name: 'parse',
      static: true,
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
$.readtable.standard().add($.return, '^');

$.class.new({
  name: 'restarg',
  components: [
    $.reader_macro,
    $.var.new({ name: 'arg' }),
    $.method.new({
      name: 'parse',
      static: true,
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
$.readtable.standard().add($.restarg, '@');

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
          this.log('failed readtable', this.peek(), this.readtable().get(this.peek()));
          throw e;
        }
      } else {
        this.log('not in readtable:', this.peek());
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
    }),
    $.method.new({
      name: 'load',
      do() {
        const program = $.reader.new({ stream: $.stream.new({ value: this.source() }) }).program();
        const code = prettyPrint(program.expand().estree()).code;
        tihs.log('code', code);
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
      name :,%name
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
