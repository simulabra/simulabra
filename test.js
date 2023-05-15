import base from './base.js';
import lang from './lang.js';
var __ = globalThis.SIMULABRA;

export default base.find('class', 'module').new({
  name: 'test',
  imports: [base, lang],
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
              this.log('passed');
            } catch (e) {
              // demands a native error class?
              this.log('failed');
              throw e;
            }
          }
        }),
        $.var.new({ name: 'do' }),
        $.method.new({
          name: 'assert-eq',
          do(a, b) {
            if (a !== b) {
              throw new Error(`assertion failed: ${a?.description()} !== ${b?.description()}`);
            }
          }
        })
      ]
    });
    $.class.new({
      name: 'async-case',
      components: [
        $.case,
        $.method.new({
          name: 'run',
          do() {
            try {
              this.do().apply(this);
              this.log('passed');
            } catch (e) {
              // demands a native error class?
              this.log('failed');
              throw e;
            }
          }
        }),
        $.var.new({ name: 'do' }),
        $.method.new({
          name: 'assert-eq',
          do(a, b) {
            if (a !== b) {
              this.log('neq', JSON.stringify(a), JSON.stringify(b));
              throw new Error(`assertion failed: ${a.description()} !== ${b.description()}`);
            }
          }
        })
      ]
    });
  },
});
