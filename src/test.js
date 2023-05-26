import base from './base.js';
var __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'test',
  imports: [base],
  on_load(_, $) {
    $.class.new({
      name: 'case',
      components: [
        $.deffed,
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
    $.class.new({
      name: 'async_case',
      components: [
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
