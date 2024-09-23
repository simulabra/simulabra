import base from './base.js';
var __ = globalThis.SIMULABRA;

export default await base.find('Class', 'Module').new({
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
          name: 'assertEq',
          do(a, b) {
            if (a !== b) {
              throw new Error(`assertion failed: ${a?.description()} !== ${b?.description()}`);
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
