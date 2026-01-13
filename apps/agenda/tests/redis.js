import { __, base } from 'simulabra';
import test from 'simulabra/test';
import redis from '../src/redis.js';

export default await async function (_, $, $test, $redis) {
  $test.AsyncCase.new({
    name: 'RedisClientConnect',
    doc: 'RedisClient should connect to Redis server',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();
      this.assert(client.connected(), 'should be connected');
      await client.disconnect();
      this.assert(!client.connected(), 'should be disconnected');
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientSetGet',
    doc: 'RedisClient should set and get values',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const key = `test:${crypto.randomUUID()}`;
      await client.set(key, JSON.stringify({ foo: 'bar' }));
      const value = await client.get(key);
      this.assertEq(JSON.parse(value).foo, 'bar');

      await client.del(key);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientStreamAdd',
    doc: 'RedisClient should add entries to streams',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const stream = `test:stream:${crypto.randomUUID()}`;
      const entryId = await client.streamAdd(stream, { type: 'test', data: 'hello' });
      this.assert(entryId, 'should return entry ID');

      await client.del(stream);
      await client.disconnect();
    }
  });

  $.Class.new({
    name: 'TestModel',
    doc: 'Test model for RedisPersisted tests',
    slots: [
      $redis.RedisPersisted,
      $redis.RedisVar.new({
        name: 'content',
        searchable: true,
      }),
      $redis.RedisVar.new({
        name: 'count',
        indexed: true,
        toRedis() { return String(this); },
        fromRedis() { return Number(this); },
      }),
      $redis.RedisVar.new({
        name: 'tags',
        default: () => [],
        toRedis() { return JSON.stringify(this); },
        fromRedis() { return JSON.parse(this); },
      }),
    ]
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedSave',
    doc: 'RedisPersisted should save objects to Redis',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const model = _.TestModel.new({
        content: 'hello world',
        count: 42,
        tags: ['test', 'sample']
      });

      await model.save(client);
      this.assert(model.rid(), 'should have a rid after save');

      await client.del(model.redisKey(client));
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedFindById',
    doc: 'RedisPersisted should find objects by id',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const model = _.TestModel.new({
        content: 'find me',
        count: 99,
        tags: ['findable']
      });
      await model.save(client);

      const found = await _.TestModel.findById(client, model.rid());
      this.assertEq(found.content(), 'find me');
      this.assertEq(found.count(), 99);
      this.assertEq(found.tags()[0], 'findable');

      await client.del(model.redisKey(client));
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedFindAll',
    doc: 'RedisPersisted should find all objects of a type',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const m1 = _.TestModel.new({ content: 'first', count: 1 });
      const m2 = _.TestModel.new({ content: 'second', count: 2 });
      await m1.save(client);
      await m2.save(client);

      const all = await _.TestModel.findAll(client);
      this.assert(all.length >= 2, 'should find at least 2 items');

      await client.del(m1.redisKey(client));
      await client.del(m2.redisKey(client));
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedUpdate',
    doc: 'RedisPersisted should update existing objects',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const model = _.TestModel.new({ content: 'original', count: 1 });
      await model.save(client);
      const originalId = model.rid();

      model.content('updated');
      model.count(2);
      await model.save(client);

      this.assertEq(model.rid(), originalId, 'rid should not change');

      const found = await _.TestModel.findById(client, originalId);
      this.assertEq(found.content(), 'updated');
      this.assertEq(found.count(), 2);

      await client.del(model.redisKey(client));
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedDelete',
    doc: 'RedisPersisted should delete objects',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const model = _.TestModel.new({ content: 'to delete', count: 0 });
      await model.save(client);
      const key = model.redisKey(client);

      await model.delete(client);

      const found = await _.TestModel.findById(client, model.rid());
      this.assert(!found, 'should not find deleted model');

      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedNullFieldClearing',
    doc: 'RedisPersisted should clear fields when set to null',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const model = _.TestModel.new({
        content: 'test content',
        count: 42,
        tags: ['a', 'b']
      });
      await model.save(client);

      const found1 = await _.TestModel.findById(client, model.rid());
      this.assertEq(found1.count(), 42, 'count should be 42');
      this.assertEq(found1.tags().length, 2, 'should have 2 tags');

      model.count(null);
      model.tags(null);
      await model.save(client);

      const found2 = await _.TestModel.findById(client, model.rid());
      this.assert(found2.count() === undefined || found2.count() === null, 'count should be cleared');
      this.assert(found2.tags() === undefined || found2.tags() === null, 'tags should be cleared');

      await client.del(model.redisKey(client));
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientKeyPrefix',
    doc: 'RedisClient keyPrefix should namespace keys',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:prefix:'
      });
      await client.connect();

      const model = _.TestModel.new({ content: 'prefixed', count: 1 });
      await model.save(client);

      const key = model.redisKey(client);
      this.assert(key.startsWith('test:prefix:'), `key should start with prefix: ${key}`);

      const allKeys = await client.keys('test:prefix:*');
      this.assert(allKeys.length > 0, 'should find prefixed keys');

      await client.del(model.redisKey(client));
      await client.sRem(_.TestModel.indexKey(client), model.rid());
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientScan',
    doc: 'RedisClient scan should iterate keys without blocking',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:scan:'
      });
      await client.connect();

      await client.set('test:scan:a', '1');
      await client.set('test:scan:b', '2');
      await client.set('test:scan:c', '3');

      const keys = await client.scan('test:scan:*');
      this.assertEq(keys.length, 3, 'should find 3 keys via scan');

      await client.del('test:scan:a');
      await client.del('test:scan:b');
      await client.del('test:scan:c');
      await client.disconnect();
    }
  });
}.module({
  name: 'test.redis',
  imports: [base, test, redis],
}).load();
