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
import { prettyPrint, types } from 'recast';
const b = types.builders;
const __ = globalThis.SIMULABRA;
const _ = __.mod('lisp2');
const $ = _.class_proxy();

$.class.new({
  name: $s('stream'),
  slots: {
    pos: $.var.default(0),
    value: $.var.new(),
    next: $.method.new({
      do() {
        if (this.pos() < this.value().length) {
          const res = this.value()[this.pos()];
          this._pos++;
          return res;
        }
        return null;
      }
    }),
    peek: $.method.new({
      do() {
        if (this.pos() < this.value().length) {
          return this.value()[this.pos()];
        }
        return null;
      }
    }),
    ended: $.method.new({
      do() {
        return this.pos() >= this.value().length;
      }
    }),
  }
});

$.class.new({
  name: $s('readtable'),
  static: {
    standard: $.var.new(),
  },
  slots: {
    table: $.var.default({}),
    add(macro) {
      // $.debug.log(`rt add ${macro.char()} ${macro.name()}`);
      this.table()[macro.char()] = macro;
    },
    get(char) {
      // $.debug.log(`rt get ${char} ${this.table()[char]}`);
      return this.table()[char];
    },
    has_char(char) {
      // $.debug.log(char)
      if (char in this.table()) {
        // $.debug.log(this.table()[char]);
        return true;
      }
      return false;
    },
  }
});

$.readtable.standard($.readtable.new());

$.class.new({
  name: $s('reader-macro'),
  slots: {
    quote() {
      return b.callExpression(b.memberExpression(b.identifier('$' + this.class().name()), b.identifier('new')), [b.objectExpression(
        this.vars().map(v => {
          return b.property('init', b.identifier(v.v().name()), v.state().quote());
        })
      )])
    },
    expand() {
      return this;
    },
    char() {
      return this.class().char();
    }
  }
})

$.class.new({
  name: $s('reader-macro-class'),
  super: $.class,
  default_superclass: $.reader_macro,
  components: [

  ],
  slots: {
    char: $.var.new(),
    init: $.after.new({
      do() {
        this.default_superclass($.reader_macro);
        $.debug.log('add to readtable', this, this.char(), this.super(), this.default_superclass());
        $.readtable.standard().add(this);
      }
    })
  }
});

$.reader_macro_class.new({
  name: $s('symbol'),
  char: ':',
  super: $.reader_macro,
  static: {
    of(value) {
      return this.new({ value });
    },
    parse(reader) {
      reader.next(); // :
      return this.new({ value: reader.symbol() });
    },
  },
  slots: {
    value: $.var.new(),
    print() {
      return this.value();
    },
    estree() {
      return b.callExpression(b.identifier('$s'), [b.stringLiteral(this.value())]);
    },
    description() {
      return ':' + this.value();
    }
  }
});

$.debug.log('symbol super', _.classes()['_symbol'], $.symbol, $.reader_macro_class.default_superclass())

$.primitive.for_type('object').extend($.method.new({
  name: $s('quote'),
  do() {
    return b.literal(this);
  }
}));

$.primitive.for_type('array').extend($.method.new({
  name: $s('quote'),
  do() {
    return b.arrayExpression(this.map(e => e.quote()));
  },
}))

$.primitive.for_type('string').extend($.method.new({
  name: $s('quote'),
  do() {
    return b.stringLiteral(this);
  }
}));

$.reader_macro_class.new({
  name: $s('this'),
  char: '.',
  static: {
    parse(reader) {
      reader.next();
      return this.new();
    }
  },
  slots: {
    print() {
      return '.';
    },
    estree() {
      return b.thisExpression();
    },
    quote() {
      return b.identifier('$' + this.class().name());
    }
  }
});

