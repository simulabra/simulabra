import { __, base } from '../../src/base.js';
import live from '../../src/live.js';

export default await async function (_, $, $base, $live) {
  $base.Class.new({
    name: 'DummyClient',
    slots: [
      $live.NodeClient,
      $base.Constant.new({
        name: 'id',
        value: 'dummy-client'
      }),
    ]
  });
  const client = $.DummyClient.new();
  await __.sleep(100);
  await client.connect();
  const service = await client.serviceProxy('dummy-service');
  const response = await service.bonk();
  console.log(response);
}.module({
  name: 'dummy',
  imports: [base, live],
}).load();
