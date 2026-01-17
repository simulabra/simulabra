import { __, base } from '../src/base.js';
import test from '../src/test.js';
import db from '../src/db.js';

export default await async function (_, $, $test, $db) {
  $.Class.new({
    name: 'Article',
    doc: 'Test model with searchable and indexed fields',
    slots: [
      $db.RedisPersisted,
      $db.RedisVar.new({
        name: 'title',
        searchable: true,
      }),
      $db.RedisVar.new({
        name: 'body',
        searchable: true,
      }),
      $db.RedisVar.new({
        name: 'category',
        indexed: true,
      }),
      $db.RedisVar.new({
        name: 'status',
        indexed: true,
      }),
      $db.RedisVar.new({
        name: 'viewCount',
        toRedis() { return String(this); },
        fromRedis() { return Number(this); },
      }),
    ]
  });

  $test.AsyncCase.new({
    name: 'RedisClientConnect',
    doc: 'RedisClient should connect and disconnect',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();
      this.assert(client.connected(), 'should be connected');
      await client.disconnect();
      this.assert(!client.connected(), 'should be disconnected');
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientBasicOps',
    doc: 'RedisClient should support get/set/del',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const key = `test:db:${crypto.randomUUID()}`;
      await client.set(key, 'hello');
      this.assertEq(await client.get(key), 'hello');
      await client.del(key);
      this.assertEq(await client.get(key), null);

      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedSaveAndFind',
    doc: 'RedisPersisted should save and find by id',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:db:'
      });
      await client.connect();

      const article = _.Article.new({
        title: 'Hello World',
        body: 'This is a test article',
        category: 'testing',
        viewCount: 42
      });
      await article.save(client);
      this.assert(article.rid(), 'should have rid');
      this.assert(article.createdAt(), 'should have createdAt');

      const found = await _.Article.findById(client, article.rid());
      this.assertEq(found.title(), 'Hello World');
      this.assertEq(found.category(), 'testing');
      this.assertEq(found.viewCount(), 42);

      await article.delete(client);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedFindAll',
    doc: 'RedisPersisted should find all objects',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:findall:'
      });
      await client.connect();

      const a1 = _.Article.new({ title: 'First', category: 'news' });
      const a2 = _.Article.new({ title: 'Second', category: 'blog' });
      await a1.save(client);
      await a2.save(client);

      const all = await _.Article.findAll(client);
      this.assertEq(all.length, 2);

      await a1.delete(client);
      await a2.delete(client);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedUpdate',
    doc: 'RedisPersisted should update existing objects',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:update:'
      });
      await client.connect();

      const article = _.Article.new({ title: 'Original', viewCount: 1 });
      await article.save(client);
      const originalRid = article.rid();

      article.title('Updated');
      article.viewCount(100);
      await article.save(client);

      this.assertEq(article.rid(), originalRid, 'rid unchanged');
      const found = await _.Article.findById(client, originalRid);
      this.assertEq(found.title(), 'Updated');
      this.assertEq(found.viewCount(), 100);

      await article.delete(client);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedSecondaryIndex',
    doc: 'indexed fields should enable findByIndex',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:idx:'
      });
      await client.connect();

      const a1 = _.Article.new({ title: 'Tech News', category: 'tech', status: 'published' });
      const a2 = _.Article.new({ title: 'Tech Review', category: 'tech', status: 'draft' });
      const a3 = _.Article.new({ title: 'Sports Update', category: 'sports', status: 'published' });
      await a1.save(client);
      await a2.save(client);
      await a3.save(client);

      const techArticles = await _.Article.findByIndex(client, 'category', 'tech');
      this.assertEq(techArticles.length, 2, 'should find 2 tech articles');

      const published = await _.Article.findByIndex(client, 'status', 'published');
      this.assertEq(published.length, 2, 'should find 2 published');

      await a1.delete(client);
      await a2.delete(client);
      await a3.delete(client);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedIndexUpdate',
    doc: 'changing indexed value should update secondary index',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:idxup:'
      });
      await client.connect();

      const article = _.Article.new({ title: 'Moving', category: 'alpha' });
      await article.save(client);

      let alphas = await _.Article.findByIndex(client, 'category', 'alpha');
      this.assertEq(alphas.length, 1);

      article.category('beta');
      await article.save(client);

      alphas = await _.Article.findByIndex(client, 'category', 'alpha');
      this.assertEq(alphas.length, 0, 'old index cleared');

      const betas = await _.Article.findByIndex(client, 'category', 'beta');
      this.assertEq(betas.length, 1, 'new index populated');

      await article.delete(client);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedDeleteRemovesIndexes',
    doc: 'delete should remove from secondary indexes',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:idxdel:'
      });
      await client.connect();

      const article = _.Article.new({ title: 'Ephemeral', category: 'temp' });
      await article.save(client);

      let temps = await _.Article.findByIndex(client, 'category', 'temp');
      this.assertEq(temps.length, 1);

      await article.delete(client);

      temps = await _.Article.findByIndex(client, 'category', 'temp');
      this.assertEq(temps.length, 0, 'index cleared after delete');

      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisSearchIndex',
    doc: 'searchable fields should enable full-text search (requires Redis Stack)',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:search:'
      });
      await client.connect();

      try {
        await client.ftDropIndex(_.Article.searchIndexName(client));
      } catch (e) {
        if (e.message?.includes('unknown command')) {
          this.tlog('Skipping: Redis Search module not available');
          await client.disconnect();
          return;
        }
        throw e;
      }
      await _.Article.ensureSearchIndex(client);

      const a1 = _.Article.new({
        title: 'JavaScript Tutorial',
        body: 'Learn about variables and functions',
        category: 'programming'
      });
      const a2 = _.Article.new({
        title: 'Python Guide',
        body: 'Explore Python programming basics',
        category: 'programming'
      });
      const a3 = _.Article.new({
        title: 'Cooking Tips',
        body: 'How to make delicious pasta',
        category: 'food'
      });
      await a1.save(client);
      await a2.save(client);
      await a3.save(client);

      await __.sleep(100);

      const jsResults = await _.Article.search(client, 'JavaScript');
      this.assertEq(jsResults.length, 1, 'should find JavaScript article');
      this.assertEq(jsResults[0].title(), 'JavaScript Tutorial');

      const progResults = await _.Article.search(client, 'programming');
      this.assertEq(progResults.length, 2, 'should find 2 programming articles');

      await a1.delete(client);
      await a2.delete(client);
      await a3.delete(client);
      await client.ftDropIndex(_.Article.searchIndexName(client));
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientHashOps',
    doc: 'RedisClient should support hash operations',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const key = `test:hash:${crypto.randomUUID()}`;
      await client.hSet(key, { field1: 'value1', field2: 'value2' });

      const hash = await client.hGetAll(key);
      this.assertEq(hash.field1, 'value1');
      this.assertEq(hash.field2, 'value2');

      await client.hDel(key, ['field1']);
      const remaining = await client.hGetAll(key);
      this.assertEq(remaining.field1, undefined);
      this.assertEq(remaining.field2, 'value2');

      await client.del(key);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientSetOps',
    doc: 'RedisClient should support set operations',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const key = `test:set:${crypto.randomUUID()}`;
      await client.sAdd(key, 'a');
      await client.sAdd(key, 'b');
      await client.sAdd(key, 'c');

      const members = await client.sMembers(key);
      this.assertEq(members.length, 3);
      this.assert(members.includes('a'));
      this.assert(members.includes('b'));

      await client.sRem(key, 'b');
      const remaining = await client.sMembers(key);
      this.assertEq(remaining.length, 2);
      this.assert(!remaining.includes('b'));

      await client.del(key);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientSortedSetOps',
    doc: 'RedisClient should support sorted set operations',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const key = `test:zset:${crypto.randomUUID()}`;
      await client.zAdd(key, 10, 'first');
      await client.zAdd(key, 20, 'second');
      await client.zAdd(key, 30, 'third');

      const range = await client.zRangeByScore(key, 15, 25);
      this.assertEq(range.length, 1);
      this.assertEq(range[0], 'second');

      await client.zRem(key, 'second');
      const afterRemove = await client.zRangeByScore(key, 0, 100);
      this.assertEq(afterRemove.length, 2);

      await client.del(key);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientStreamOps',
    doc: 'RedisClient should support stream operations',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const stream = `test:stream:${crypto.randomUUID()}`;
      await client.streamAdd(stream, { event: 'click', target: 'button1' });
      await client.streamAdd(stream, { event: 'view', target: 'page1' });

      const entries = await client.streamRead(stream, '0', 10);
      this.assertEq(entries.length, 2);
      this.assertEq(entries[0].message.event, 'click');
      this.assertEq(entries[1].message.event, 'view');

      await client.del(stream);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisClientScan',
    doc: 'RedisClient scan should iterate keys safely',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const prefix = `test:scan:${crypto.randomUUID()}`;
      await client.set(`${prefix}:a`, '1');
      await client.set(`${prefix}:b`, '2');
      await client.set(`${prefix}:c`, '3');

      const keys = await client.scan(`${prefix}:*`);
      this.assertEq(keys.length, 3);

      await client.deleteByPattern(`${prefix}:*`);
      await client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'RedisPersistedNullFieldClearing',
    doc: 'setting field to null should clear it in Redis',
    async do() {
      const client = $db.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'test:null:'
      });
      await client.connect();

      const article = _.Article.new({
        title: 'With Category',
        category: 'test',
        viewCount: 10
      });
      await article.save(client);

      let found = await _.Article.findById(client, article.rid());
      this.assertEq(found.category(), 'test');

      article.category(null);
      await article.save(client);

      found = await _.Article.findById(client, article.rid());
      this.assert(found.category() === undefined, 'category should be cleared');

      await article.delete(client);
      await client.disconnect();
    }
  });
}.module({
  name: 'test.db',
  imports: [base, test, db],
}).load();