$.reader_macro_class.new({
  name: $s('cons'),
  char: '(',
  super: $.reader_macro,
  static: {
    parse(reader) {
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
  },
  slots: {
    receiver: $.var.new(),
    message: $.var.new(),
    args: $.var.default([]),
    vau() {
      return this.receiver() === $.invoke.inst();
    },
    print() {
      return `(${this.receiver().print()} ${this.message().print()} ${this.args().map(c => c.print()).join(' ')})`;
    },
    estree() {
      return b.callExpression(b.memberExpression(this.receiver().estree(), b.identifier(this.message())), this.args().map(a => a.estree()));
    },
    quote() {
      return this.supercall('quote');
    },
    expand() {
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
  },
});

$.class.new({
  name: $s('property'),
  slots: {
    name: $.var.new(),
    value: $.var.new(),
    print() {
      return `${this.name().print()} ${this.value().print()}`;
    },
    estree() {
      return b.property('init', this.name().estree(), this.value().estree());
    }
  }
})

$.reader_macro_class.new({
  name: $s('map'),
  char: '{',
  super: $.reader_macro,
  static: {
    parse(reader) {
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
  },
  slots: {
    properties: $.var.new(),
    print() {
      return `{ ${this.properties().map(prop => prop.print()).join('\n')}}`;
    },
    estree() {
      return b.objectExpression(this.properties().map(p => p.estree()))
    }
  }
})

$.reader_macro_class.new({
  name: $s('quote'),
  super: $.reader_macro,
  char: '\'',
  static: {
    parse(reader) {
      reader.next(); // '
      return this.new({
        value: reader.read(),
      });
    },
  },
  slots: {
    value: $.var.new(),
    print() {
      return `'${this.value().print()}`;
    },
    macroexpand() {
      return this.value().quote();
    },
    estree() {
      return this.value().quote();
    }
  }
});

$.reader_macro_class.new({
  name: $s('invoke'),
  char: '$',
  static: {
    inst() {
      if (!this._inst) {
        this._inst = this.new();
      }
      return this._inst;
    },
    parse(reader) {
      reader.next();
      return this.inst();
    }
  },
  slots: {
    print() {
      return '$';
    },
    estree() {
      return b.identifier('__macros');
    }
  }
});

$.class.new({
  name: $s('ref-reader-macro'),
  super: $.reader_macro,
  static: {
    parse(reader) {
      reader.next(); // %
      return this.new({ symbol: reader.read() })
    }
  },
  slots: {
    symbol: $.var.new(),
    print() {
      $.debug.log('ref-m print', this);
      return `${this.char()}${this.symbol().print()}`;
    },
  }
})

$.reader_macro_class.new({
  name: $s('argref'),
  super: $.ref_reader_macro,
  char: '%',
  slots: {
    estree() {
      return b.identifier(`_${this.symbol()}`);
    },
  }
});

$.reader_macro_class.new({
  name: $s('classref'),
  super: $.ref_reader_macro,
  char: '~',
  slots: {
    estree() {
      return b.memberExpression(b.identifier('$'), b.identifier(`${this.symbol()}`));
    },
  }
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
  name: $s('macro'),
  slots: {
    name: $.var.new(),
  }
})

$.class.new({
  name: $s('macro-class'),
  super: $.class,
  slots: {
    super: $.var.default($.macro),
    init: $.after.new({
      do() {
        _.defmacro(this);
      }
    }),
  }
})

$.macro_class.new({
  name: $s('lambda'),
  super: $.macro,
  slots: {
    args: $.var.new(),
    body: $.var.new(),
    estree() {
      $.debug.log(this.args());
      return b.arrowFunctionExpression(this.args().map(a => b.identifier(a)), this.body().estree());
    }
  }
});

$.macro_class.new({
  name: $s('do'),
  super: $.macro,
  expand(body) {
    $.debug.log('do expand');
    return $.lambda.new({
      args: ['it'],
      body,
    })
  }
});

$.class.new({
  name: $s('program'),
  slots: {
    forms: $.var.new(),
    print() {
      return this.forms().map(f => f.print()).join('\n');
    },
    estree() {
      return b.program(this.forms().map(f => b.expressionStatement(f.estree())));
    },
    expand() {
      return $.program.new({ forms: this.forms().map(f => f.expand()) });
    }
  }
})

$.class.new({
  name: $s('reader'),
  doc: 'read source into forms',
  slots: {
    stream: $.var.new(),
    readtable: $.var.default($.readtable.standard()),
    peek() {
      return this.stream().peek();
    },
    next() {
      return this.stream().next();
    },
    in(chars) {
      return chars.includes(this.peek());
    },
    test(re) {
      return re.test(this.peek());
    },
    advance(n) {
      if (!this[n]()) {
        throw new Error(`expected ${n} at ${this.peek()}`);
      }
      return this.next();
    },
    whitespace() {
      return this.in(' \n');
    },
    alpha() {
      return this.test(/[A-Za-z]/);
    },
    digit() {
      return this.test(/[0-9]/);
    },
    delimiter() {
      return this.in('(){}[]');
    },
    term() {
      return this.delimiter() || this.whitespace();
    },
    number() {
      let n = '';
      while (this.digit() || this.peek() === '.') {
        n += this.next();
      }
      return new Number(n);
    },
    symbol() {
      let s = '';
      while (!this.term()) {
        s += this.next();
      }
      return s;
    },
    strip() {
      while (this.whitespace()) {
        this.stream().next();
      }
    },
    car() {
      const s = this.read();
      this.next();
      const m = this.symbol();
      return $.car.new({ receiver: s, message: m });
    },
    read() {
      this.strip();
      if (this.readtable().has_char(this.peek())) {
        return this.readtable().get(this.peek()).parse(this);
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
    program() {
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
  }
});

$.class.new({
  name: $s('macroenv'),
  slots: {
    macros: $.var.new(),
    expand(cons) {

    }
  }
});

const ex = `(%l map ($ do (. add (42 pow 2))))
(~class new { name :point slots { x (~var new) y (~var new) } })`
const program = $.reader.new({ stream: $.stream.new({ value: ex })}).program();
$.debug.log(program.print());
$.debug.log('expand', program.expand().print());
$.debug.log(prettyPrint(program.expand().estree()).code);
