import { __, base } from '../../src/base.js';
import live from '../../src/live.js';

export default await async function (_, $, $base, $live) {
  $base.Class.new({
    name: 'DummyService',
    slots: [
      $live.LiveClass,
      $live.RpcMethod.new({
        name: 'bonk',
        do() {
          return 'oof, you hit a dummy!';
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
