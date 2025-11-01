import { __, base } from '../../src/base.js';
import live from '../../src/live.js';
import service from './service.js';

export default await async function (_, $, $base, $live, $service) {
  $base.Class.new({
    name: 'DummyClient',
    slots: [
      $live.LiveClass,
    ]
  });
  if (require.main === module) {
    const client = $.DummyClient.new();
    await __.sleep(100);
    await client.connect();
    const service = await client.serviceProxy($service.DummyService);
    const response = await service.bonk();
    console.log(response);
  }
}.module({
  name: 'dummy',
  imports: [base, live, service],
}).load();
