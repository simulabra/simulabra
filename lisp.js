// now, what if it were a lisp machine?
import { readFileSync, writeFileSync } from 'fs';
import { parse, print, prettyPrint, types } from 'recast';
import { createHash } from 'node:crypto';
import { parseScript } from 'meriyah';
import { $class, $var, $method, $virtual, $debug } from './base.js';
const $_ = globalThis.SIMULABRA;
const b = types.builders;

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
        if (c === ';') {
          while (this.chomp() !== '\n') {}
          return this.token();
        }
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
    estree: $virtual.new(),
  }
});


export const $literal = $class.new({
  name: 'literal',
  super: $node,
  slots: {
    value: $var.new(),
    estree(ctx) {
      return b.literal(this.value());
    }
  },
});

export const $identifier = $class.new({
  name: 'identifier',
  super: $node,
  static: {
    parse(parser) {
      return this.new({ name: parser.advance() });
    }
  },
  slots: {
    name: $var.new({ required: true }),
    arg() {
      return $arg_ref.new({ name: this });
    },
    deskewer() {
      return this.name().replace(/-/g, '_');
    },
    estree(ctx) {
      return b.identifier(this.deskewer());
    }
  }
});

export const $symbol_literal = $class.new({
  name: 'symbol-literal',
  super: $literal,
  static: {
    parse(parser) {
      parser.assertAdvance(':');
      const s = parser.advance();
      return this.new({ value: s });
    },
  }
})

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
      parser.assert(typeof n, 'number'); // ????
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
    estree(ctx) {
      return b.arrayExpression(this.value().map(e => e.estree(ctx)));
    },
    args(ctx) {
      return this.value().map(e => {
        return e.estree(ctx);
      });
    },
    children() {
      return this.value();
    },
    estree(ctx) {
      return {
        type: 'ArrayExpression',
        elements: this.args(),
      };
    },
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
        const mname = mcall.selector().name();
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
    const fnp = [...args.args(this), stanza + $block.of(body).estree(this)];
    // hmm, here we run into module issues again, and a big ugly global container object is appealing once more
    console.error(fnp);
    try {
      const fn = new Function(...fnp.map(a => prettyPrint(a)));
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

export const $macro_call = $class.new({
  name: 'macro_call',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance('$');
      const message = $message.parse(parser);
      return this.new({ message });
    },
  },
  slots: {
    message: $var.new(),
    selector() {
      return this.message().parts()[0].selector();
    },
    args() {
      return this.message().parts()[0].args();
    },
    estree(ctx) {
      let res;
      try {
        res = ctx.eval(this);
        return res.estree(ctx);
      } catch (e) {
        $debug.log(`macro error: ${this.selector().name()}`, res, this);
        throw e;
      }
    },
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
  }
});

export const $call = $class.new({
  name: 'call',
  super: $node,
  slots: {
    receiver: $var.new(),
    message: $var.new(),
    children() {
      return [this.receiver(), this.message()];
    },
    estree(ctx) {
      const rp = this.message().parts();
      let exp = this.receiver().estree(ctx);
      for (const part of rp) {
        exp = {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: exp,
            computed: false,
            property: part.selector().estree(ctx),
          },
          arguments: part.args().map(a => a.estree(ctx)),
        };
      }
      return exp;
    }
  }
});

export const $error_tok = $class.new({
  name: 'error_tok',
  super: $node,
  slots: {
    tok: $var.new(),
    message: $var.default('errortok'),
    error() {
      return new Error(`Could not compile: '${this.tok()}': ${this.message()}`);
    },
    estree() {
      throw this.error();
    }
  }
});

// o, but I want for composition with classes
export const $ref = $class.new({
  name: 'ref',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance(this.prefix());
      return this.new({ name: parser.nameString() });
    },
    named(name) {
      $debug.log('named', name);
      return this.new({ name: $identifier.new({ name }) });
    },
    prefix: $var.new(),
    js_prefix: $var.new(),
  },
  slots: {
    name: $var.new(),
    arg() {
      return this;
    },
    estree(ctx) {
      $debug.log('ref estree', this.name(), this.class().name());
      return b.identifier(this.class().js_prefix() + this.name().deskewer());
      return $identifier.new({ name: this.class().js_prefix() + this.name().deskewer() }).estree(ctx);
    },
  }
})

export const $class_ref = $class.new({
  name: 'class_ref',
  super: $ref,
  prefix: '~',
  js_prefix: '$',
});

export const $type_ref = $class.new({
  name: 'type-ref',
  super: $ref,
  prefix: '!',
  js_prefix: '$$',
});

export const $arg_ref = $class.new({
  name: 'arg-ref',
  super: $ref,
  prefix: '%',
  js_prefix: '_',
});

