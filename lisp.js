// now, what if it were a lisp machine?
import { readFileSync, writeFileSync } from 'fs';
import { parse, print, prettyPrint } from 'recast';
import { parseScript } from 'meriyah';
import { $class, $var, $method, $virtual, $debug } from './base.js';
const $_ = globalThis.SIMULABRA;
const stanza = `
const $_ = globalThis.SIMULABRA;
`;

export const $lexer = $class.new({
  name: 'lexer',
  slots: {
    init() {
      this.tokenize();
    },
    code: $var.new(),
    pos: $var.default(0),
    toks: $var.default([]),
    cur: $method.new({
      do: function cur() {
        return this.code()[this.pos()];
      }
    }),
    chomp: $method.new({
      do: function chomp() {
        const c = this.cur();
        this.pos(this.pos() + 1);
        return c;
      }
    }),
    ended: $method.new({
      do: function ended() {
        return this.pos() >= this.code().length;
      }
    }),
    terminal: $method.new({
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
    readToTerminal: $method.new({
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
    token: $method.new({
      do: function token() {
        const c = this.chomp();
        if ('(){}[]>~@$!.%#|,:^= \n\t'.includes(c)) {
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
    tokenize: $method.new({
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
 * $call
 * Map
 * String
 * $macro
 * $class
 * Interface
 * Number
 * This
 * Arg
 * Boolean
 * $list_expression
 * Sexp
 */
export const $node = $class.new({
  name: 'node',
  abstract: true,
  slots: {
    children() {
      return [];
    },
    macroexpand() {
      return this;
    },
    js: $virtual.new(),
  }
});


export const $literal = $class.new({
  name: 'literal',
  super: $node,
  slots: {
    value: $var.new(),
    js: $method.new({
      do: function js(ctx) {
        return JSON.stringify(this.value());
      }
    }),
  },
});

export const $name_literal = $class.new({
  name: 'name_literal',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance(':');
      const s = parser.advance();
      return this.new({ value: s });
    },
  },
  slots: {
    value: $var.new(),
    jsSymbol() {
      return this.value().replace(/-/g, '_');
    },
    js(ctx) {
      return this.jsSymbol();
    }
  }
});

export const $string_literal = $class.new({
  name: 'string_literal',
  super: $literal,
  static: {
    parse(parser) {
      const s = parser.advance();
      parser.assert(s[0], '"');
      parser.assert(s[s.length - 1], '"');
      return this.new({ value: s.slice(1, s.length - 1) });
    },
  },
});

export const $number_literal = $class.new({
  name: 'number_literal',
  super: $literal,
  static: {
    parse(parser) {
      const n = parser.advance();
      parser.assert(typeof n, 'number');
      return $number_literal.new({ value: n });
    },
  },
});

export const $list_expression = $class.new({
  name: 'list_expression',
  super: $node,
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
    value: $var.default([]),
    car: $method.new({
      do: function car() {
        return this.value()[0];
      }
    }),
    cdr: $method.new({
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

export const $macro_env = $class.new({
  name: 'macro_env',
  slots: {
    parent: $var.new(), // right?
    macros: $var.default({}),
    stack: $var.default([]),
    add: $method.new({
      do: function add(macro) {
        this.macros()[macro.name()] = macro;
      }
    }),
    defmacro(name, fn) {
      this.add($macro.new({
        name,
        fn
      }));
    },
    eval: $method.new({
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

const baseEnv = $macro_env.new({
  should_debug: true,
});

export const $macro = $class.new({
  name: 'macro',
  slots: {
    name: $var.new(),
    fn: $var.new(),
  }
});

baseEnv.add($macro.new({
  name: 'macro',
  fn: function(name, args, ...body) {
    const fnp = [...args.args(this), stanza + $body.of(body).js(this)];
    // hmm, here we run into module issues again, and a big ugly global container object is appealing once more
    console.error(fnp);
    try {
      const fn = new Function(...fnp);
      this.add($macro.new({
        name,
        fn
      }));
      return $empty_statement.new();
    } catch (e) {
      console.error('macro error ' + name);
      console.error(fnp);
      throw e;
    }
  }
}));

export const $rest_arg = $class.new({
  name: 'rest_arg',
  super: $node,
  slots: {
    name: $var.new(),
    js(ctx) {
      return `...${this.name()}`;
    },
    children() {
      return this.name();
    }
  }
});

baseEnv.add($macro.new({
  name: 'rest',
  fn(name) {
    return $rest_arg.new({ name });
  }
}))

export const $macro_call = $class.new({
  name: 'macro_call',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance('$');
      return this.new({ message: $message.parse(parser) });
    },
  },
  slots: {
    message: $var.new(),
    selector() {
      return this.message().parts()[0].selector().value();
    },
    args() {
      return this.message().parts()[0].args();
    },
    js: $method.new({
      do: function js(ctx) {
        try {
          return ctx.eval(this).js(ctx);
        } catch (e) {
          console.log(`macro error: ${this.selector()}`);
          $debug.log(ctx.eval(this))
          throw e;
        }
      }
    }),
  }
});


export const $message_part = $class.new({
  name: 'message_part',
  super: $node,
  static: {
    parse(parser) {
      const selector = parser.nameString();
      const args = [];
      while (!'|>)'.includes(parser.head())) {
        args.push(parser.form());
      }
      return this.new({
        selector,
        args
      });
    }
  },
  slots: {
    selector: $var.new(),
    args: $var.new(),
    js(ctx) {
      return `${this.selector().js(ctx)}(${this.args().map(a => a.js(ctx)).join(',')})`;
    },
  }
})

export const $message = $class.new({
  name: 'message',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance('(');
      let parts = [];
      do {
        parts.push($message_part.parse(parser));
        parser.maybeAdvance('|');
      } while (parser.head() !== ')');
      parser.assertAdvance(')');
      return this.new({
        parts
      });
    }
  },
  slots: {
    parts: $var.new(),
    js(ctx) {
      return this.parts().map(p => p.js(ctx)).join('.');
    },
  }
});

export const $call = $class.new({
  name: 'call',
  super: $node,
  slots: {
    receiver: $var.new(),
    message: $var.new(),
    js: $method.new({
      do: function js(ctx) {
        return `${this.receiver().js(ctx)}.${this.message().js(ctx)}`;
      }
    })
  }
});

export const $error_tok = $class.new({
  name: 'error_tok',
  super: $node,
  slots: {
    init() {
      this.error(new Error(`Could not compile: '${this.tok()}': ${this.message()}`));
    },
    tok: $var.new(),
    message: $var.default('errortok'),
    error: $var.new(),
    js() {
      throw this.error();
    }
  }
});

// o, but I want for composition with classes
export const $ref = $class.new({
  name: 'ref',
  super: $node,
  abstract: true,
  slots: {
    name: $var.new(),
    deskewer() {
      return this.name().jsSymbol();
    }
  }
})

export const $class_ref = $class.new({
  name: 'class_ref',
  super: $ref,
  static: {
    parse(parser) {
      parser.assertAdvance('~');
      return $class_ref.new({ name: parser.nameString() });
    },
  },
  slots: {
    js: $method.new({
      do: function js(ctx) {
        return `$${this.deskewer()}`;
      }
    }),
  }
});

export const $type_ref = $class.new({
  name: 'type_ref',
  super: $ref,
  static: {
    parse(parser) {
      parser.assertAdvance('!');
      return this.new({ name: parser.nameString() });
    },
  },
  slots: {
    js: $method.new({
      do: function js() {
        return `$\$${this.deskewer()}`;
      }
    })
  }
});

export const $arg_ref = $class.new({
  name: 'arg_ref',
  super: $ref,
  static: {
    parse(parser) {
      parser.assertAdvance('%');
      return this.new({ name: parser.nameString() });
    },
  },
  slots: {
    js: $method.new({
      do: function js(ctx) {
        return this.deskewer();
      }
    }),
  }
});

export const $get_var = $class.new({
  name: 'get_var',
  static: {
    parse(parser) {
      parser.assertAdvance('.');
      return this.new();
    },
  },
  slots: {
    js: $method.new({
      do: function js(ctx) {
        return 'this';
      }
    }),
  }
});

export const $set_var = $class.new({
  static: {
    parse(parser) {
      parser.assertAdvance('=');
      return this.new();
    }
  },
  slots: {
    js: $method.new({
      do: function js(ctx) {
        return 'this';
      }
    }),
  }
})

export const $unquote = $class.new({
  name: 'unquote',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance(',');
      const value = parser.form();

      return $unquote.new({ value })
    },
  },
  slots: {
    value: $var.new(),
  }
});

baseEnv.add($macro.new({
  name: 'qq',
  super: $node,
  fn(form) {

  }
}))

export const $pair = $class.new({
  name: 'pair',
  super: $node,
  static: {
    parse(parser) {
      const name = parser.nameString();
      const value = parser.form();

      return $pair.new({ name, value })
    },
  },
  slots: {
    name: $var.new(),
    value: $var.new(),
    js(ctx) {
      return `${this.name().jsSymbol()}: ${this.value().js(ctx)},`
    }
  }
});

export const $object_literal = $class.new({
  name: 'object-literal', // lmao?
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance('{');
      parser.stripws();
      const pairs = [];
      while (parser.cur() !== '}') {
        pairs.push($pair.parse(parser));
        parser.stripws();
      }
      parser.assertAdvance('}');
      return $object_literal.new({
        pairs
      });
    },
  },
  slots: {
    pairs: $var.default([]),
    map: $var.new(),
    init() {
      let m = {};
      for (const p of this.pairs()) {
        $debug.log(p.name())
        m[p.name().jsSymbol()] = p.value();
      }
      this.map(m);
    },
    js: $method.new({
      do: function js(ctx) {
        return `{ ${this.pairs().map(p => p.js(ctx)).join('')} }`;
      }
    }),
  },
});

export const $body = $class.new({
  name: 'body',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance('@');
      const s = $list_expression.parse(parser);
      return $body.new({ statements: s.value() });
    },
    of(statements) {
      return this.new({ statements });
    }
  },
  slots: {
    statements: $var.new(),
    js(ctx) {
      return this.statements().map(s => s.js(ctx) + ';').join('');
    }
  }
});

export const $if_statement = $class.new({
  name: 'if-statement',
  super: $node,
  slots: {
    cond: $var.new(),
    then: $var.new(),
    else: $var.new(),
    js(ctx) {
      const elssJs = this.else() !== undefined ? `else { ${this.else().js(ctx)} }` : '';
      const j = `if (${this.cond().js(ctx)}) { ${this.then().js(ctx)} } ${elssJs}`
      return j;
    }
  }
});

export const $return = $class.new({
  name: 'return',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance('^');
      return this.new({
        value: parser.form()
      });
    },
  },
  slots: {
    value: $var.new(),
    js(ctx) {
      return 'return ' + this.value().js(ctx);
    }
  }
})

export const $program = $class.new({
  name: 'program',
  super: $node,
  static: {
    parse(parser) {
      const statements = [];
      let f;
      while ((f = parser.form()) !== null) {
        statements.push(f);
      }
      return $program.new({ statements })
    }
  },
  slots: {
    statements: $var.new(),
    js(ctx) {
      return this.statements().map(s => s.js(ctx)).join(';');
    },
  }
})

export const $parser = $class.new({
  name: 'parser',
  static: {
    fromSource(source) {
      return this.new({ toks: $lexer.new({ code: source }).toks() });
    }
  },
  slots: {
    toks: $var.new(),
    pos: $var.default(0),
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
    curInContext() {
      return this.toks().map((tok, i) => {
        if (i === this.pos()) {
          return `////${tok}////`;
        } else {
          return tok;
        }
      }).join('');
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
      return $name_literal.new({ value: this.advance() });
    },
    form() {
      if (this.ended()) {
        return null;
      }
      let tok = this.cur();
      if (typeof tok === 'number') {
        return $number_literal.parse(this);
      }
      const tokamap = {
        '~': $class_ref,
        '!': $type_ref,
        '%': $arg_ref,
        '.': $get_var,
        '=': $set_var,
        ":": $name_literal,
        '@': $body,
        '{': $object_literal,
        '[': $list_expression,
        ',': $unquote,
        '^': $return,
        '$': $macro_call,
      };
      const exp = tokamap[tok]?.parse(this);
      if (exp) {
        if (this.cur() === '(') {
          return $call.new({ receiver: exp, message: $message.parse(this) });
        }
        return exp;
      }
      if (' \n\t'.includes(tok)) {
        this.advance();
        return this.form();
      }
      if (tok[0] === '"') {
        return $string_literal.parse(this);
      }
      if (/[A-Za-z]/.test(tok[0])) {
        return this.nameString();
      }
      throw new Error(`No matching parse form for ${tok} in ${this.curInContext()}`);
    },
  }
});

export const $export_statement = $class.new({
  name: 'export-statement',
  super: $node,
  slots: {
    name: $var.new(),
    value: $var.new(),
    type: $var.default('const'),
    js(ctx) {
      return `${this.type()} $${this.name()} = ${this.value().js(ctx)}`;
    }
  }
});

baseEnv.add($macro.new({
  name: 'def',
  fn: function(value) {
    $debug.log(value.message().parts()[0].args()[0]);
    const name = value.message().parts()[0].args()[0].map().name.jsSymbol();
    return $export_statement.new({
      name,
      value,
    });
  }
}));

export const $empty_statement = $class.new({
  name: 'empty-statement',
  super: $node,
  slots: {
    js(ctx) {
      return '';
    },
    argsjs(ctx) {
      return '';
    }
  }
});

export const $function_statement = $class.new({
  name: 'function_statement',
  super: $node,
  slots: {
    name: $var.new(),
    args: $var.default($empty_statement.new()),
    body: $var.new(),
    export: $var.default(false),
    js(ctx) {
      return `${this.export() ? 'export ' : ''}function ${this.name() || ''}(${this.args().argsjs(ctx)}) { ${this.body().js(ctx)} }`;
    }
  }
});

baseEnv.defmacro('fn', function(args, ...body) {
  return $function_statement.new({
    args,
    body: $body.of(body)
  });
});

baseEnv.add($macro.new({
  name: 'defn',
  fn: function(name, args, ...body) {
    // TODO: add function to module
    return $body.new({
      statements: [
        $export_statement.new({
          name: name.value(),
          value: $function_statement.new({
            args,
            body: $body.of(body),
          })
        }),
        $js_snippet.new({
          code: `$_.mod.addFunction('${name.value()}', $${name.value()})`
        }),
      ],
    });
  },
}));

baseEnv.defmacro('do', function (...body) {
  return $function_statement.new({
    args: $list_expression.of(['it']),
    body: $body.of(body)
  });
});

export const $import_statement = $class.new({
  name: 'import_statement',
  super: $node,
  slots: {
    imports: $var.new(),
    module: $var.new(),
    js(ctx) {
      return `import { ${this.imports().join(', ')} } from '${this.module()}'`;
    }
  }
});

export const $let_statement = $class.new({
  name: 'let_statement',
  super: $node,
  slots: {
    name: $var.new(),
    value: $var.new(),
    js(ctx) {
      return `let ${this.name().value()} = ${this.value().js(ctx)}`;
    }
  }
});

baseEnv.defmacro('let', function(name, value) {
  return $let_statement.new({
    name,
    value
  });
});

export const $for_statement = $class.new({
  name: 'for_statement',
  super: $node,
  slots: {
    bindType: $var.default('const'),
    bindName: $var.default('it'),
    iterable: $var.new(),
    body: $var.new(),
    js(ctx) {
      return `for (${this.bindType()} ${this.bindName()} of ${this.iterable().js(ctx)}) { ${this.body().js(ctx)} }`;
    }
  }
});

export const $js_snippet = $class.new({
  name: 'js-snippet',
  super: $node,
  slots: {
    code: $var.new(),
    js(ctx) {
      return this.code();
    }
  }
});

export const $throws = $class.new({
  name: 'throws',
  super: $node,
  slots: {
    msg: $var.new(),
    js(ctx) {
      return `throw new Error("${this.msg()}")`;
    }
  }
});

baseEnv.add($macro.new({
  name: 'throws',
  fn(msg) {
    return $throws.new({ msg });
  }
}));

baseEnv.add($macro.new({
  name: 'js',
  fn(code) {
    return $js_snippet.new({ code });
  }
}));

baseEnv.defmacro('loop', function (iterable, ...body) {
  return $for_statement.new({
    iterable,
    body: $body.of(body)
  });
});

baseEnv.defmacro('test', function (...body) {
  return $function_statement.new({
    name: 'test',
    export: true,
    body: $body.of(body),
  })
});

baseEnv.defmacro('assert', function (a, b) {
  return $empty_statement.new();
});

baseEnv.add($macro.new({
  name: 'if',
  fn(cond, then, elss) {
    return $if_statement.new({
      cond,
      then,
      else: elss
    })
  }
}))

baseEnv.add($macro.new({
  name: 'dupdate',
  fn(name) {
    // return $call.new({
    //   receiver: $get_var.new(),
    //   message: $message.new({
    //     parts: [$message_part.new({ selector: name, args: [this.parts(),
    //   }),
    //   else: elss
    // })
  }
}))



/*
 * remaining syntax bits:
 * spread/unspread (... / ^ / @ / ^,)
 * quasiquotes/macro definition facilities (`,)
 * &externJS
 * macro piping?
 * !types
 * @global
 */

export const $module_source = $class.new({
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
    source: $var.new(),
    parser() {
      return $parser.fromSource(this.source());
    },
  }
});

export const $evaluator = $class.new({
  name: 'evaluator',
  slots: {
    ctx: $var.new(),
    run(program) {
      const js = stanza + program.js(this.ctx());
      try {
        eval?.(js);
      } catch(e) {
        console.log('throwin')
        this.prettify(js);
        throw e;
      }
    },
    prettify(js) {
      try {
        $debug.log(prettyPrint(parse(js, {
          parser: {
            parse(source) {
              return parseScript(source);
            }
          }
        })).code.replace(/\\n/g, '\n'));
      } catch (e) {
        $debug.log(`failed to parse for pretty-printing ${js}`);
      }
    }
  }
});

export const $$evl = $evaluator.new({
  ctx: baseEnv
});

export const $module = $class.new({
  name: 'module',
  static: {
    loadFromFile(name) {
      const src = $module_source.loadLocal(name);
      const node = $program.parse(src.parser());
      const mod = this.new({
        src,
        node
      });
      $_.mod = mod;
      $$evl.run(node);
      delete $_.mod;
      return mod;
    }
  },
  slots: {
    name: $var.new(),
    classes: $var.default({}),
    functions: $var.default({}),
    src: $var.new(),
    node: $var.new(),
    addClass(cls) {
      this.classes()[cls.name()] = cls;
    },
    addFunction(name, fn) {
      this.functions()[name] = fn;
    },
    test() {
      this.functions().test()
    }
  }
});

const m = await $module.loadFromFile(process.argv[2]);
try {
  m.test();
} catch (e) {
  $$evl.prettify(m.node().js(baseEnv));
  console.log(e);
}
