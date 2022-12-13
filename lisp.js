// now, what if it were a lisp machine?
import { Class, Var, Method } from './base.js';

const ex = `
$(def ~class(new {
  name["point"]
  slots[{
    x[~var(new { default[0] })]
    y[~var(new { default[0] })]
    dist[~method(new {
      args[{ other[{ type[!point] }] }]
      do[$(fn
        .(x)(sub %other(x))(pow 2)(add .(y)(sub %other(y))(pow 2))(sqrt)
      )]
    })]
  }]
}))
`;

export const Lexer = Class.new({
  name: 'Lexer',
  slots: {
    code: Var.new(),
    pos: Var.default(0),
    toks: Var.default([]),
    cur: Method.new({
      do: function cur() {
        return this.code()[this.pos()];
      }
    }),
    chomp: Method.new({
      do: function chomp() {
        const c = this.cur();
        this.pos(this.pos() + 1);
        return c;
      }
    }),
    ended: Method.new({
      do: function ended() {
        return this.pos() >= this.code().length;
      }
    }),
    terminal: Method.new({
      do: function terminal() {
        return this.ended() || '(){}[]. \n'.includes(this.cur());
      }
    }),
    toksToTerminal() {
      let cs = [];
      while (!this.terminal()) {
        cs.push(this.chomp());
      }
      return cs;
    },
    readToTerminal: Method.new({
      do: function readToTerminal(c) {
        return [c, ...this.toksToTerminal()].join('');
      }
    }),
    readString(delim) {
      let s = delim;
      while (this.cur() !== delim) {
        if (this.ended()) {
          throw new Error('Read string EOF ' + delim + s);
        }
        s += this.chomp();
        if (this.cur() === delim && s[s.length - 1] === '\\') {
          s += this.chomp(); // escape
        }
      }
      s += this.chomp(); // last delim
      return s;
    },
    token: Method.new({
      do: function token() {
        const c = this.chomp();
        if ('(){}[]>~$!.%'.includes(c)) {
          return this.toks().push(c);
        }
        if (' \n\t'.includes(c)) {
          return;
        }
        if (/[A-Za-z]/.test(c)) {
          return this.toks().push(this.readToTerminal(c));
        }
        if ('"`'.includes(c)) {
          return this.toks().push(this.readString(c));
        }
        if (/[0-9\-\+]/.test(c)) {
          return this.toks().push(Number.parseFloat(this.readToTerminal(c)));
        }
        this.toks().push('UHOH: ' + c);
        console.log('UNHANDLED: ', c);
      }
    }),
    tokenize: Method.new({
      do: function tokenize() {
        while (this.pos() < this.code().length) {
          this.token();
        }
      }
    })
  }
});

/*
 * Node classes
 * Call
 * Map
 * String
 * Macro
 * Class
 * Interface
 * Number
 * This
 * Arg
 * Boolean
 * List
 * Sexp
 */

export const Sexp = Class.new({
  name: 'Sexp',
  slots: {
    message: Var.new(),
    args: Var.new(),
  }
});

export const MacroCall = Class.new({
  name: 'MacroCall',
  slots: {
    sexp: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        return `$macro_${this.sexp().message()}(${this.sexp().args().map(a => a.js()).join(', ')})}`
      }
    })
  }
});

export const ErrorTok = Class.new({
  name: 'ErrorTok',
  slots: {
    tok: Var.new(),
    message: Var.default('errortok'),
    js() {
      throw new Error(`Could not compile: '${this.tok()}': ${this.message()}`)
    }
  }
})

export const Parser = Class.new({
  name: 'Parser',
  slots: {
    toks: Var.new(),
    pos: Var.default(0),
    cur() {
      return this.toks()[this.pos()];
    },
    advance() {
      const n = this.cur();
      this.pos(this.pos() + 1);
      return n;
    },
    assertAdvance(tok) {
      const n = this.advance();
      if (n !== tok) {
        throw new Error(`Assert parse error: expected ${tok}, got ${n}`);
      }
      return n;
    },
    sexp() {
      const message = this.advance();
      const args = [];
      while (this.cur() !== ')') {
        args.push(this.form());
      }
      return Sexp.new({
        message,
        args
      })
    },
    macro() {
      return MacroCall.new({ sexp: this.sexp() });
    },
    pmap() {

    },
    form() {
      let tok = this.advance();
      console.log(tok);
      if (tok === '$') {
        return this.macro();
      }
      if (tok === '{') {
        return this.pmap();
      }
      return ErrorTok.new({ tok, message: 'No matching parse form' })    },
  }
})

const l = Lexer.new({ code: ex });
l.tokenize();
const p = Parser.new({ toks: l.toks() });
console.log(p.form().js());