export const $spread = $class.new({
  name: 'spread',
  super: $node,
  static: {
    parse(parser) {
      parser.assertAdvance('@');
      const argument = parser.form();
      return this.new({ argument });
    },
  },
  slots: {
    argument: $var.new(),
    children() {
      return [this.argument()];
    },
    arg() {
      return $spread.new({ argument: $arg_ref.new({ name: this.argument() }) });
    },
    estree(ctx) {
      return b.spreadElement(this.argument().estree(ctx));
    },
    deskewer() {
      return $spread.new({ argument: this.argument().deskewer() });
    }
  }
});

export const $this_expression = $class.new({
  name: 'this_expression',
  static: {
    parse(parser) {
      parser.assertAdvance('.');
      return this.new();
    },
  },
  slots: {
    estree(ctx) {
      return {
        type: 'ThisExpression'
      };
    },
  }
});

export const $assignment = $class.new({
  name: 'assignment',
  static: {
    parse(parser) {
      parser.assertAdvance('=');
      return this.new();
    }
  },
  slots: {
    message: $var.new(),
    estree(ctx) {
      return this.message().parts().map(p => {
        return {
          type: 'ExpressionStatement',
          expression: {
            type: 'AssignmentExpression',
            left: {
              type: 'MemberExpression',
              object: {
                type: 'ThisExpression',
              },
              computed: false,
              property: {
                type: 'Identifier',
                name: p.selector().estree(ctx),
              }
            },
            operator: '=',
            right: p.args().args(),
          },
        }
      });
    }
  }
});

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
    estree(ctx) {
      return {
        type: 'Property',
        key: this.name().estree(ctx),
        value: this.value().estree(ctx),
      }
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
        m[p.name().name()] = p.value();
      }
      this.map(m);
    },
    estree(ctx) {
      return {
        type: 'ObjectExpression',
        properties: this.pairs().map(p => p.estree(ctx)),
      };
    }
  },
});

export const $block = $class.new({
  name: 'block',
  super: $node,
  static: {
    of(body) {
      return this.new({ body });
    }
  },
  slots: {
    body: $var.new(),
    estree(ctx) {
      return {
        type: 'BlockStatement',
        body: this.body().map(b => {
          let o = b.estree(ctx);
          if (o.type.indexOf('Statement') === -1) {
            o = {
              type: 'ExpressionStatement',
              expression: o,
            };
          }
          return o;
        }),
      }
    },
  }
});

export const $if_statement = $class.new({
  name: 'if-statement',
  super: $node,
  slots: {
    cond: $var.new(),
    then: $var.new(),
    else: $var.new(),
    estree(ctx) {
      return {
        type: 'IfStatement',
        test: this.cond().estree(ctx),
        consequent: this.then().estree(ctx),
        alternate: this.else()?.estree(ctx),
      };
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
    children() {
      return [this.value()];
    },
    estree(ctx) {
      return {
        type: 'ReturnStatement',
        argument: this.value().estree(ctx),
      }
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
    estree(ctx) {
      return {
        type: 'Program',
        body: [
          $import_statement.new({
            imports: [
              $class_ref.named('class'),
              $class_ref.named('var'),
              $class_ref.named('method'),
              $class_ref.named('debug'),
            ],
            module: '../base.js',
          }).estree(ctx),
          ...this.statements().map(s => s.estree(ctx)),
        ],
      };
    },
  }
});

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
      return $identifier.new({ name: this.advance() });
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
        '.': $this_expression,
        '=': $assignment,
        ":": $symbol_literal,
        '@': $spread,
        '{': $object_literal,
        '[': $list_expression,
        ',': $unquote,
        '^': $return,
        '$': $macro_call,
      };
      try {
        const exp = tokamap[tok]?.parse(this);
        if (exp) {
          if (this.cur() === '(') {
            return $call.new({ receiver: exp, message: $message.parse(this) });
          }
          return exp;
        }
      } catch (e) {
        console.error(e);
        $debug.log(tokamap[tok]);
        throw new Error(`could not parse with token ${tok} ${tokamap[tok].name()} ${this.curInContext()}`);
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
    estree(ctx) {
      $debug.log('export', this.name(), this.value());
      return {
        type: 'ExportNamedDeclaration',
        declaration: {
          type: 'VariableDeclaration',
          kind: this.type(),
          declarations: [
            {
              type: 'VariableDeclarator',
              id: $class_ref.new({ name: this.name() }).estree(ctx),
              init: this.value().estree(ctx),
            }
          ]
        }
      }
    },
  }
});

