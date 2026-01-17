import { __, base } from 'simulabra';
import db from 'simulabra/db';

export default await async function (_, $, $db) {
  const mod = __.mod();
  mod.def('RedisVar', $db.RedisVar);
  mod.def('RedisClient', $db.RedisClient);

  $.Class.new({
    name: 'RedisPersisted',
    doc: 'Agenda-specific RedisPersisted with agenda: key prefix',
    slots: [
      $db.RedisPersisted,
      $.Static.new({
        name: 'keyPrefix',
        doc: 'prefix for Redis keys with agenda namespace',
        do(redis) {
          const clientPrefix = redis?.keyPrefix?.() || '';
          return clientPrefix + 'agenda:' + this.name.toLowerCase();
        }
      }),
    ]
  });
}.module({
  name: 'redis',
  imports: [base, db],
}).load();
