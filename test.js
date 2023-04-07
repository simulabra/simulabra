import bootstrap from './base.js';
var __ = bootstrap();
import lisp_mod from './lisp2.js';
let base_mod = __._base_mod;
export default __.new_module({
  name: 'test',
  imports: [base_mod, lisp_mod],
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
            } catch (e) {
              this.log('failed!!!');
              console.error(e);
              return;
            }
            this.log('passed');
          }
        }),
        $.var.new({ name: 'do' }),
        $.method.new({
          name: 'assert-eq',
          do(a, b) {
            if (a !== b) {
              this.log('neq', a, b)
              throw new Error(`assertion failed: ${a.description()} !== ${b.description()}`);
            }
          }
        })
      ]
    });

    $.class.new({
      name: 'test-module',
      components: [
        $.source_module,
        $.method.new({
          name: 'run-tests',
          do: function run_tests() {

          }
        })
      ]
    })
  },
});
