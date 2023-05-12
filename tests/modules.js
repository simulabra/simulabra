import base from '../base.js';
import test from '../test.js';
const __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'test-modules',
  imports: [base, test],
  async on_load(_, $) {
    const a = $.module.new({
      name: 'test-a',
      imports: [base],
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
    await a.load();
    const b = $.module.new({
      name: 'test-b',
      imports: [base, a],
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
    await b.load();

    $.case.new({
      name: 'module-inheritance',
      do() {
        const binst = b.$().b.new();
        binst.frob();
        binst.frob();
        this.assert_eq(binst.x(), 5);
      }
    });
  }
}).load();
