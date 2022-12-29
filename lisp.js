// now, what if it were a lisp machine?
import { Class, Var, Method, Debug, StringPrimitive } from './base.js';
import { readFileSync, writeFileSync } from 'fs';

export const Lexer = Class.new({
  name: 'Lexer',
  slots: {
    init() {
      this.tokenize();
    },
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
        if ('(){}[]>~@$!.%#|\' \n\t'.includes(c)) {
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

        throw new Error('UNHANDLED TOKEN CHAR: ' + c);
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

export const NameLiteral = Class.new({
  name: 'NameLiteral',
  super: JSLiteral,
  static: {
    parse(parser) {
      parser.assertAdvance('\'');
      const s = parser.nameString();
      return this.new({ value: s });
    }
  },
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
    parse(parser) {
      const n = parser.advance();
      parser.assert(typeof n, 'number');
      return NumberLiteral.new({ value: n });
    },
  },
});

export const List = Class.new({
  name: 'List',
  static: {
    parse(parser) {
      parser.assertAdvance('[');
      const value = [];
      parser.stripws();
      while (parser.cur() !== ']') {
        value.push(parser.form());
        parser.stripws();
      }
      parser.assertAdvance(']');
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
    js() {
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
    defmacro(name, fn) {
      this.add(Macro.new({
        name,
        fn
      }));
    },
    eval: Method.new({
      do: function evalFn(mcall) {
        const mname = mcall.selector();
        const m = this.macros()[mname];
        if (m) {
          return m.fn().apply(this, mcall.args())
        } else {
          throw new Error(`Invalid macro: ${mname}`)
        }
      }
    }),
  }
});

const ctx = MacroEnv.new({
  shouldDebug: true,
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
    parse(parser) {
      parser.assertAdvance('$');
    },
  },
  slots: {
    message: Var.new(),
    selector() {
      return this.message().parts()[0].selector();
    },
    args() {
      return this.message().parts()[0].args();
    },
    js: Method.new({
      do: function js(ctx) {
        try {
          return ctx.eval(this).js(ctx);
        } catch (e) {
          throw new Error(`macro error: ${this.selector()} :: ${e.toString()}`)
        }
      }
    }),
  }
});

export const MessagePart = Class.new({
  name: 'MessagePart',
  static: {
    parse(parser) {
      const selector = parser.nameString();
      const args = [];
      while (!'|)'.includes(parser.head())) {
        args.push(parser.form());
      }
      return this.new({
        selector,
        args
      });
    }
  },
  slots: {
    selector: Var.new(),
    args: Var.new(),
    js(ctx) {
      return `${this.selector()}(${this.args().map(a => a.js(ctx)).join(',')})`;
    },
  }
})

export const Message = Class.new({
  name: 'Message',
  static: {
    parse(parser) {
      parser.assertAdvance('(');
      let parts = [];
      do {
        parts.push(MessagePart.parse(parser));
        parser.maybeAdvance('|');
      } while (parser.head() !== ')');
      parser.assertAdvance(')');
      return this.new({
        parts
      });
    }
  },
  slots: {
    parts: Var.new(),
    js(ctx) {
      return this.parts().map(p => p.js(ctx)).join('.');
    },
  }
})

export const Call = Class.new({
  name: 'Call',
  slots: {
    receiver: Var.new(),
    message: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        return `${this.receiver().js(ctx)}.${this.message().js(ctx)}`;
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
    parse(parser) {
      parser.assertAdvance('~');
      return ClassRef.new({ name: parser.nameString() });
    },
  },
  slots: {
    name: Var.new(),
    js: Method.new({
      do: function js(ctx) {
        const n = this.name();
        return `$class_${this.name()}`;
      }
    }),
  }
});

export const TypeRef = Class.new({
  name: 'TypeRef',
  static: {
    parse(parser) {
      parser.assertAdvance('!');
      return this.new({ name: parser.nameString() });
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
    parse(parser) {
      parser.assertAdvance('%');
      return this.new({ name: parser.nameString() });
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
    parse(parser) {
      parser.assertAdvance('.');
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
    parse(parser) {
      const name = parser.nameString();
      const value = parser.form();

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
    parse(parser) {
      parser.assertAdvance('{');
      parser.stripws();
      const pairs = [];
      while (parser.cur() !== '}') {
        pairs.push(Pair.parse(parser));
        parser.stripws();
      }
      parser.assertAdvance('}');
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
    parse(parser) {
      parser.assertAdvance('@');
      const s = List.parse(parser);
      return Body.new({ statements: s.value() });
    },
    of(statements) {
      return this.new({ statements });
    }
  },
  slots: {
    statements: Var.new(),
    js(ctx) {
      return this.statements()
                 .map((s, idx) =>
                   (idx === this.statements().length - 1 ? 'return ' : '') + s.js(ctx) + ';')
                 .join('');
    }
  }
});

ctx.defmacro('body', function(...statements) {
  return Body.new({
    statements
  });
});

export const Program = Class.new({
  name: 'Program',
  static: {
    parse(parser) {
      const statements = [];
      let f;
      while ((f = parser.form()) !== null) {
        statements.push(f);
      }
      return Program.new({ statements })
    }
  },
  slots: {
    statements: Var.new(),
    js(ctx) {
      return this.statements().map(s => s.js(ctx)).join(';');
    },
    macroexpand(ctx) {

    }
  }
})

export const Parser = Class.new({
  name: 'Parser',
  static: {
    fromSource(source) {
      return this.new({ toks: Lexer.new({ code: source }).toks() });
    }
  },
  slots: {
    toks: Var.new(),
    pos: Var.default(0),
    cur() {
      return this.toks()[this.pos()];
    },
    head() {
      this.stripws();
      return this.cur();
    },
    headChar(cs) {
      return cs.includes(this.head());
    },
    maybeAdvance(cs) {
      if (this.headChar(cs)) {
        return this.advance();
      }
      return null;
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
        throw new Error(`assertion failed: ${l} !== ${r} at ${this.cur()}`);
      }
    },
    stripws(set = ' \n\t') {
      while (set.includes(this.cur())) {
        this.advance();
      }
    },
    nameString() {
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
        "'": NameLiteral,
        '@': Body,
        '{': Dexp,
        '[': List,
      };
      const exp = tokamap[tok]?.parse(this);
      if (exp) {
        if (this.cur() === '(') {
          return Call.new({ receiver: exp, message: Message.parse(this) });
        }
        return exp;
      }

      if (tok === '$') {
        this.advance();
        return MacroCall.new({ message: Message.parse(this) });
      }
      if (' \n\t'.includes(tok)) {
        this.advance();
        return this.form();
      }
      if (tok[0] === '"') {
        return StringLiteral.parse(this);
      }
      if (/[A-Za-z]/.test(tok[0])) {
        return this.nameString();
      }
      throw new Error('No matching parse form for ' + tok);
    },
  }
});

export const ExportStatement = Class.new({
  name: 'ExportStatement',
  slots: {
    name: Var.new(),
    value: Var.new(),
    js(ctx) {
      return `export var \$class_${this.name()} = ${this.value().js(ctx)}`;
    }
  }
});

ctx.add(Macro.new({
  name: 'def',
  fn: function(value) {
    const name = value.message().parts()[0].args()[0].map().name.value();
    return ExportStatement.new({
      name,
      value,
    });
  }
}));

export const EmptyStatement = Class.new({
  name: 'EmptyStatement',
  slots: {
    js(ctx) {
      return '';
    }
  }
});

export const FunctionStatement = Class.new({
  name: 'FunctionStatement',
  slots: {
    name: Var.new(),
    args: Var.default(EmptyStatement.new()),
    body: Var.new(),
    export: Var.default(false),
    js(ctx) {
      return `${this.export() ? 'export ' : ''}function ${this.name() || ''}(${this.args().js(ctx)}) { ${this.body().js(ctx)} }`;
    }
  }
});

ctx.defmacro('fn', function(args, body) {
  return FunctionStatement.new({
    args,
    body
  });
});

export const ImportStatement = Class.new({
  name: 'ImportStatement',
  slots: {
    imports: Var.new(),
    module: Var.new(),
    js(ctx) {
      return `import { ${this.imports().join(', ')} } from '${this.module()}'`;
    }
  }
});

ctx.defmacro('std', function() {
  return ImportStatement.new({
    imports: ['Class as $class_class', 'Var as $class_var', 'Method as $class_method', 'Debug as $class_debug'],
    module: '../base.js',
  });
});

export const LetStatement = Class.new({
  name: 'LetStatement',
  slots: {
    name: Var.new(),
    value: Var.new(),
    js(ctx) {
      return `let ${this.name()} = ${this.value().js(ctx)}`;
    }
  }
});

ctx.defmacro('let', function(name, value) {
  return LetStatement.new({
    name,
    value
  });
});

export const ForStatement = Class.new({
  name: 'ForStatement',
  slots: {
    bindType: Var.default('const'),
    bindName: Var.default('it'),
    iterable: Var.new(),
    body: Var.new(),
    js(ctx) {
      return `for (${this.bindType()} ${this.bindName()} of ${this.iterable().js(ctx)}) { ${this.body().js(ctx)} }`;
    }
  }
});

ctx.defmacro('loop', function (iterable, ...body) {
  return ForStatement.new({
    iterable,
    body: Body.new({ statements: body })
  });
});

ctx.defmacro('test', function (...body) {
  return FunctionStatement.new({
    name: 'test',
    export: true,
    body: Body.of(body),
  })
});

ctx.defmacro('assert', function (a, b) {
  return EmptyStatement.new();
});


/*
 * remaining syntax bits:
 * spread/unspread (... / ^ / @ / ^,)
 * quasiquotes/macro definition facilities (`,)
 * &externJS
 * macro piping?
 * !types
 * @global
 */

const explus = `
$(macro method (args ^body) ~method(new { do $(fn %args $(body ^%body)) }))
~project(new {
  modules [
    'html
    '2d
  ]
})
`;

export const Package = Class.new({
  name: 'Package',
  static: {
    loadLocal(name) {
      const file = `./core/${name}.simulabra`;
      const source = readFileSync(file).toString();
      return this.new({
        name,
        program: Program.parse(Parser.fromSource(source)),
      });
    }
  },
  slots: {
    name: Var.new(),
    program: Var.new(),
    imports: Var.new(),
    exports: Var.new(),
    js(ctx) {
      return this.program().js(ctx);
    },
    outfile() {
      return `./out/${this.name()}.mjs`
    },
    save(ctx) {
      const js = this.js(ctx);
      writeFileSync(this.outfile(), js)
    },
    //@async
    module(ctx) {
      this.save(ctx);
      return import (this.outfile());
    }
  },
});

const d2d = await Package.loadLocal('2d').module(ctx);
d2d.test();
