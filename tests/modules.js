import { __, base } from '../src/base.js';
import test from '../src/test.js';

export default await async function (_, $, $$, $test) {
  const a = function (_, $, $$) {
    $$.Class.new({
      name: 'A',
      slots: [
        $$.Var.new({
          name: 'x',
          default: 1,
        }),
        $$.Method.new({
          name: 'frob',
          do() {
            this.x(this.x() * 3);
          }
        }),
      ]
    });
  }.module({
    name: 'test.modules.a',
    imports: [base],
  });
  await a.load();
  const b = function (_, $, $$, $a) {
    $$.Class.new({
      name: 'B',
      slots: [
        $a.A,
        $$.After.new({
          name: 'frob',
          do() {
            this.x(this.x() - 1);
          }
        })
      ]
    });
  }.module({
    name: 'test.modules.b',
    imports: [base, a],
  });
  await b.load();

  $test.Case.new({
    name: 'module inheritance',
    do() {
      const binst = b.$().B.new();
      binst.frob();
      binst.frob();
      this.assertEq(binst.x(), 5);
    }
  });
}.module({
  name: 'test.modules',
  imports: [base, test],
}).load();
