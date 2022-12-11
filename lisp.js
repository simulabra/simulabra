// now, what if it were a lisp machine?
import { Class, Var, Method } from './base.js';

const ex = `
($defclass todo-item {
	[static {
		($var id-counter {
			[default 0]
		})
		($method create (%text) ~todo-item (
			(.id-counter ((.id-counter).+ 1))
			>(.new {
				[text %text]
				[num (.id-counter)]
			})
		))
	}]
	[slots {
		($var text {[type !html]})
		; safe to inject name at this level?
		[text (~var.new {[type !html]})]
		($var num {[type !number]})
	}]
})
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
    token: Method.new({
      do: function token() {
        const c = this.chomp();
        if ('(){}[]>'.includes(c)) {
          return this.toks().push(c);
        }
        if (' \n\t'.includes(c)) {
          return;
        }
        if (/[\$\.%~!a-z]/.test(c)) {
          return this.toks().push(this.readToTerminal(c));
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


const l = Lexer.new({ code: ex });
l.tokenize();
console.log(l.toks());
