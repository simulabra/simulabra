import { __, base } from './base.js';

export default await async function (_, $, $$) {
  $$.Class.new({
    name: 'Case',
    slots: [
      $$.Method.new({
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
      $$.Var.new({ name: 'do' }),
      $$.Method.new({
        name: 'assert',
        do(statement, msg = '') {
          if (!statement) {
            throw new Error(`${this.description()}: assertion failed: ${msg}`);
          }
        }
      }),
      $$.Method.new({
        name: 'assertEq',
        do(a, b, msg = '') {
          if (a !== b) {
            throw new Error(`${this.description()}: assertEq failed (${a?.description()} !== ${b?.description()}) ${msg}`);
          }
        }
      }),
      $$.Method.new({
        name: 'assertErrorMessageIncludes',
        do(errorMessage, messageFragment) {
          if (!errorMessage.includes(messageFragment)) {
            throw new Error(`${this.description()}: Error message should include '${messageFragment}', got '${errorMessage}'`);
          }
        }
      }),
      $$.Method.new({
        name: 'assertThrows',
        do(fn, expectedErrorSubstring = '', msg = '') {
          let caught = false;
          let errorMessage = '';
          try {
            fn.apply(this);
          } catch (e) {
            caught = true;
            errorMessage = e.message;
            if (expectedErrorSubstring && !e.message.includes(expectedErrorSubstring)) {
              throw new Error(`${this.title()}: assertThrows failed. Expected error message to include "${expectedErrorSubstring}", but got: "${e.message}". ${msg}`);
            }
          }
          if (!caught) {
            throw new Error(`${this.title()}: assertThrows failed. Expected function to throw an error, but it did not. ${msg}`);
          }
          return errorMessage; // Optionally return message for further checks
        }
      }),
    ]
  });
  $$.Class.new({
    name: 'AsyncCase',
    slots: [
      $.Case,
      $$.Method.new({
        name: 'run',
        override: true,
        async do() {
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
}.module({
  name: 'test',
  imports: [base],
}).load();
