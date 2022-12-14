// now, what if it were a lisp machine?
import { debug, Class, Var, Method } from './base.js';

const ex = `
$(def ~Class(new {
  name["Point"]
  slots[{
    x[~Var(new { default[0] })]
    y[~Var(new { default[0] })]
    dist[~Method(new {
      args[{ other[{ type[!Point] }] }]
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
        if ('(){}[]>~$!.% \n\t'.includes(c)) {
          return this.toks().push(c);
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
        throw new Error('UNHANDLED TOKEN CHAR: ', c);
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

export const JSLiteral = Class.new({
  name: 'JSLiteral',
  slots: {
    value: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        return JSON.stringify(this.value());
      }
    })
  }
})
export const StringLiteral = Class.new({
  name: 'StringLiteral',
  super: JSLiteral,
});

export const NumberLiteral = Class.new({
  name: 'NumberLiteral',
  super: JSLiteral,
});

export const Sexp = Class.new({
  name: 'Sexp',
  slots: {
    value: Var.default([]),
    car: Method.new({
      do: function car() {
        return this.value()[0];
      }
    }),
    cdr: Method.new({
      do: function cdr() {
        return this.value().slice(1);
      }
    }),
    js: Method.new({
      do: function js(ctx) {
        return `${this.car()}(${this.cdr().map(a => a.js(ctx)).join(', ')})`;
      }
    })
  }
});

export const MacroEnv = Class.new({
  name: 'MacroEnv',
  slots: {
    macros: Var.default({}),
    add: Method.new({
      do: function add(macro) {
        this.macros()[macro.name()] = macro;
      }
    }),
    eval: Method.new({
      do: function evalFn(sexp) {
        const m = this.macros()[sexp.car()];
        if (m) {
          return m.fn().apply(this, sexp.cdr())
        } else {
          throw new Error(`Invalid macro: ${sexp.car()}`)
        }
      }
    }),
  }
});

export const Macro = Class.new({
  name: 'Macro',
  slots: {
    name: Var.new(),
    fn: Var.new(),
  }
});

export const MacroCall = Class.new({
  name: 'MacroCall',
  slots: {
    sexp: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        return ctx.eval(this.sexp());
      }
    }),
  }
});

export const Call = Class.new({
  name: 'Call',
  slots: {
    receiver: Var.new(),
    sexp: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        return `${this.receiver().js(ctx)}.${this.sexp().js(ctx)}`;
      }
    })
  }
});

export const ErrorTok = Class.new({
  name: 'ErrorTok',
  slots: {
    init() {
      this.error(new Error(`Could not compile: '${this.tok()}': ${this.message()}`));
    },
    tok: Var.new(),
    message: Var.default('errortok'),
    error: Var.new(),
    js() {
      throw this.error();
    }
  }
});

export const ClassRef = Class.new({
  name: 'ClassRef',
  slots: {
    name: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        return this.name();
      }
    }),
  }
});

export const TypeRef = Class.new({
  name: 'TypeRef',
  slots: {
    name: Var.new(),
    js: Method.new({
      do: function js() {
        return '$' + this.name();
      }
    })
  }
});

export const ArgRef = Class.new({
  name: 'ArgRef',
  slots: {
    name: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        return this.name();
      }
    }),
  }
});

export const ThisRef = Class.new({
  name: 'ThisRef',
  slots: {
    js: Method.new({
      do: function js(ctx) {
        return 'this';
      }
    }),
  }
});

export const Pair = Class.new({
  name: 'Pair',
  slots: {
    name: Var.new(),
    value: Var.new(),
  }
});

export const Dexp = Class.new({
  name: 'Dexp', // lmao?
  slots: {
    pairs: Var.default([]),
    map: Var.new(),
    init() {
      let m = {};
      for (const p of this.pairs()) {
        m[p.name()] = p.value();
      }
      this.map(m);
    },
    js: Method.new({
      do: function js(ctx) {
        return `{ ${this.pairs().map(p => `${p.name()}: ${p.value().js(ctx)}`).join(', ')} }`;
      }
    }),
  },
});

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
      this.assert(this.advance(), tok);
    },
    assert(l, r) {
      if (l !== r) {
        throw new Error(`assertion failed: ${l} !== ${r}`);
      }
    },
    stripws(set = ' \n\t') {
      while (set.includes(this.cur())) {
        this.advance();
      }
    },
    sexp() {
      this.assertAdvance('(');
      const value = [this.advance()];
      this.stripws();
      while (this.cur() !== ')') {
        value.push(this.form());
        this.stripws();
      }
      this.assertAdvance(')');
      return Sexp.new({ value });
    },
    macro() {
      this.assertAdvance('$');
      return MacroCall.new({ sexp: this.sexp() });
    },
    classRef() {
      this.assertAdvance('~');
      return ClassRef.new({ name: this.nameLiteral() });
    },
    typeRef() {
      this.assertAdvance('!');
      return TypeRef.new({ name: this.nameLiteral() });
    },
    argRef() {
      this.assertAdvance('%');
      return ArgRef.new({ name: this.nameLiteral() });
    },
    thisRef() {
      this.assertAdvance('.');
      return ThisRef.new();
    },
    nameLiteral() {
      this.assert(/^[A-Za-z][A-Za-z\-\d]*$/.test(this.cur()), true);
      return this.advance();
    },
    string() {
      const s = this.advance();
      this.assert(s[0], '"');
      this.assert(s[s.length - 1], '"');
      return StringLiteral.new({ value: s.slice(1, s.length - 1) });
    },
    number() {
      const n = this.advance();
      this.assert(typeof n, 'number');
      return NumberLiteral.new({ value: n });
    },
    pair() {
      const name = this.nameLiteral();
      this.assertAdvance('[');
      const value = this.form();
      this.assertAdvance(']');

      return Pair.new({ name, value })
    },
    pmap() {
      this.assertAdvance('{');
      this.stripws();
      const pairs = [];
      while (this.cur() !== '}') {
        pairs.push(this.pair());
        this.stripws();
      }
      this.assertAdvance('}');
      return Dexp.new({
        pairs
      });
    },
    symbol() {
      let tt = this.cur();
      switch (tt) {
        case '~': return this.classRef();
        case '!': return this.typeRef();
        case '%': return this.argRef();
        case '.': return this.thisRef();
        default: return ErrorTok.new({ tok: tt, message: 'Not a valid symbol sigil' });
      }
    },
    symbolExpression() {
      let exp = this.symbol();
      while (this.cur() === '(') {
        exp = Call.new({ receiver: exp, sexp: this.sexp() });
      }
      return exp;
    },
    form() {
      let tok = this.cur();
      if (typeof tok === 'number') {
        return this.number();
      }
      if ('~!%.'.includes(tok)) {
        return this.symbolExpression();
      }
      if (tok === '$') {
        return this.macro();
      }
      if (tok === '{') {
        return this.pmap();
      }
      if (' \n\t'.includes(tok)) {
        this.advance();
        return this.form();
      }
      if (tok[0] === '"') {
        return this.string();
      }
      return ErrorTok.new({ tok, message: 'No matching parse form' })    },
  }
})

const l = Lexer.new({ code: ex });
l.tokenize();
const p = Parser.new({ toks: l.toks() });
const ctx = MacroEnv.new();

ctx.add(Macro.new({
  name: 'def',
  fn: function(obj) {
    const name = obj.sexp().cdr()[0].map().name.value();
    return `export const ${name} = ${obj.js(this)}`;
  }
}));

ctx.add(Macro.new({
  name: 'fn',
  fn: function(obj) {
    return `function () { ${obj.js(this)} }`;
  }
}))

console.log(p.form().js(ctx));
