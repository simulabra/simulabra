import bootstrap from './base.js';
var __ = bootstrap();
import lisp_mod from './lisp2.js';
let base_mod = __._base_mod;

export default base_mod.find('class', 'module').new({
  name: 'test',
  imports: [base_mod, lisp_mod],
  on_load(_, $) {
    $.class.new({
      name: 'case',
      components: [
        $.deffed,
        $.method.new({
          name: 'run',
          async: true,
          async do() {
            try {
              await this.do().apply(this);
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
