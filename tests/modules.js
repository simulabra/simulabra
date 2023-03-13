import bootstrap from '../base.js';
var __ = bootstrap();
import test_mod from '../test.js';
let base_mod = __.mod();
__.new_module({
  name: 'test-classes',
  imports: [base_mod, test_mod],
  on_load(_, $) {
    const a_mod = __.new_module({
      name: 'test-a',
      imports: [base_mod],
      on_load(_, $) {
        $.class.new({
          name: 'a',
          components: [
            $.var.new({
              name: 'x',
              default: 1,
            }),
            $.method.new({
              name: 'frob',
              do() {
                this.x(this.x() * 3);
              }
            })
          ]
        })
      }
    });
    const b_mod = __.new_module({
      name: 'test-b',
      imports: [base_mod, a_mod],
      on_load(_, $) {
        $.class.new({
          name: 'b',
          components: [
            $.a,
            $.after.new({
              name: 'frob',
              do() {
                this.x(this.x() - 1);
              }
            })
          ]
        })
      }
    });

    $.case.new({
      name: 'module-inheritance',
      do() {
        const binst = b_mod.$().b.new();
        binst.frob();
        binst.frob();
        this.assert_eq(binst.x(), 5);
      }
    });
  }
});
