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
const _ = __.$base.module.new({
  name: 'lisp2',
  imports: [__._base],
});
const $ = _.proxy('class');
const $primitive = _.proxy('primitive');
import { prettyPrint, types } from 'recast';
const b = types.builders;

$.class.new({
  name: 'stream'.s,
  components: [
    $.var.new({ name: 'pos'.s, default: 0 }),
    $.var.new({ name: 'value'.s }),
    $.method.new({
      name: 'next'.s,
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
      name: 'peek'.s,
      do: function() {
        if (this.pos() < this.value().length) {
          return this.value()[this.pos()];
        }
        return null;
      }
    }),
    $.method.new({
      name: 'ended'.s,
      do: function() {
        return this.pos() >= this.value().length;
      }
    }),
  ]
});

$.class.new({
  name: 'readtable'.s,
  components: [
    $.var.new({ static: true, name: 'standard'.s }),
    $.var.new({ name: 'table'.s, default: {} }),
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
$.debug.log('readtable class', $.readtable.new().class())

$.class.new({
  name: 'reader-macro'.s,
  components: [
    function quote() {
      return b.callExpression(b.memberExpression(b.identifier('$' + this.class().name()), b.identifier('new')), [b.objectExpression(
        this.vars().map(v => {
          return b.property('init', b.identifier(v.v().name()), v.state().quote());
        })
      )])
    },
    function expand() {
      return this;
    },
  ],
})

$.class.new({
  name: 'reader-macro-class'.s,
  components: [
    $.class,
    $.var.new({ name: 'char'.s }),
    $.after.new({
      name: 'init',
      do: function() {
        $.debug.log('add to readtable', this, this.char());
        $.readtable.standard().add(this);
      }
    })
  ],
});

$.class.new({
  name: 'symbol'.s,
  components: [
    $.var.new({ name: 'value'.s }),
    $.method.new({
      name: 'parse',
      static: true,
      do: function parse(reader) {
        reader.next(); // :
        return this.new({ value: reader.symbol() });
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
      return b.callExpression(b.identifier('$s'), [b.stringLiteral(this.value())]);
    },
    function description() {
      return ':' + this.value();
    }
  ],
});

$.readtable.standard().add($.symbol, ':');

$primitive.object_primitive.extend($.method.new({
  name: 'quote'.s,
  do: function() {
    return b.literal(this);
  },
}));

$primitive.array_primitive.extend($.method.new({
  name: 'quote'.s,
  do: function() {
    return b.arrayExpression(this.map(e => e.quote()));
  },
}))

$primitive.string_primitive.extend($.method.new({
  name: 'quote'.s,
  do: function() {
    return b.stringLiteral(this);
  },
}));

$.class.new({
  name: 'this'.s,
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
  name: 'cons'.s,
  components: [
    $.reader_macro,
    $.method.new({
      name: 'parse',
      static: true,
      do: function parse(reader) {
        reader.next(); // (
        reader.strip();

        const receiver = reader.read();
        const message = reader.read();
        const args = [];
        while (reader.peek() !== ')') {
          reader.strip();
          args.push(reader.read());
          reader.strip();
        }
        reader.next(); // )
        return this.new({ receiver, message, args });
      }
    }),
    $.var.new({ name: 'receiver'.s }),
    $.var.new({ name: 'message'.s }),
    $.var.new({ name: 'args'.s, default: [] }),
    function vau() {
      return this.receiver() === $.invoke.inst();
    },
    function print() {
      return `(${this.receiver().print()} ${this.message().print()} ${this.args().map(c => c.print()).join(' ')})`;
    },
    function estree() {
      return b.callExpression(b.memberExpression(this.receiver().estree(), b.identifier(this.message())), this.args().map(a => a.estree()));
    },
    function expand() {
      if (this.vau()) {
        $.debug.log('INVOKE!!', this.message());
        // find macro
        const m = _.macro(this.message());
        // apply macro
        return m.expand()(...this.args());
      } else {
        $.debug.log(this.receiver());
        return $.cons.new({
          receiver: this.receiver().expand(),
          message: this.message(),
          args: this.args().map(a => a.expand()),
        });
      }
    }
  ],
});
$.readtable.standard().add($.cons, '(');

$.class.new({
  name: 'property'.s,
  components: [
    $.var.new({ name: 'name'.s }),
    $.var.new({ name: 'value'.s }),
    function print() {
      return `${this.name().print()} ${this.value().print()}`;
    },
    function estree() {
      return b.property('init', this.name().estree(), this.value().estree());
    }
  ],
})

$.class.new({
  name: 'map'.s,
  components: [
    $.reader_macro,
    $.var.new({ name: 'properties'.s }),
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
      return `{ ${this.properties().map(prop => prop.print()).join('\n')}}`;
    },
    function estree() {
      return b.objectExpression(this.properties().map(p => p.estree()))
    }
  ],
});
$.readtable.standard().add($.map, '{');

$.class.new({
  name: 'quote'.s,
  components: [
    $.reader_macro,
    $.var.new({ name: 'value'.s }),
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
    function macroexpand() {
      return this.value().quote();
    },
    function estree() {
      return this.value().quote();
    }
  ],
});
$.readtable.standard().add($.quote, '\'');

$.class.new({
  name: 'invoke'.s,
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
      return b.identifier('__macros');
    }
  ],
});
$.readtable.standard().add($.invoke, '$');

$.class.new({
  name: 'ref-reader-macro'.s,
  components: [
    $.reader_macro,
    $.var.new({ name: 'symbol'.s }),
    $.method.new({
      name: 'parse',
      static: true,
      do: function parse(reader) {
        reader.next(); // %
        return this.new({ symbol: reader.read() })
      }
    }),
    function print() {
      $.debug.log('ref-m print', this);
      return `${this.char()}${this.symbol().print()}`;
    },
  ],
})

$.class.new({
  name: 'argref'.s,
  components: [
    $.ref_reader_macro,
    $.var.new({ name: 'char', default: '%' }),
    function estree() {
      return b.identifier(`_${this.symbol()}`);
    },
  ],
});
$.readtable.standard().add($.argref, '%');

$.class.new({
  name: 'classref'.s,
  components: [
    $.ref_reader_macro,
    $.var.new({ name: 'char', default: '~' }),
    function estree() {
      return b.memberExpression(b.identifier('$'), b.identifier(`${this.symbol()}`));
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
  name: 'macro'.s,
  components: [
    $.var.new({ name: 'name'.s }),
  ],
})

$.class.new({
  name: 'lambda'.s,
  components: [
    $.macro,
    $.var.new({ name: 'args'.s }),
    $.var.new({ name: 'body'.s }),
    function estree() {
      $.debug.log(this.args());
      return b.arrowFunctionExpression(this.args().map(a => b.identifier(a)), this.body().estree());
    }
  ],
});

$.class.new({
  name: 'do'.s,
  components: [
    $.macro,
    function expand(body) {
      $.debug.log('do expand');
      return $.lambda.new({
        args: ['it'],
        body,
      })
    },
  ]
});

$.class.new({
  name: 'program'.s,
  components: [
    $.var.new({ name: 'forms'.s }),
    function print() {
      return this.forms().map(f => f.print()).join('\n');
    },
    function estree() {
      return b.program(this.forms().map(f => b.expressionStatement(f.estree())));
    },
    function expand() {
      return $.program.new({ forms: this.forms().map(f => f.expand()) });
    }
  ],
});

$.class.new({
  name: 'identifier'.s,
  components: [
    $.var.new({ name: 'value'.s }),
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
})

$.class.new({
  name: 'reader'.s,
  doc: 'read source into forms',
  components: [
    $.var.new({ name: 'stream'.s }),
    $.var.new({ name: 'readtable'.s, default: $.readtable.standard() }),
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
    function advance(n) {
      if (!this[n]()) {
        throw new Error(`expected ${n} at ${this.peek()}`);
      }
      return this.next();
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
    function car() {
      const s = this.read();
      this.next();
      const m = this.symbol();
      return $.car.new({ receiver: s, message: m });
    },
    function read() {
      this.strip();
      if (this.readtable().has_char(this.peek())) {
        try {
          return this.readtable().get(this.peek()).parse(this);
        } catch (e) {
          $.debug.log(this.peek(), this.readtable().get(this.peek()));
          throw e;
        }
      } else {
        $.debug.log('not in readtable:', this.peek());
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
        $.debug.log('read', p);
        if (p) {
          ps.push(p);
        }
      }
      return $.program.new({ forms: ps });
    }
  ],
});

$.class.new({
  name: 'macroenv'.s,
  components: [
    $.var.new({ name: 'macros'.s }),
    function expand(cons) {

    }
  ],
});

const ex = `(%l map ($ do (. add (42 pow 2))))
(~class new {
  name :point
  slots {x (~var new) y (~var new)}
})`
const program = $.reader.new({ stream: $.stream.new({ value: ex })}).program();
$.debug.log(program.print());
$.debug.log('expand', program.expand().print());
$.debug.log(prettyPrint(program.expand().estree()).code);
