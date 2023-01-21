/*
 * probably let's just burn it all
 * start afresh with syntax
 * make it lispier?
 *
 * symbol .this-msg ~class-name !type-name %arg-name ^return :symbol $macro-name |pipe-name
 * (./msg-name %x %y) ($/macro-name s (./frob))
 * (%arg/msg .) (~debug/log "testing") (./x |+ 5 |sqrt)
 * [2 4 6 8]
 * {name :something value (%x/* 42 |pow 3)}
 *
 * ($def ~class point {
 *   :slots {
 *     :x (~var/new)
 *     :y (~var/new)
 *     :dist ($fn [other] ^(.x |- (%other/x) |pow 2 |+ (.y |- (%other/y |pow 2)) |sqrt))
 *   }
 * })
 *
 * quasiquotes
 * "Backquote expressions are just a handy notation for writing complicated
 * combinations of calls to list constructors." (Bawden)
 * ($macro :cpt (%name))
 * `(.add {:,%name {:value (.,%name)}})
 * ($cpt :x) => (.add {:x {:value (.x)}})
 *
 * traits?
 * desires for the shape of something?
 *
 * ObjectLiteral
 * Literal
 */

import { $class, $var, $method, $virtual, $debug } from './base.js';
import { readFileSync, writeFileSync } from 'fs';
import { parse, print, prettyPrint, types } from 'recast';
const b = types.builders;

export const $symbol = $class.new({
  name: 'symbol',
  static: {
    of(value) {
      return this.new({ value });
    }
  },
  slots: {
    value: $var.new(),
    print() {
      return this.value();
    },
    estree() {
      return b.identifier(this.value());
    },
  }
});

export const $this = $class.new({
  name: 'this',
  slots: {
    print() {
      return '.';
    },
    estree() {
      return b.thisExpression();
    }
  }
});

export const $car = $class.new({
  name: 'car',
  slots: {
    receiver: $var.new(),
    message: $var.new(),
    print() {
      return this.receiver().print() + '/' + this.message().print();
    },
    estree() {
      return b.memberExpression(this.receiver().estree(), this.message().estree());
    }
  }
});

export const $cons = $class.new({
  name: 'cons',
  slots: {
    car: $var.new(),
    cdr: $var.default([]),
    print() {
      return `(${this.car().print()} ${this.cdr().map(c => c.print()).join(' ')})`;
    },
    estree() {
      return b.callExpression(this.car().estree(), this.cdr().map(c => c.estree()));
    }
  },
});

export const $stream = $class.new({
  name: 'stream',
  slots: {
    pos: $var.default(0),
    value: $var.new(),
    next: $method.new({
      do() {
        if (this.pos() < this.value().length) {
          const res = this.value()[this.pos()];
          this._pos++;
          return res;
        }
        return null;
      }
    }),
    peek: $method.new({
      do() {
        if (this.pos() < this.value().length) {
          return this.value()[this.pos()];
        }
        return null;
      }
    }),
    ended: $method.new({
      do() {
        return this.pos() >= this.value().length();
      }
    }),
  }
});

export const $readtable = $class.new({
  name: 'readtable',
  slots: {

  }
})

export const $reader = $class.new({
  name: 'reader',
  doc: 'read source into forms',
  slots: {
    stream: $var.new(),
    read_table: $var.default(() => {

    }),
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
    slash() {
      return this.in('/')
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
      if (s[0] === '$') {
        return $macro_symbol.of(s.slice(1));
      } else {
        return $symbol.of(s);
      }
    },
    strip() {
      while (this.whitespace()) {
        this.stream().next();
      }
    },
    car() {
      const s = this.read();
      this.advance('slash');
      const m = this.symbol();
      return $car.new({ receiver: s, message: m });
    },
    read() {
      this.strip();
      if (this.peek() === '-') {
        this.next();
        if (this.digit()) {
          return -this.number();
        } else {
          return $symbol.of('-');
        }
      }
      if (this.digit()) {
        return this.number();
      }
      if (this.peek() === '(') {
        this.next();
        this.strip();

        const car = this.car();
        let cdr = [];
        while (this.peek() !== ')') {
          this.strip();
          cdr.push(this.read());
          this.strip();
        }
        return $cons.new({ car, cdr });
      }
      if (this.peek() === '.') {
        this.next();
        return $this.new();
      }
      throw new Error(`unhandled: ${this.peek()}`);
    },
  }
});

const ex = `(./add (42/pow 2))`
const program = $reader.new({ stream: $stream.new({ value: ex })}).read();
$debug.log(program.print());
$debug.log(prettyPrint(program.estree()).code);
