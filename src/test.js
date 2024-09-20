import base from './base.js';
var __ = globalThis.SIMULABRA;

export default await base.find('Class', 'Module').new({
  name: 'test',
  imports: [base],
  on_load(_, $) {
    $.Class.new({
      name: 'case',
      slots: [
        $.method.new({
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
        $.var.new({ name: 'do' }),
        $.method.new({
          name: 'assert_eq',
          do(a, b) {
            if (a !== b) {
              throw new Error(`assertion failed: ${a?.description()} !== ${b?.description()}`);
            }
          }
        })
      ]
    });
    $.Class.new({
      name: 'async_case',
      slots: [
        $.case,
        $.method.new({
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
