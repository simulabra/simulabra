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
import { prettyPrint, types } from 'recast';
const b = types.builders;
const __ = globalThis.SIMULABRA;
const _ = __.mod('lisp2');
const $ = _.class_proxy();

$.class.new({
  name: 'stream',
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
        return this.pos() >= this.value().length();
      }
    }),
  }
});

$.class.new({
  name: 'readtable',
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
  name: 'reader-macro',
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
    }
  }
})

$.class.new({
  name: 'reader_macro_class',
  super: $.class,
  default_superclass: $.reader_macro,
  slots: {
    char: $.var.new(),
    init: $.after.new({
      do() {
        this.default_superclass($.reader_macro);
        $.debug.log('add to readtable', this, this.char(), this.super(), this.default_superclass());
        $.readtable.standard().add(this);
      }
    })
    // quote() {
    //   return b.identifier('$' + this.name());
    // },
    // macroexpand() {
    //   return this;
    // },
  }
});

$.reader_macro_class.new({
  name: 'symbol',
  char: ':',
  super: $.reader_macro,
  static: {
    of(value) {
      return this.new({ value });
    },
    parse(reader) {
      return reader.symbol();
    },
  },
  slots: {
    value: $.var.new(),
    print() {
      return this.value();
    },
    estree() {
      return b.identifier(this.value());
    },
  }
});

$.debug.log('symbol super', _.classes()['_symbol'], $.symbol, $.reader_macro_class.default_superclass())

$.primitive.for_type('object').extend($.method.new({
  name: 'quote',
  do() {
    return b.literal(this);
  }
}));

$.primitive.for_type('array').extend($.method.new({
  name: 'quote',
  do() {
    return b.arrayExpression(this.map(e => e.quote()));
  },
}))

$.primitive.for_type('string').extend($.method.new({
  name: 'quote',
  do() {
    return b.stringLiteral(this);
  }
}));

$.reader_macro_class.new({
  name: 'this',
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
  name: 'cons',
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
      if (this.vau()) {
        const mname = this.message();
        return b.callExpression(b.memberExpression(this.receiver().estree(), this.message().estree()), this.args().map(a => a.quote()));
      } else {
        return b.callExpression(b.memberExpression(this.receiver().estree(), this.message().estree()), this.args().map(a => a.estree()));
      }
    },
    quote() {
      return this.supercall('quote');
    },
    expand() {
      if (this.vau()) {
        $.debug.log('INVOKE!!')
        return;
      } else {
        $.debug.log(this.receiver());
        return $.cons.new({
          receiver: this.receiver().expand(),
          message: this.message().expand(),
          args: this.args().map(a => a.expand()),
        });
      }
    }
  },
});

$.reader_macro_class.new({
  name: 'quote',
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
  name: 'invoke',
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

$.reader_macro_class.new({
  name: 'argref',
  super: $.reader_macro,
  char: '%',
  static: {
    parse(reader) {
      reader.next(); // %
      return this.new({ symbol: reader.read() })
    }
  },
  slots: {
    symbol: $.var.new(),
    print() {
      return `%${this.symbol().print()}`;
    },
    estree() {
      return b.identifier(`_${this.symbol().value()}`);
    },
  }
});

$.class.new({
  name: 'macro',
  slots: {

  }
})

$.class.new({
  name: 'macro-class',
  slots: {
    super: $.var.default($.macro),
  }
})

$.lambda = $.class.new({
  name: 'lambda',
  slots: {
    args: $.var.new(),
    body: $.var.new(),
    estree() {
      return b.arrowFunctionExpression(this.args().map(a => a.estree()), this.body().estree());
    }
  }
})

$.class.new({
  name: 'do',
  super: $.macro,
  slots: {
    body: $.var.new(),
    expand(env) {
      return $.lambda.new({
        args: [$.symbol.of('it')],
        body: this.body(),
      });
    }
  }
})

$.class.new({
  name: 'reader',
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
      return $.symbol.of(s);
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
      if (this.peek() === '(') {
        this.next();
        this.strip();

        const car = this.car();
        const cdr = [];
        while (this.peek() !== ')') {
          this.strip();
          cdr.push(this.read());
          this.strip();
        }
        return $.cons.new({ car, cdr });
      }
      if (this.peek() === '.') {
        this.next();
        return $.this.new();
      }
      if (this.alpha()) {
        return this.symbol();
      }
      throw new Error(`unhandled: ${this.peek()}`);
    },
  }
});

$.class.new({
  name: 'macroenv',
  slots: {
    macros: $.var.new(),
    expand(cons) {

    }
  }
});

const ex = `(%l map ($ do (. add (42 pow 2))))`
const program = $.reader.new({ stream: $.stream.new({ value: ex })}).read();
$.debug.log(program.print());
$.debug.log('expand', program.expand());
$.debug.log(prettyPrint(program.expand().estree()).code);