baseEnv.add($macro.new({
  name: 'def',
  fn: function(value) {
    const name = $identifier.new({
      name: value.message().parts()[0].args()[0].map().name.value()
    });
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
    estree(ctx) {
      return null;
    }
  }
});

export const $function_expression = $class.new({
  name: 'function_expression',
  super: $node,
  slots: {
    name: $var.new(),
    args: $var.default($empty_statement.new()),
    body: $var.new(),
    export: $var.default(false),
    estree(ctx) {
      return {
        type: 'FunctionDeclaration',
        id: this.name()?.estree(ctx),
        params: this.args().value().map(a => a.arg().estree(ctx)),
        body: this.body().estree(ctx),
      };
    },
  }
});

baseEnv.defmacro('fn', function(args, ...body) {
  return $function_expression.new({
    args: args,
    body: $block.of(body)
  });
});

baseEnv.add($macro.new({
  name: 'defn',
  fn: function(name, args, ...body) {
    // TODO: add function to module
    return $export_statement.new({
      name,
      value: $function_expression.new({
        args,
        body: $block.of(body),
      })
    });
    // TODO: add function to module
  }
}));

baseEnv.defmacro('do', function (...body) {
  return $function_expression.new({
    args: $list_expression.of([$identifier.new({ name: 'it' }) ]),
    body: $block.of(body)
  });
});

export const $import_statement = $class.new({
  name: 'import_statement',
  super: $node,
  slots: {
    imports: $var.new(),
    module: $var.new(),
    estree(ctx) {
      return {
        type: 'ImportDeclaration',
        specifiers: this.imports().map(i => ({
          type: 'ImportSpecifier',
          local: i.name(),
          imported: i.name(),
        })),
        source: b.literal(this.module()),
      };
    }
  }
});

export const $let_statement = $class.new({
  name: 'let_statement',
  super: $node,
  slots: {
    name: $var.new(),
    value: $var.new(),
    kind: $var.default('let'),
    estree(ctx) {
        return {
          type: 'VariableDeclaration',
          kind: this.kind(),
          declarations: [
            {
              type: 'VariableDeclarator',
              id: this.name().estree(ctx),
              init: this.value().estree(ctx),
            }
          ]
        }
    }
  }
});

baseEnv.defmacro('let', function(name, value) {
  return $let_statement.new({
    name: $arg_ref.new({ name }),
    value
  });
});

export const $for_statement = $class.new({
  name: 'for_statement',
  super: $node,
  slots: {
    kind: $var.default('const'),
    it: $var.default('it'),
    iterable: $var.new(),
    body: $var.new(),
    estree(ctx) {
      return b.forOfStatement(
        b.variableDeclaration(this.kind(), [b.variableDeclarator($arg_ref.named(this.it()))]),
        this.iterable().estree(ctx),
        this.body().estree(ctx),
      )
    },
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
    estree(ctx) {
      return this.code();
    }
  }
});

export const $throws = $class.new({
  name: 'throws',
  super: $node,
  slots: {
    msg: $var.new(),
    estree(ctx) {
      return {
        type: 'ThrowStatement',
        argument: {
          type: 'NewExpression',
          callee: {
            type: 'Identifier',
            name: 'Error',
          },
          arguments: [
            {
              type: 'Literal',
              value: this.msg(),
            }
          ]
        }
      };
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
    body: $block.of(body)
  });
});

baseEnv.defmacro('test', function (...body) {
  return $function_statement.new({
    name: 'test',
    export: true,
    body: $block.of(body),
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
    //   receiver: $this_expression.new(),
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

export const $esm_cache = $class.new({
  name: 'esm-cache',
  desc: 'caches esm by content hash of js',
  slots: {
    cache: $var.default(() => ({})),
    hash(js) {
      return 'default'; // so it don't change
      const hash = createHash('md5');
      hash.update(js);
      return hash.digest('base64').replace(/\//g, '_');
    },
    async import(js) {
      const hash = this.hash(js);
      if (this.cache().contains(hash)) {
        return this.cache()[hash];
      } else {
        const path = `./out/${hash}.mjs`;
        writeFileSync(path, js);
        const mod = await import(path);
        this.cache()[hash] = mod;
        return mod;
      }
    }
  }
})

export const $evaluator = $class.new({
  name: 'evaluator',
  slots: {
    ctx: $var.new(),
    run(program) {
      const cache = $esm_cache.new();
      const js = this.prettify(program.estree(this.ctx()));
      return cache.import(js);
    },
    prettify(estree) {
      try {
        return prettyPrint(estree).code.replace(/\\n/g, '\n');
      } catch (e) {
        // console.log(JSON.stringify(estree, null, 1));
        throw e;
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
      return $$evl.run(node);
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
  m.$test();
} catch (e) {
  console.log(e);
}
