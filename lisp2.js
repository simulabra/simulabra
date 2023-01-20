/*
 * probably let's just burn it all
 * start afresh with syntax
 * make it lispier?
 *
 * symbol .this-msg ~class-name !type-name %arg-name ^return :symbol $macro-name |pipe-name
 * (.msg-name %x %y) ($macro-name s (.frob))
 * (%arg/msg .) (~debug/log "testing") (.x |+ 5 |sqrt)
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
  slots: {
    value: $var.new(),
  }
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
})

export const $tokenizer = $class.new({
  name: 'tokenizer',
  doc: 'reads source code into tokens',
  static: {
    stream(stream) {
      return this.new({
        stream
      });
    }
  },
  slots: {
    init() {
      this.tokenize();
    },
    code: $var.new(),
    pos: $var.default(0),
    stream: $var.new(),
    toks: $var.default([]),
    terminal() {
      return this.stream().ended() || '(){}[]. \n'.includes(this.stream().peek()());
    },
    toksToTerminal() {
      let cs = [];
      while (!this.terminal()) {
        cs.push(this.stream().next());
      }
      return cs;
    },
    readToTerminal(c) {
      return [c, ...this.toksToTerminal()].join('');
    },
    readString(delim) {
      let s = '';
      while (this.stream().peek() !== delim) {
        if (this.stream().ended()) {
          throw new Error('Read string EOF ' + delim + s);
        }
        s += this.stream().next();
        if (this.stream().peek() === delim && s[s.length - 1] === '\\') {
          s += this.stream().next(); // escape
        }
      }
      this.stream().next(); // last delim
      return s;
    },
    token() {
      const c = this.stream().next();
      if (c === ';') {
        while (this.stream().next() !== '\n') { }
        return this.token();
      }
      if ('(){}[]>~@$!.%#|:^=`, \n\t'.includes(c)) {
        return this.toks().push(c);
      }
      if (/[A-Za-z]/.test(c)) {
        return this.toks().push($symbol.new({ value: this.readToTerminal(c) }));
      }
      if ('"'.includes(c)) {
        return this.toks().push(this.readString(c));
      }
      if (/[0-9\-\+]/.test(c)) {
        return this.toks().push(Number.parseFloat(this.readToTerminal(c)));
      }

      throw new Error('UNHANDLED TOKEN CHAR: ' + c);
    },
    tokenize() {
      while (this.pos() < this.code().length) {
        this.token();
      }
      return this.toks();
    }
  }
});

export const $reader = $class.new({
  name: 'reader',
  doc: 'read source into forms',
  slots: {
    toks: $var.new(),
    read(stream) {
      let tkn = $tokenizer.stream(stream);
      const toks = tkn.tokenize();
    }
  }
})
