import { __, base } from '../src/base.js';
import test from '../src/test.js';

export default await async function (_, $, $$, $test) {
    $$.Class.new({
      name: 'BrainfuckInterpreter',
      slots: [
        $$.Var.new({ name: 'code', default: '' }),
        $$.Var.new({ name: 'input', default: '' }),
        $$.Var.new({ name: 'output', default: '' }),
        $$.Var.new({ name: 'data', default: () => Array(30000).fill(0) }),
        $$.Var.new({ name: 'dataPtr', default: 0 }),
        $$.Var.new({ name: 'codePtr', default: 0 }),
        $$.Var.new({ name: 'inputPtr', default: 0 }),

        $$.Method.new({
          name: 'handleGreaterThan',
          do() { this.dataPtr(this.dataPtr() + 1); }
        }),
        $$.Method.new({
          name: 'handleLessThan',
          do() { this.dataPtr(this.dataPtr() - 1); }
        }),
        $$.Method.new({
          name: 'handlePlus',
          do() { this.data()[this.dataPtr()]++; }
        }),
        $$.Method.new({
          name: 'handleMinus',
          do() { this.data()[this.dataPtr()]--; }
        }),
        $$.Method.new({
          name: 'handleDot',
          do() { this.output(this.output() + String.fromCharCode(this.data()[this.dataPtr()])); }
        }),
        $$.Method.new({
          name: 'handleComma',
          do() {
            this.data()[this.dataPtr()] = this.input().charCodeAt(this.inputPtr());
            this.inputPtr(this.inputPtr() + 1);
          }
        }),
        $$.Method.new({
          name: 'handleOpenBracket',
          do() {
            if (this.data()[this.dataPtr()] === 0) {
              let balance = 1;
              let ptr = this.codePtr();
              while (balance > 0) {
                ptr++;
                if (this.code()[ptr] === '[') balance++;
                if (this.code()[ptr] === ']') balance--;
              }
              this.codePtr(ptr); // Jump *to* the matching bracket
            }
          }
        }),
        $$.Method.new({
          name: 'handleCloseBracket',
          do() {
            if (this.data()[this.dataPtr()] !== 0) {
              let balance = 1;
              let ptr = this.codePtr();
              while (balance > 0) {
                ptr--;
                if (this.code()[ptr] === ']') balance++;
                if (this.code()[ptr] === '[') balance--;
              }
              this.codePtr(ptr); // Jump *to* the matching bracket
            }
          }
        }),

        $$.Method.new({
          name: 'execute',
          do() {
            const handlers = {
              '>': this.handleGreaterThan,
              '<': this.handleLessThan,
              '+': this.handlePlus,
              '-': this.handleMinus,
              '.': this.handleDot,
              ',': this.handleComma,
              '[': this.handleOpenBracket,
              ']': this.handleCloseBracket,
            };

            while (this.codePtr() < this.code().length) {
              const instruction = this.code()[this.codePtr()];
              const handler = handlers[instruction];

              if (handler) {
                handler.call(this);
              }

              this.codePtr(this.codePtr() + 1);
            }
          }
        }),
      ]
    });

    // --- Tests remain the same ---
    $test.Case.new({
      name: 'interpreter_init',
      do() {
        const bf = $.BrainfuckInterpreter.new({ code: '++.' });
        this.assertEq(bf.code(), '++.');
      }
    });

    $test.Case.new({
      name: 'interpreter_exec_simple',
      do() {
        const bf = $.BrainfuckInterpreter.new({ code: '++.' });
        bf.execute();
        this.assertEq(bf.output(), String.fromCharCode(2));
      }
    });

    $test.Case.new({
      name: 'interpreter_exec_loops',
      do() {
        const bf = $.BrainfuckInterpreter.new({ code: '++[>++<-]>.' });
        bf.execute();
        this.assertEq(bf.output(), String.fromCharCode(4));
      }
    });

    $test.Case.new({
      name: 'interpreter_exec_input',
      do() {
        const bf = $.BrainfuckInterpreter.new({ code: ',+.', input: String.fromCharCode(2) });
        bf.execute();
        this.assertEq(bf.output(), String.fromCharCode(3));
      }
    });

    $test.Case.new({
      name: 'interpreter_hello_world',
      do() {
        const bf = $.BrainfuckInterpreter.new({
          code: '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.',
        });
        bf.execute();
        this.assertEq(bf.output(), "Hello World!\n");
      }
    });
}.module({
  name: 'test.bf',
  imports: [base, test],
}).load();
