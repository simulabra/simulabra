import { __, base } from '../../src/base.js';
import live from '../../src/live.js';

export default await async function (_, $, $base, $live) {
  $base.Class.new({
    name: 'DummyService',
    slots: [
      $live.NodeClient,
      $base.Constant.new({
        name: 'localname',
        value: 'dummy-service'
      }),
      $base.Method.new({
        name: 'bonk',
        do() {
          return 'oof, you hit a dummy!';
        }
      })
    ]
  });
  const dummy = $.DummyService.new();
  await dummy.connect();
}.module({
  name: 'dummy',
  imports: [base, live],
}).load();
