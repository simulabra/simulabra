// now, what if it were a lisp machine?
import { readFileSync, writeFileSync } from 'fs';
import './base.js';
const _ = globalThis.SIMULABRA;
const stanza = 'const _ = globalThis.SIMULABRA;';

_.lexer = _.class.new({
  name: 'lexer',
  slots: {
    init() {
      this.tokenize();
    },
    code: _.var.new(),
    pos: _.var.default(0),
    toks: _.var.default([]),
    cur: _.method.new({
      do: function cur() {
        return this.code()[this.pos()];
      }
    }),
    chomp: _.method.new({
      do: function chomp() {
        const c = this.cur();
        this.pos(this.pos() + 1);
        return c;
      }
    }),
    ended: _.method.new({
      do: function ended() {
        return this.pos() >= this.code().length;
      }
    }),
    terminal: _.method.new({
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
    readToTerminal: _.method.new({
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
    token: _.method.new({
      do: function token() {
        const c = this.chomp();
        if ('(){}[]>~@$!.%#|,\' \n\t'.includes(c)) {
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
    tokenize: _.method.new({
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
 * _.call
 * Map
 * String
 * _.macro
 * _.class
 * Interface
 * Number
 * This
 * Arg
 * Boolean
 * _.list_expression
 * Sexp
 */
_.node = _.class.new({
  name: 'node',
  abstract: true,
  slots: {
    children() {
    },
    macroexpand() {
      return this;
    },
    js: _.virtual.new(),
  }
});

_.js_literal = _.class.new({
  name: 'js_literal',
  super: _.node,
  slots: {
    value: _.var.new(),
    js: _.method.new({
      do: function js(ctx) {
        return JSON.stringify(this.value());
      }
    }),
  },
});

_.name_literal = _.class.new({
  name: 'name_literal',
  super: _.node,
  super: _.js_literal,
  static: {
    parse(parser) {
      parser.assertAdvance('\'');
      const s = parser.nameString();
      return this.new({ value: s });
    }
  },
});

_.string_literal = _.class.new({
  name: 'string_literal',
  super: _.node,
  super: _.js_literal,
  static: {
    parse(parser) {
      const s = parser.advance();
      parser.assert(s[0], '"');
      parser.assert(s[s.length - 1], '"');
      return this.new({ value: s.slice(1, s.length - 1) });
    }
  },
});

_.number_literal = _.class.new({
  name: 'number_literal',
  super: _.node,
  super: _.js_literal,
  static: {
    parse(parser) {
      const n = parser.advance();
      parser.assert(typeof n, 'number');
      return _.number_literal.new({ value: n });
    },
  },
});

_.list_expression = _.class.new({
  name: 'list_expression',
  super: _.node,
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
    },
    of(arr) {
      return this.new({ value: arr });
    }
  },
  slots: {
    value: _.var.default([]),
    car: _.method.new({
      do: function car() {
        return this.value()[0];
      }
    }),
    cdr: _.method.new({
      do: function cdr() {
        return this.value().slice(1);
      }
    }),
    js(ctx) {
      return `[${this.argsjs(ctx)}]`;
    },
    args(ctx) {
      return this.value().map(e => {
        return e.js(ctx);
      });
    },
    argsjs(ctx) {
      return `${this.args(ctx).join(', ')}`;
    },
    children() {
      return this.value();
    }
  }
});

_.macro_env = _.class.new({
  name: 'macro_env',
  slots: {
    parent: _.var.new(), // right?
    macros: _.var.default({}),
    stack: _.var.default([]),
    add: _.method.new({
      do: function add(macro) {
        this.macros()[macro.name()] = macro;
      }
    }),
    defmacro(name, fn) {
      this.add(_.macro.new({
        name,
        fn
      }));
    },
    eval: _.method.new({
      do: function evalFn(mcall) {
        this.stack().push(mcall);
        const mname = mcall.selector();
        const m = this.macros()[mname];
        if (m) {
          this.stack().pop();
          return m.fn().apply(this, mcall.args())
        } else {
          throw new Error(`Invalid macro: ${this.stack().map(mc => mc.selector()).join(':')}`)
        }
      }
    }),
  }
});

const baseEnv = _.macro_env.new({
  should_debug: true,
});

_.macro = _.class.new({
  name: 'macro',
  slots: {
    name: _.var.new(),
    fn: _.var.new(),
  }
});

baseEnv.add(_.macro.new({
  name: 'macro',
  fn: function(name, args, ...body) {
    const fnp = [...args.args(this), stanza + _.body.of(body).js(this)];
    // hmm, here we run into module issues again, and a big ugly global container object is appealing once more
    console.error(fnp);
    try {
      const fn = new Function(...fnp);
      this.add(_.macro.new({
        name,
        fn
      }));
      return _.empty_statement.new();
    } catch (e) {
      console.error('macro error ' + name);
      console.error(fnp);
      throw e;
    }
  }
}));

_.rest_arg = _.class.new({
  name: 'rest_arg',
  super: _.node,
  slots: {
    name: _.var.new(),
    js(ctx) {
      return `...${this.name()}`;
    },
    children() {
      return this.name();
    }
  }
});

baseEnv.add(_.macro.new({
  name: 'rest',
  fn(name) {
    return _.rest_arg.new({ name });
  }
}))

_.macro_call = _.class.new({
  name: 'macro_call',
  super: _.node,
  static: {
    parse(parser) {
      parser.assertAdvance('$');
    },
  },
  slots: {
    message: _.var.new(),
    selector() {
      return this.message().parts()[0].selector();
    },
    args() {
      return this.message().parts()[0].args();
    },
    js: _.method.new({
      do: function js(ctx) {
        try {
          return ctx.eval(this).js(ctx);
        } catch (e) {
          console.log(`macro error: ${this.selector()}`);
          _.debug.log(ctx.eval(this))
          throw e;
        }
      }
    }),
  }
});

_.message_part = _.class.new({
  name: 'message_part',
  super: _.node,
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
    selector: _.var.new(),
    args: _.var.new(),
    js(ctx) {
      return `${this.selector()}(${this.args().map(a => a.js(ctx)).join(',')})`;
    },
  }
})

_.message = _.class.new({
  name: 'message',
  super: _.node,
  static: {
    parse(parser) {
      parser.assertAdvance('(');
      let parts = [];
      do {
        parts.push(_.message_part.parse(parser));
        parser.maybeAdvance('|');
      } while (parser.head() !== ')');
      parser.assertAdvance(')');
      return this.new({
        parts
      });
    }
  },
  slots: {
    parts: _.var.new(),
    js(ctx) {
      return this.parts().map(p => p.js(ctx)).join('.');
    },
  }
})

_.call = _.class.new({
  name: 'call',
  super: _.node,
  slots: {
    receiver: _.var.new(),
    message: _.var.new(),
    js: _.method.new({
      do: function js(ctx) {
        return `${this.receiver().js(ctx)}.${this.message().js(ctx)}`;
      }
    })
  }
});

_.error_tok = _.class.new({
  name: 'error_tok',
  super: _.node,
  slots: {
    init() {
      this.error(new Error(`Could not compile: '${this.tok()}': ${this.message()}`));
    },
    tok: _.var.new(),
    message: _.var.default('errortok'),
    error: _.var.new(),
    js() {
      throw this.error();
    }
  }
});

// o, but I want for composition with classes
_.ref = _.class.new({
  name: 'ref',
  super: _.node,
  abstract: true,
  slots: {
    name: _.var.new(),
  }
})

_.class_ref = _.class.new({
  name: 'class_ref',
  super: _.ref,
  static: {
    parse(parser) {
      parser.assertAdvance('~');
      return _.class_ref.new({ name: parser.nameString() });
    },
  },
  slots: {
    js: _.method.new({
      do: function js(ctx) {
        return `_.${this.name()}`;
      }
    }),
  }
});

_.type_ref = _.class.new({
  name: 'type_ref',
  super: _.ref,
  static: {
    parse(parser) {
      parser.assertAdvance('!');
      return this.new({ name: parser.nameString() });
    },
  },
  slots: {
    name: _.var.new(),
    js: _.method.new({
      do: function js() {
        return `${this.name()}`;
      }
    })
  }
});

_.arg_ref = _.class.new({
  name: 'arg_ref',
  super: _.ref,
  static: {
    parse(parser) {
      parser.assertAdvance('%');
      return this.new({ name: parser.nameString() });
    },
  },
  slots: {
    name: _.var.new(),
    js: _.method.new({
      do: function js(ctx) {
        return this.name();
      }
    }),
  }
});

_.this_ref = _.class.new({
  name: 'this_ref',
  super: _.ref,
  static: {
    parse(parser) {
      parser.assertAdvance('.');
      return this.new();
    },
  },
  slots: {
    js: _.method.new({
      do: function js(ctx) {
        return 'this';
      }
    }),
  }
});

_.unquote = _.class.new({
  name: 'unquote',
  // super: _.node,
  static: {
    parse(parser) {
      parser.assertAdvance(',');
      const value = parser.form();

      return _.unquote.new({ value })
    },
  },
  slots: {
    value: _.var.new(),
  }
});

baseEnv.add(_.macro.new({
  name: 'qq',
  super: _.node,
  fn(form) {

  }
}))

_.pair = _.class.new({
  name: 'pair',
  super: _.node,
  static: {
    parse(parser) {
      const name = parser.nameString();
      const value = parser.form();

      return _.pair.new({ name, value })
    },
  },
  slots: {
    name: _.var.new(),
    value: _.var.new(),
    js(ctx) {
      return `${this.name()}: ${this.value().js(ctx)},`
    }
  }
});

_.dexp = _.class.new({
  name: 'dexp', // lmao?
  super: _.node,
  static: {
    parse(parser) {
      parser.assertAdvance('{');
      parser.stripws();
      const pairs = [];
      while (parser.cur() !== '}') {
        pairs.push(_.pair.parse(parser));
        parser.stripws();
      }
      parser.assertAdvance('}');
      return _.dexp.new({
        pairs
      });
    },
  },
  slots: {
    pairs: _.var.default([]),
    map: _.var.new(),
    init() {
      let m = {};
      for (const p of this.pairs()) {
        m[p.name()] = p.value();
      }
      this.map(m);
    },
    js: _.method.new({
      do: function js(ctx) {
        return `{ ${this.pairs().map(p => p.js(ctx)).join('')} }`;
      }
    }),
  },
});

_.body = _.class.new({
  name: 'body',
  super: _.node,
  static: {
    parse(parser) {
      parser.assertAdvance('@');
      const s = _.list_expression.parse(parser);
      return _.body.new({ statements: s.value() });
    },
    of(statements) {
      return this.new({ statements });
    }
  },
  slots: {
    statements: _.var.new(),
    js(ctx) {
      return this.statements()
                 .map((s, idx) =>
                   (idx === this.statements().length - 1 ? 'return ' : '') + s.js(ctx) + ';')
                 .join('');
    }
  }
});

baseEnv.defmacro('body', function(...statements) {
  return _.body.new({
    statements
  });
});

_.program = _.class.new({
  name: 'program',
  super: _.node,
  static: {
    parse(parser) {
      const statements = [];
      let f;
      while ((f = parser.form()) !== null) {
        statements.push(f);
      }
      return _.program.new({ statements })
    }
  },
  slots: {
    statements: _.var.new(),
    js(ctx) {
      return stanza + this.statements().map(s => s.js(ctx)).join(';');
    },
  }
})

_.parser = _.class.new({
  name: 'parser',
  static: {
    fromSource(source) {
      return this.new({ toks: _.lexer.new({ code: source }).toks() });
    }
  },
  slots: {
    toks: _.var.new(),
    pos: _.var.default(0),
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
        return _.number_literal.parse(this);
      }
      const tokamap = {
        '~': _.class_ref,
        '!': _.type_ref,
        '%': _.arg_ref,
        '.': _.this_ref,
        "'": _.name_literal,
        '@': _.body,
        '{': _.dexp,
        '[': _.list_expression,
        ',': _.unquote,
      };
      const exp = tokamap[tok]?.parse(this);
      if (exp) {
        if (this.cur() === '(') {
          return _.call.new({ receiver: exp, message: _.message.parse(this) });
        }
        return exp;
      }

      if (tok === '$') {
        this.advance();
        return _.macro_call.new({ message: _.message.parse(this) });
      }
      if (' \n\t'.includes(tok)) {
        this.advance();
        return this.form();
      }
      if (tok[0] === '"') {
        return _.string_literal.parse(this);
      }
      if (/[A-Za-z]/.test(tok[0])) {
        return this.nameString();
      }
      throw new Error('No matching parse form for ' + tok);
    },
  }
});

_.export_statement = _.class.new({
  name: 'export-statement',
  super: _.node,
  slots: {
    name: _.var.new(),
    value: _.var.new(),
    js(ctx) {
      return `_.${this.name()} = ${this.value().js(ctx)}`;
    }
  }
});

baseEnv.add(_.macro.new({
  name: 'def',
  fn: function(value) {
    const name = value.message().parts()[0].args()[0].map().name.value();
    return _.export_statement.new({
      name,
      value,
    });
  }
}));

_.empty_statement = _.class.new({
  name: 'empty-statement',
  super: _.node,
  slots: {
    js(ctx) {
      return '';
    },
    argsjs(ctx) {
      return '';
    }
  }
});

_.function_statement = _.class.new({
  name: 'function_statement',
  super: _.node,
  slots: {
    name: _.var.new(),
    args: _.var.default(_.empty_statement.new()),
    body: _.var.new(),
    export: _.var.default(false),
    js(ctx) {
      return `${this.export() ? 'export ' : ''}function ${this.name() || ''}(${this.args().argsjs(ctx)}) { ${this.body().js(ctx)} }`;
    }
  }
});

baseEnv.defmacro('fn', function(args, ...body) {
  return _.function_statement.new({
    args,
    body: _.body.of(body)
  });
});

baseEnv.add(_.macro.new({
  name: 'defn',
  fn: function(name, args, ...body) {
    return _.export_statement.new({
      name,
      value: _.function_statement.new({
        args,
        body: _.body.of(body),
      })
    });
  }
}));

baseEnv.defmacro('do', function (...body) {
  return _.function_statement.new({
    args: _.list_expression.of(['it']),
    body: _.body.of(body)
  });
});

_.import_statement = _.class.new({
  name: 'import_statement',
  super: _.node,
  slots: {
    imports: _.var.new(),
    module: _.var.new(),
    js(ctx) {
      return `import { ${this.imports().join(', ')} } from '${this.module()}'`;
    }
  }
});

_.let_statement = _.class.new({
  name: 'let_statement',
  super: _.node,
  slots: {
    name: _.var.new(),
    value: _.var.new(),
    js(ctx) {
      return `let ${this.name()} = ${this.value().js(ctx)}`;
    }
  }
});

baseEnv.defmacro('let', function(name, value) {
  return _.let_statement.new({
    name,
    value
  });
});

_.for_statement = _.class.new({
  name: 'for_statement',
  super: _.node,
  slots: {
    bindType: _.var.default('const'),
    bindName: _.var.default('it'),
    iterable: _.var.new(),
    body: _.var.new(),
    js(ctx) {
      return `for (${this.bindType()} ${this.bindName()} of ${this.iterable().js(ctx)}) { ${this.body().js(ctx)} }`;
    }
  }
});

baseEnv.defmacro('loop', function (iterable, ...body) {
  return _.for_statement.new({
    iterable,
    body: _.body.of(body)
  });
});

baseEnv.defmacro('test', function (...body) {
  return _.function_statement.new({
    name: 'test',
    export: true,
    body: _.body.of(body),
  })
});

baseEnv.defmacro('assert', function (a, b) {
  return _.empty_statement.new();
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

_.module_source = _.class.new({
  name: 'module_source',
  static: {
    loadLocal(name) {
      const file = `./core/${name}.simulabra`;
      const source = readFileSync(file).toString();
      return this.new({
        source
      })
    }
  },
  slots: {
    source: _.var.new(),
    parser() {
      return _.parser.fromSource(this.source());
    },
  }
});

// Source -> Out -> _.module or Source -> _.module -> Out, that is the q
// also raises q of whether we need to have eval
// compiler can be reentrant with dynamic imports???
_.module_file = _.class.new({
  name: 'module-file',
  static: {
    async load(name, ctx) {
      const src = _.module_source.loadLocal(name);
      const outfile = `./out/${this.name()}.mjs`;
      const program = _.program.parse(src.parser());
      _.debug.log(program)
      const js = program.js(ctx);
      let esm;
      try {
        writeFileSync(outfile, js);
        esm = await import(outfile);
      } catch (e) {
        console.error(e);
        console.log(js);
      }
      const defs = [];
      for (let v in esm) {
        if (esm.hasOwnProperty(v)) {
          defs.push(esm[v]);
        }
      }
      return this.new({
        name,
        esm,
        defs,
      });
    }
  },
  slots: {
    name: _.var.new(),
    esm: _.var.new(),
    defs: _.var.new(),
    save(ctx) {
      const js = this.js(ctx);
      writeFileSync(this.outfile(), js)
    },
  },
});

await _.module_file.load(process.argv[2], baseEnv);
_.debug.log(_.test());
