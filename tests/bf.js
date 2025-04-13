import { __, base } from '../src/base.js';
import test from '../src/test.js';

export default await __.$().Module.new({
  name: 'test.bf',
  imports: [base, test],
  mod(_, $) {
    $.Class.new({
      name: 'BrainfuckInterpreter',
      slots: [
        $.Var.new({ name: 'code', default: '' }),
        $.Var.new({ name: 'input', default: '' }),
        $.Var.new({ name: 'output', default: '' }),
        $.Var.new({ name: 'data', default: () => Array(30000).fill(0) }),
        $.Var.new({ name: 'dataPtr', default: 0 }),
        $.Var.new({ name: 'codePtr', default: 0 }),
        $.Var.new({ name: 'inputPtr', default: 0 }),
        $.Method.new({
          name: 'execute',
          do() {
            while (this.codePtr() < this.code().length) {
              const instruction = this.code()[this.codePtr()];

              switch (instruction) {
                case '>':
                  this.dataPtr(this.dataPtr() + 1);
                  break;
                case '<':
                  this.dataPtr(this.dataPtr() - 1);
                  break;
                case '+':
                  this.data()[this.dataPtr()]++;
                  break;
                case '-':
                  this.data()[this.dataPtr()]--;
                  break;
                case '.':
                  this.output(this.output() + String.fromCharCode(this.data()[this.dataPtr()]));
                  break;
                case ',':
                  this.data()[this.dataPtr()] = this.input().charCodeAt(this.inputPtr());
                  this.inputPtr(this.inputPtr() + 1);
                  break;
                case '[':
                  if (this.data()[this.dataPtr()] === 0) {
                    let openBrackets = 1;
                    while (openBrackets > 0) {
                      this.codePtr(this.codePtr() + 1);
                      if (this.code()[this.codePtr()] === '[') openBrackets++;
                      if (this.code()[this.codePtr()] === ']') openBrackets--;
                    }
                  }
                  break;
                case ']':
                  if (this.data()[this.dataPtr()] !== 0) {
                    let closeBrackets = 1;
                    while (closeBrackets > 0) {
                      this.codePtr(this.codePtr() - 1);
                      if (this.code()[this.codePtr()] === ']') closeBrackets++;
                      if (this.code()[this.codePtr()] === '[') closeBrackets--;
                    }
                  }
                  break;
                default:
                  break;
              }

              this.codePtr(this.codePtr() + 1);
            }
          }
        }),
      ]
    });
    // Test: Basic brainfuck interpreter initialization
    $.Case.new({
      name: 'interpreter_init',
      do() {
        const bf = $.BrainfuckInterpreter.new({ code: '++.' });
        this.assertEq(bf.code(), '++.');
      }
    });

    // Test: Simple brainfuck program execution
    $.Case.new({
      name: 'interpreter_exec_simple',
      do() {
        const bf = $.BrainfuckInterpreter.new({ code: '++.' });
        bf.execute();
        this.assertEq(bf.output(), String.fromCharCode(2));
      }
    });

    // Test: Brainfuck program execution with loops
    $.Case.new({
      name: 'interpreter_exec_loops',
      do() {
        const bf = $.BrainfuckInterpreter.new({ code: '++[>++<-]>.' });
        bf.execute();
        this.assertEq(bf.output(), String.fromCharCode(4));
      }
    });

    // Test: Brainfuck program execution with input
    $.Case.new({
      name: 'interpreter_exec_input',
      do() {
        const bf = $.BrainfuckInterpreter.new({ code: ',+.', input: String.fromCharCode(2) });
        bf.execute();
        this.assertEq(bf.output(), String.fromCharCode(3));
      }
    });

    // Test: Hello World!
    $.Case.new({
      name: 'interpreter_hello_world',
      do() {
        const bf = $.BrainfuckInterpreter.new({
          code: '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.',
        });
        bf.execute();
        this.assertEq(bf.output(), "Hello World!\n");
      }
    });
  }
}).load();
