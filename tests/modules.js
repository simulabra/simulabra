import base from '../src/base.js';
import test from '../src/test.js';
const __ = globalThis.SIMULABRA;

export default await base.find('Class', 'Module').new({
  name: 'test-modules',
  imports: [base, test],
  registry: base.find('Class', 'object_registry').new(),
  async on_load(_, $) {
    const a = $.Module.new({
      name: 'test-a',
      imports: [base],
      on_load(_, $) {
        $.Class.new({
          name: 'a',
          slots: [
            $.Var.new({
              name: 'x',
              default: 1,
            }),
            $.Method.new({
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
    const b = $.Module.new({
      name: 'test-b',
      imports: [base, a],
      on_load(_, $) {
        $.Class.new({
          name: 'b',
          slots: [
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

    $.Case.new({
      name: 'module-inheritance',
      do() {
        const binst = b.$().b.new();
        binst.frob();
        binst.frob();
        this.assertEq(binst.x(), 5);
      }
    });
  }
}).load();
