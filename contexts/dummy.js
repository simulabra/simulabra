import { __, base } from '../src/base.js';
import live from '../src/live.js';

export default await async function (_, $, $base, $live) {
  const host = process.env['SIMULABRA_HOST'];
  const client = $live.WebsocketClient.new();
  client.connect(host);
  $base.Class.new({
    name: 'DummyService',
    slots: [
      $base.Method.new({
        name: 'bonk',
        do() {
          return 'oof, you hit a dummy!';
        }
      })
    ]
  });
  const dummy = $.DummyService.new();
  client.register('dummy', dummy);
}.module({
  name: 'leader',
  imports: [base, live],
}).load();
