import base from '../src/base.js';
import test from '../src/test.js';
const __ = globalThis.SIMULABRA;

export default await base.find('Class', 'Module').new({
  name: 'brainfuck_interpreter',
  imports: [base, test],
  registry: base.find('Class', 'object_registry').new(),
  on_load(_, $) {
    $.Class.new({
      name: 'brainfuck_interpreter',
      slots: [
        $.var.new({ name: 'code', default: '' }),
        $.var.new({ name: 'input', default: '' }),
        $.var.new({ name: 'output', default: '' }),
        $.var.new({ name: 'data', default: () => Array(30000).fill(0) }),
        $.var.new({ name: 'dataPtr', default: 0 }),
        $.var.new({ name: 'codePtr', default: 0 }),
        $.var.new({ name: 'inputPtr', default: 0 }),
        $.method.new({
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
    $.case.new({
      name: 'interpreter_init',
      do() {
        const bf = $.brainfuck_interpreter.new({ code: '++.' });
        this.assert_eq(bf.code(), '++.');
      }
    });

    // Test: Simple brainfuck program execution
    $.case.new({
      name: 'interpreter_exec_simple',
      do() {
        const bf = $.brainfuck_interpreter.new({ code: '++.' });
        bf.execute();
        this.assert_eq(bf.output(), String.fromCharCode(2));
      }
    });

    // Test: Brainfuck program execution with loops
    $.case.new({
      name: 'interpreter_exec_loops',
      do() {
        const bf = $.brainfuck_interpreter.new({ code: '++[>++<-]>.' });
        bf.execute();
        this.assert_eq(bf.output(), String.fromCharCode(4));
      }
    });

    // Test: Brainfuck program execution with input
    $.case.new({
      name: 'interpreter_exec_input',
      do() {
        const bf = $.brainfuck_interpreter.new({ code: ',+.', input: String.fromCharCode(2) });
        bf.execute();
        this.assert_eq(bf.output(), String.fromCharCode(3));
      }
    });

    // Test: Hello World!
    $.case.new({
      name: 'interpreter_hello_world',
      do() {
        const bf = $.brainfuck_interpreter.new({
          code: '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.',
        });
        bf.execute();
        this.assert_eq(bf.output(), "Hello World!\n");
      }
    });
  }
}).load();
