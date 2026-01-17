import { Database } from 'bun:sqlite';
import { __, base } from './base.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'SQLite',
    slots: [
      $.Static.new({
        name: 'createDatabase',
        do: function createDatabase(dbName) {
          return new Database(dbName);
        }
      }),
    ]
  });
  $.Class.new({
    name: 'DBVar',
    slots: [
      $.Var,
      $.Var.new({
        name: 'mutable',
        default: false,
      }),
      $.Var.new({
        name: 'primary',
        default: false,
      }),
      $.Var.new({
        name: 'createText',
        default: 'TEXT',
      }),
      $.Var.new({
        name: 'toSQL',
        default: () => function() { return this; },
      }),
      $.Var.new({
        name: 'fromSQL',
        default: () => function() { return this; },
      }),
    ]
  });

  $.Class.new({
    name: 'Persisted',
    slots: [
      _.DBVar.new({
        name: 'pid',
        doc: 'id in the db',
        primary: true,
        createText: 'INTEGER PRIMARY KEY AUTOINCREMENT',
      }),
      _.DBVar.new({
        name: 'created',
        toSQL() {
          return this ? this.toISOString() : null;
        },
        fromSQL() {
          return this ? new Date(this) : null;
        },
      }),
      $.Static.new({
        name: 'columns',
        do: function columns() {
          return this.allSlots().filter(slot => slot.class().descended(_.DBVar));
        }
      }),
      $.Method.new({
        name: 'columnReplacements',
        do: function columnReplacements(columns) {
            return Object.fromEntries(columns.map(col => (['$' + col.name, col.toSQL().apply(this[col.name]())])));
        }
      }),
      $.Static.new({
        name: 'table',
        do: function table() {
          return this.name;
        }
      }),
      $.Static.new({
        name: 'initDB',
        do: function initDB(db) {
          const createQuery = `CREATE TABLE IF NOT EXISTS ${this.table()} (${this.columns().map(col => col.name + ' ' + col.createText()).join(', ')})`;
          db.query(createQuery).run();
        }
      }),
      $.Method.new({
        name: 'save',
        do: function save(db) {
          const columns = this.class().columns();
          if (!this.pid()) {
            const insertcols = columns.filter(col => !col.primary());
            const insertSQL = `INSERT INTO ${this.class().table()} (${insertcols.map(ic => ic.name).join(', ')}) VALUES (${insertcols.map(ic => '$' + ic.name).join(', ')})`;
            const insertQuery = db.query(insertSQL);
            const result = insertQuery.run(this.columnReplacements(insertcols));
            this.pid(result.lastInsertRowid);
          } else {
            const mutablecols = columns.filter(col => col.mutable());
            const updateSQL = `UPDATE ${this.class().table()} SET ${mutablecols.map(mc => mc.name + ' = $' + mc.name).join(', ')} WHERE pid = $pid`;
            const query = db.query(updateSQL);
            const replacements = this.columnReplacements(mutablecols);
            replacements.$pid = this.pid();
            const result = query.run(replacements);
          }
          return this;
        }
      }),
      $.Static.new({
        name: 'loadAll',
        do: function loadAll(db) {
          const elems = db.query(`SELECT * FROM ${this.name}`).all();
          return elems.map(elem => {
            for (const col of Object.keys(elem)) {
              elem[col] = this.getslot(col).fromSQL().apply(elem[col]);
            }
            return this.new(elem);
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: 'RedisVar',
    doc: 'Variable slot with Redis serialization transforms',
    slots: [
      $.Var,
      $.Var.new({
        name: 'indexed',
        doc: 'whether to create secondary index for fast lookups',
        default: false,
      }),
      $.Var.new({
        name: 'searchable',
        doc: 'whether to enable full-text search via Redis Search',
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
    doc: 'Client for Redis operations including Search module',
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
        name: 'zAdd',
        doc: 'add member to sorted set with score',
        async do(key, score, member) {
          return await this.client().zAdd(key, { score, value: member });
        }
      }),
      $.Method.new({
        name: 'zRem',
        doc: 'remove member from sorted set',
        async do(key, member) {
          return await this.client().zRem(key, member);
        }
      }),
      $.Method.new({
        name: 'zRangeByScore',
        doc: 'get members by score range',
        async do(key, min, max) {
          return await this.client().zRangeByScore(key, min, max);
        }
      }),
      $.Method.new({
        name: 'streamAdd',
        doc: 'add entry to a Redis Stream',
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
        doc: 'read entries from a Redis Stream',
        async do(stream, start = '0', count = 100) {
          return await this.client().xRange(stream, start, '+', { COUNT: count });
        }
      }),
      $.Method.new({
        name: 'deleteByPattern',
        doc: 'delete all keys matching a pattern',
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
      $.Method.new({
        name: 'ftCreate',
        doc: 'create a Redis Search index',
        async do(indexName, schema, options = {}) {
          const args = ['FT.CREATE', indexName];
          if (options.prefix) {
            args.push('ON', 'HASH', 'PREFIX', '1', options.prefix);
          } else {
            args.push('ON', 'HASH');
          }
          args.push('SCHEMA');
          for (const [field, type] of Object.entries(schema)) {
            args.push(field, type);
          }
          try {
            return await this.client().sendCommand(args);
          } catch (e) {
            if (e.message?.includes('Index already exists')) {
              return 'EXISTS';
            }
            throw e;
          }
        }
      }),
      $.Method.new({
        name: 'ftDropIndex',
        doc: 'drop a Redis Search index',
        async do(indexName) {
          try {
            return await this.client().sendCommand(['FT.DROPINDEX', indexName]);
          } catch (e) {
            if (e.message?.includes('Unknown index name')) {
              return 'NOT_FOUND';
            }
            throw e;
          }
        }
      }),
      $.Method.new({
        name: 'ftSearch',
        doc: 'execute a Redis Search query',
        async do(indexName, query, options = {}) {
          const args = ['FT.SEARCH', indexName, query];
          if (options.limit !== undefined) {
            args.push('LIMIT', options.offset || 0, options.limit);
          }
          if (options.sortBy) {
            args.push('SORTBY', options.sortBy, options.sortOrder || 'ASC');
          }
          const result = await this.client().sendCommand(args);
          return this._parseFtSearchResult(result);
        }
      }),
      $.Method.new({
        name: '_parseFtSearchResult',
        doc: 'parse FT.SEARCH result into array of {key, fields}',
        do(result) {
          if (!result || result.length === 0) return [];
          const docs = [];
          for (let i = 1; i < result.length; i += 2) {
            const key = result[i];
            const fields = {};
            const fieldArray = result[i + 1];
            if (Array.isArray(fieldArray)) {
              for (let j = 0; j < fieldArray.length; j += 2) {
                fields[fieldArray[j]] = fieldArray[j + 1];
              }
            }
            docs.push({ key, fields });
          }
          return docs;
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
        doc: 'prefix for Redis keys - override in subclass for namespacing',
        do(redis) {
          const clientPrefix = redis?.keyPrefix?.() || '';
          return clientPrefix + this.name.toLowerCase();
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
        name: 'searchIndexName',
        doc: 'name of the Redis Search index for this class',
        do(redis) {
          return this.keyPrefix(redis) + ':idx';
        }
      }),
      $.Static.new({
        name: 'fieldIndexKey',
        doc: 'key for secondary index on a field',
        do(redis, fieldName, value) {
          return this.keyPrefix(redis) + ':by:' + fieldName + ':' + value;
        }
      }),
      $.Static.new({
        name: 'redisVars',
        doc: 'get all RedisVar slots',
        do() {
          return this.allSlots().filter(slot => slot.class().descended(_.RedisVar));
        }
      }),
      $.Static.new({
        name: 'indexedVars',
        doc: 'get RedisVar slots with indexed: true',
        do() {
          return this.redisVars().filter(slot => slot.indexed());
        }
      }),
      $.Static.new({
        name: 'searchableVars',
        doc: 'get RedisVar slots with searchable: true',
        do() {
          return this.redisVars().filter(slot => slot.searchable());
        }
      }),
      $.Static.new({
        name: 'ensureSearchIndex',
        doc: 'create Redis Search index for searchable fields',
        async do(redis) {
          const searchableVars = this.searchableVars();
          if (searchableVars.length === 0) return null;
          const schema = {};
          for (const varSlot of searchableVars) {
            schema[varSlot.name] = 'TEXT';
          }
          for (const varSlot of this.indexedVars()) {
            if (!schema[varSlot.name]) {
              schema[varSlot.name] = 'TAG';
            }
          }
          return await redis.ftCreate(
            this.searchIndexName(redis),
            schema,
            { prefix: this.keyPrefix(redis) + ':' }
          );
        }
      }),
      $.Static.new({
        name: 'search',
        doc: 'full-text search across searchable fields',
        async do(redis, query, options = {}) {
          const results = await redis.ftSearch(
            this.searchIndexName(redis),
            query,
            options
          );
          return results.map(doc => this.fromRedisHash(doc.fields));
        }
      }),
      $.Static.new({
        name: 'findByIndex',
        doc: 'find objects by indexed field value',
        async do(redis, fieldName, value) {
          const indexKey = this.fieldIndexKey(redis, fieldName, value);
          const ids = await redis.sMembers(indexKey);
          const results = [];
          for (const id of ids) {
            const obj = await this.findById(redis, id);
            if (obj) results.push(obj);
          }
          return results;
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
        name: '_updateSecondaryIndexes',
        doc: 'update secondary indexes for indexed fields',
        async do(redis, oldHash) {
          for (const varSlot of this.class().indexedVars()) {
            const newValue = this[varSlot.name]();
            const oldValue = oldHash?.[varSlot.name];
            const newTransformed = newValue != null ? varSlot.toRedis().apply(newValue) : null;
            const oldTransformed = oldValue != null ? varSlot.fromRedis().apply(oldValue) : null;
            if (oldTransformed !== newTransformed) {
              if (oldTransformed != null) {
                const oldIndexKey = this.class().fieldIndexKey(redis, varSlot.name, oldTransformed);
                await redis.sRem(oldIndexKey, this.rid());
              }
              if (newTransformed != null) {
                const newIndexKey = this.class().fieldIndexKey(redis, varSlot.name, newTransformed);
                await redis.sAdd(newIndexKey, this.rid());
              }
            }
          }
        }
      }),
      $.Method.new({
        name: '_removeFromSecondaryIndexes',
        doc: 'remove from all secondary indexes',
        async do(redis) {
          for (const varSlot of this.class().indexedVars()) {
            const value = this[varSlot.name]();
            if (value != null) {
              const transformed = varSlot.toRedis().apply(value);
              const indexKey = this.class().fieldIndexKey(redis, varSlot.name, transformed);
              await redis.sRem(indexKey, this.rid());
            }
          }
        }
      }),
      $.Method.new({
        name: 'save',
        doc: 'save object to Redis with index maintenance',
        async do(redis) {
          const now = new Date();
          const isNew = !this.rid();
          let oldHash = null;
          if (!isNew) {
            oldHash = await redis.hGetAll(this.redisKey(redis));
          }
          if (isNew) {
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
          await this._updateSecondaryIndexes(redis, oldHash);
          return this;
        }
      }),
      $.Method.new({
        name: 'delete',
        doc: 'delete object from Redis including indexes',
        async do(redis) {
          await this._removeFromSecondaryIndexes(redis);
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
  name: 'DB',
  imports: [base],
}).load();
