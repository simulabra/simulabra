import bootstrap from '../base.js';
var __ = bootstrap();
import test_mod from '../test.js';
let base_mod = __.mod();
export default __.new_module({
  name: 'test-modules',
  imports: [base_mod, test_mod],
  async on_load(_, $) {
    const a_mod = $.module.new({
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
    await a_mod.load();
    const b_mod = $.module.new({
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
    await b_mod.load();

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
