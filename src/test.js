import base from './base.js';
var __ = globalThis.SIMULABRA;

export default await __.$().Module.new({
  name: 'test',
  imports: [base],
  on_load(_, $) {
    $.Class.new({
      name: 'Case',
      slots: [
        $.Method.new({
          name: 'run',
          do() {
            try {
              this.do().apply(this);
              // this.log('passed');
            } catch (e) {
              // demands a native error class?
              this.log('failed');
              throw e;
            }
          }
        }),
        $.Var.new({ name: 'do' }),
        $.Method.new({
          name: 'assert',
          do(statement, msg = '') {
            if (!statement) {
              throw new Error(`${this.description()}: assertion failed: ${msg}`);
            }
          }
        }),
        $.Method.new({
          name: 'assertEq',
          do(a, b, msg = '') {
            if (a !== b) {
              throw new Error(`${this.description()}: assertEq failed (${a?.description()} !== ${b?.description()}) ${msg}`);
            }
          }
        }),
        $.Method.new({
          name: 'assertErrorMessageIncludes',
          do(errorMessage, messageFragment) {
            if (!errorMessage.includes(messageFragment)) {
              throw new Error(`${this.description()}: Error message should include '${messageFragment}', got '${errorMessage}'`);
            }
          }
        })
      ]
    });
    $.Class.new({
      name: 'AsyncCase',
      slots: [
        $.Case,
        $.Method.new({
          name: 'run',
          override: true,
          do() {
            try {
              return this.do().apply(this);
              // this.log('passed');
            } catch (e) {
              // demands a native error class?
              this.log('failed');
              throw e;
            }
          }
        }),
      ]
    });
  },
}).load();
