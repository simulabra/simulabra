// now, what if it were a lisp machine?
import { debug, Class, Var, Method } from './base.js';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'fs';

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
        if ('(){}[]>~@$!.% \n\t'.includes(c)) {
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
});

export const StringLiteral = Class.new({
  name: 'StringLiteral',
  super: JSLiteral,
  static: {
    parse(parser) {
      const s = parser.advance();
      parser.assert(s[0], '"');
      parser.assert(s[s.length - 1], '"');
      return this.new({ value: s.slice(1, s.length - 1) });
    }
  },
});

export const NumberLiteral = Class.new({
  name: 'NumberLiteral',
  super: JSLiteral,
  static: {
    parse(ctx) {
      const n = ctx.advance();
      ctx.assert(typeof n, 'number');
      return NumberLiteral.new({ value: n });
    },
  },
});

export const Sexp = Class.new({
  name: 'Sexp',
  static: {
    parse(ctx) {
      ctx.assertAdvance('(');
      const value = [];
      ctx.stripws();
      while (ctx.cur() !== ')') {
        value.push(ctx.form());
        ctx.stripws();
      }
      ctx.assertAdvance(')');
      return this.new({ value });
    }
  },
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
    }),
    jsList() {
      return `${this.value().map(e => e.js()).join(', ')}`;
    }
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
    package(name) {
      
    },
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
  static: {
    parse(ctx) {
      ctx.assertAdvance('$');
      return MacroCall.new({ sexp: Sexp.parse(ctx) });
    },
  },
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
  static: {
    parse(ctx) {
      ctx.assertAdvance('~');
      return ClassRef.new({ name: ctx.nameLiteral() });
    },
  },
  slots: {
    name: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        return `${this.name()}`;
      }
    }),
  }
});

export const TypeRef = Class.new({
  name: 'TypeRef',
  static: {
    parse(ctx) {
      ctx.assertAdvance('!');
      return this.new({ name: ctx.nameLiteral() });
    },
  },
  slots: {
    name: Var.new(),
    js: Method.new({
      do: function js() {
        return `${this.name()}`;
      }
    })
  }
});

export const ArgRef = Class.new({
  name: 'ArgRef',
  static: {
    parse(ctx) {
      ctx.assertAdvance('%');
      return this.new({ name: ctx.nameLiteral() });
    },
  },
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
  static: {
    parse(ctx) {
      ctx.assertAdvance('.');
      return this.new();
    },
  },
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
  static: {
    parse(ctx) {
      const name = ctx.nameLiteral();
      ctx.assertAdvance('[');
      const value = ctx.form();
      ctx.assertAdvance(']');

      return Pair.new({ name, value })
    },
  },
  slots: {
    name: Var.new(),
    value: Var.new(),
  }
});

export const Dexp = Class.new({
  name: 'Dexp', // lmao?
  static: {
    parse(ctx) {
      ctx.assertAdvance('{');
      ctx.stripws();
      const pairs = [];
      while (ctx.cur() !== '}') {
        pairs.push(Pair.parse(ctx));
        ctx.stripws();
      }
      ctx.assertAdvance('}');
      return Dexp.new({
        pairs
      });
    },
  },
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

export const Body = Class.new({
  name: 'Body',
  static: {
    parse(ctx) {
      ctx.assertAdvance('@');
      const s = Sexp.parse(ctx);
      debug(s.value());
      return Body.new({ statements: s.value() });
    },
  },
  slots: {
    statements: Var.new(),
    js(ctx) {
      return this.statements().map((s, idx) => (idx === this.statements().length - 1 ? 'return ' : '') + s.js(ctx) + ';').join('');
    }
  }
});

export const Program = Class.new({
  name: 'Program',
  static: {
    parse(ctx) {
      const statements = [];
      let f;
      while ((f = ctx.form()) !== null) {
        statements.push(f);
      }
      return Program.new({ statements })
    }
  },
  slots: {
    statements: Var.new(),
    js(ctx) {
      return this.statements().map(s => s.js(ctx)).join(';');
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
    ended() {
      return this.pos() >= this.toks().length;
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
    nameLiteral() {
      this.assert(/^[A-Za-z][A-Za-z\-\d]*$/.test(this.cur()), true);
      return this.advance();
    },
    form() {
      if (this.ended()) {
        return null;
      }
      let tok = this.cur();
      if (typeof tok === 'number') {
        return NumberLiteral.parse(this);
      }
      const tokamap = {
        '~': ClassRef,
        '!': TypeRef,
        '%': ArgRef,
        '.': ThisRef,
        '$': MacroCall,
        '@': Body,
        '{': Dexp,
        '(': Sexp,
      };
      let exp = tokamap[tok]?.parse(this);
      if (exp) {
        while (this.cur() === '(') {
          exp = Call.new({ receiver: exp, sexp: Sexp.parse(this) });
        }
        return exp;
      }
      if (' \n\t'.includes(tok)) {
        this.advance();
        return this.form();
      }
      if (tok[0] === '"') {
        return StringLiteral.parse(this);
      }
      if (/[A-Za-z]/.test(tok[0])) {
        return this.nameLiteral();
      }
      throw new Error('No matching parse form for ' + tok);
    },
  }
})

const ctx = MacroEnv.new();

ctx.add(Macro.new({
  name: 'defclass',
  fn: function(name, obj) {
    obj.sexp().cdr()[0].map().name = StringLiteral.new({ value: name });
    return `export var ${name} = ${obj.js(this)}`;
  }
}));

ctx.add(Macro.new({
  name: 'fn',
  fn: function(args, obj) {
    return `function (${args.jsList()}) { ${obj.js(this)} }`;
  }
}));

ctx.add(Macro.new({
  name: 'std',
  fn: function(args, obj) {
    return `import { Class, Var, Method } from '../base.js'`;
  }
}));
const ex = `
$(std)

$(defclass Point ~Class(new {
  slots[{
    x[~Var(new { default[0] })]
    y[~Var(new { default[0] })]
    dist[~Method(new {
      args[{ other[{ type[!Point] }] }]
      do[$(fn (other) @(
        .(x)(sub %other(x))(pow 2)(add .(y)(sub %other(y))(pow 2))(sqrt)
      ))]
    })]
  }]
}))
`;

export const SourceModule = Class.new({
  name: 'SourceModule',
  slots: {
    name: Var.new(),
    imports: Var.new(),
    classes: Var.new(),
  },
});

export const Compiler = Class.new({
  name: 'Compiler',
  slots: {
    init() {
      rmSync('./out', { recursive: true, force: true });
      mkdirSync('./out');
    },
    load(code) {
      const l = Lexer.new({ code });
      l.tokenize();
      const p = Parser.new({ toks: l.toks() });
      const js = Program.parse(p).js(ctx);
      console.log(js);
      writeFileSync('./out/test.mjs', js);
    }
  }
});

const compiler = Compiler.new();
compiler.load(ex);

const test = await import('./out/test.mjs');
debug(test.Point.new({ x: 3, y: 4 }).dist(test.Point.new()));
