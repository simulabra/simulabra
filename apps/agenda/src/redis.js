import { __, base } from 'simulabra';

export default await async function (_, $) {
  $.Class.new({
    name: 'RedisVar',
    doc: 'Variable slot with Redis serialization transforms',
    slots: [
      $.Var,
      $.Var.new({
        name: 'indexed',
        doc: 'whether to index this field for queries',
        default: false,
      }),
      $.Var.new({
        name: 'searchable',
        doc: 'whether to enable full-text search on this field',
        default: false,
      }),
      $.Var.new({
        name: 'toRedis',
        doc: 'transform value for Redis storage',
        default: () => function() { return this; },
      }),
      $.Var.new({
        name: 'fromRedis',
        doc: 'transform value from Redis storage',
        default: () => function() { return this; },
      }),
    ]
  });

  $.Class.new({
    name: 'RedisClient',
    doc: 'Client for Redis operations',
    slots: [
      $.Var.new({ name: 'url', default: 'redis://localhost:6379' }),
      $.Var.new({ name: 'client' }),
      $.Var.new({ name: 'connected', default: false }),
      $.Var.new({
        name: 'keyPrefix',
        doc: 'prefix for all keys (for test isolation or namespacing)',
        default: '',
      }),
      $.Method.new({
        name: 'connect',
        async do() {
          const { createClient } = await import('redis');
          this.client(createClient({ url: this.url() }));
          this.client().on('error', err => this.tlog('Redis error:', err));
          await this.client().connect();
          this.connected(true);
        }
      }),
      $.Method.new({
        name: 'disconnect',
        async do() {
          if (this.client()) {
            await this.client().quit();
            this.connected(false);
          }
        }
      }),
      $.Method.new({
        name: 'get',
        async do(key) {
          return await this.client().get(key);
        }
      }),
      $.Method.new({
        name: 'set',
        async do(key, value) {
          return await this.client().set(key, value);
        }
      }),
      $.Method.new({
        name: 'del',
        async do(key) {
          return await this.client().del(key);
        }
      }),
      $.Method.new({
        name: 'hSet',
        async do(key, fields) {
          return await this.client().hSet(key, fields);
        }
      }),
      $.Method.new({
        name: 'hGetAll',
        async do(key) {
          return await this.client().hGetAll(key);
        }
      }),
      $.Method.new({
        name: 'hDel',
        doc: 'delete fields from a hash',
        async do(key, fields) {
          if (fields.length === 0) return 0;
          return await this.client().hDel(key, fields);
        }
      }),
      $.Method.new({
        name: 'keys',
        async do(pattern) {
          return await this.client().keys(pattern);
        }
      }),
      $.Method.new({
        name: 'scan',
        doc: 'iterate keys matching pattern using cursor (scalable alternative to KEYS)',
        async do(pattern, count = 100) {
          const results = [];
          let cursor = 0;
          do {
            const reply = await this.client().scan(cursor, { MATCH: pattern, COUNT: count });
            cursor = reply.cursor;
            results.push(...reply.keys);
          } while (cursor !== 0);
          return results;
        }
      }),
      $.Method.new({
        name: 'sAdd',
        async do(key, member) {
          return await this.client().sAdd(key, member);
        }
      }),
      $.Method.new({
        name: 'sRem',
        async do(key, member) {
          return await this.client().sRem(key, member);
        }
      }),
      $.Method.new({
        name: 'sMembers',
        async do(key) {
          return await this.client().sMembers(key);
        }
      }),
      $.Method.new({
        name: 'streamAdd',
        doc: 'Add entry to a Redis Stream',
        async do(stream, data) {
          const fields = {};
          for (const [k, v] of Object.entries(data)) {
            fields[k] = typeof v === 'string' ? v : JSON.stringify(v);
          }
          return await this.client().xAdd(stream, '*', fields);
        }
      }),
      $.Method.new({
        name: 'streamRead',
        doc: 'Read entries from a Redis Stream',
        async do(stream, start = '0', count = 100) {
          return await this.client().xRange(stream, start, '+', { COUNT: count });
        }
      }),
      $.Method.new({
        name: 'deleteByPattern',
        doc: 'Delete all keys matching a pattern',
        async do(pattern) {
          const keys = await this.keys(pattern);
          if (keys.length > 0) {
            for (const key of keys) {
              await this.del(key);
            }
          }
          return keys.length;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'RedisPersisted',
    doc: 'Mixin for Redis-persisted objects',
    slots: [
      _.RedisVar.new({
        name: 'rid',
        doc: 'UUID primary key for Redis',
      }),
      _.RedisVar.new({
        name: 'createdAt',
        doc: 'creation timestamp',
        toRedis() { return this ? this.toISOString() : null; },
        fromRedis() { return this ? new Date(this) : null; },
      }),
      _.RedisVar.new({
        name: 'updatedAt',
        doc: 'last update timestamp',
        toRedis() { return this ? this.toISOString() : null; },
        fromRedis() { return this ? new Date(this) : null; },
      }),
      $.Static.new({
        name: 'keyPrefix',
        doc: 'prefix for Redis keys (takes redis client for its keyPrefix)',
        do(redis) {
          const clientPrefix = redis?.keyPrefix?.() || '';
          return clientPrefix + 'agenda:' + this.name.toLowerCase();
        }
      }),
      $.Static.new({
        name: 'indexKey',
        doc: 'key for the set of all ids',
        do(redis) {
          return this.keyPrefix(redis) + ':ids';
        }
      }),
      $.Static.new({
        name: 'redisVars',
        doc: 'get all RedisVar slots',
        do() {
          return this.allSlots().filter(slot => slot.class().descended(_.RedisVar));
        }
      }),
      $.Method.new({
        name: 'redisKey',
        doc: 'get the Redis key for this object',
        do(redis) {
          return this.class().keyPrefix(redis) + ':' + this.rid();
        }
      }),
      $.Method.new({
        name: 'toRedisHash',
        doc: 'serialize to Redis hash fields, returns { hash, nullFields }',
        do() {
          const hash = {};
          const nullFields = [];
          for (const varSlot of this.class().redisVars()) {
            const value = this[varSlot.name]();
            if (value === undefined || value === null) {
              nullFields.push(varSlot.name);
            } else {
              const transformed = varSlot.toRedis().apply(value);
              hash[varSlot.name] = typeof transformed === 'string'
                ? transformed
                : JSON.stringify(transformed);
            }
          }
          return { hash, nullFields };
        }
      }),
      $.Static.new({
        name: 'fromRedisHash',
        doc: 'deserialize from Redis hash fields',
        do(hash) {
          const data = {};
          for (const varSlot of this.redisVars()) {
            const rawValue = hash[varSlot.name];
            if (rawValue !== undefined && rawValue !== null) {
              data[varSlot.name] = varSlot.fromRedis().apply(rawValue);
            }
          }
          return this.new(data);
        }
      }),
      $.Method.new({
        name: 'save',
        doc: 'save object to Redis (properly handles null field clearing)',
        async do(redis) {
          const now = new Date();
          if (!this.rid()) {
            this.rid(crypto.randomUUID());
            this.createdAt(now);
          }
          this.updatedAt(now);

          const { hash, nullFields } = this.toRedisHash();
          const key = this.redisKey(redis);
          if (Object.keys(hash).length > 0) {
            await redis.hSet(key, hash);
          }
          if (nullFields.length > 0) {
            await redis.hDel(key, nullFields);
          }
          await redis.sAdd(this.class().indexKey(redis), this.rid());
          return this;
        }
      }),
      $.Method.new({
        name: 'delete',
        doc: 'delete object from Redis',
        async do(redis) {
          await redis.del(this.redisKey(redis));
          await redis.sRem(this.class().indexKey(redis), this.rid());
          return this;
        }
      }),
      $.Static.new({
        name: 'findById',
        doc: 'find object by id',
        async do(redis, id) {
          const key = this.keyPrefix(redis) + ':' + id;
          const hash = await redis.hGetAll(key);
          if (!hash || Object.keys(hash).length === 0) {
            return null;
          }
          return this.fromRedisHash(hash);
        }
      }),
      $.Static.new({
        name: 'findAll',
        doc: 'find all objects of this type',
        async do(redis) {
          const ids = await redis.sMembers(this.indexKey(redis));
          const results = [];
          for (const id of ids) {
            const obj = await this.findById(redis, id);
            if (obj) {
              results.push(obj);
            }
          }
          return results;
        }
      }),
    ]
  });
}.module({
  name: 'redis',
  imports: [base],
}).load();
