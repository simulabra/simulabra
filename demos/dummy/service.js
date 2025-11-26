import { __, base } from '../../src/base.js';
import live from '../../src/live.js';

export default await async function (_, $, $$, $live) {
  $$.Class.new({
    name: 'DummyService',
    slots: [
      $live.NodeClient,
      $$.Var.new({
        name: 'bonks',
        default: 0
      }),
      $live.RpcMethod.new({
        name: 'bonk',
        do() {
          this._bonks++;
          return `oof, you hit a dummy ${this._bonks} times!`;
        }
      })
    ]
  });

  if (require.main === module) {
    await __.sleep(50);
    const dummy = $.DummyService.new({ uid: 'DummyService' });
    await dummy.connect();
  }
}.module({
  name: 'dummy',
  imports: [base, live],
}).load();
