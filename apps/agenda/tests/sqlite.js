import { Database } from 'bun:sqlite';
import { __, base } from 'simulabra';
import test from 'simulabra/test';
import db from 'simulabra/db';
import sqlite from '../src/sqlite.js';

export default await async function (_, $, $test, $db, $sqlite) {
  const createTestDb = () => {
    const database = new Database(':memory:');
    const runner = $db.MigrationRunner.new({ db: database });
    for (const migration of $sqlite.AgendaMigrations.all()) {
      runner.register(migration);
    }
    runner.migrate();
    return database;
  };

  $.Class.new({
    name: 'TestModel',
    doc: 'Test model for SQLitePersisted tests',
    slots: [
      $db.SQLitePersisted,
      $db.DBVar.new({
        name: 'content',
        searchable: true,
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'count',
        indexed: true,
        mutable: true,
        toSQL() { return String(this); },
        fromSQL() { return Number(this); },
      }),
      $db.DBVar.new({
        name: 'tags',
        default: () => [],
        mutable: true,
        toSQL() { return JSON.stringify(this); },
        fromSQL() { return JSON.parse(this); },
      }),
    ]
  });

  $test.Case.new({
    name: 'MigrationRunner',
    doc: 'MigrationRunner should apply migrations',
    do() {
      const database = new Database(':memory:');
      const runner = $db.MigrationRunner.new({ db: database });
      for (const migration of $sqlite.AgendaMigrations.all()) {
        runner.register(migration);
      }

      const applied = runner.migrate();
      this.assertEq(applied, 5, 'should apply 5 migrations');

      const pending = runner.pending();
      this.assertEq(pending.length, 0, 'should have no pending migrations');

      database.close();
    }
  });

  $test.Case.new({
    name: 'MigrationIdempotent',
    doc: 'MigrationRunner should be idempotent',
    do() {
      const database = new Database(':memory:');
      const runner = $db.MigrationRunner.new({ db: database });
      for (const migration of $sqlite.AgendaMigrations.all()) {
        runner.register(migration);
      }

      runner.migrate();
      const secondRun = runner.migrate();
      this.assertEq(secondRun, 0, 'should not apply any migrations on second run');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLitePersistedSave',
    doc: 'SQLitePersisted should save objects',
    do() {
      const database = createTestDb();
      _.TestModel.initDB(database);

      const model = _.TestModel.new({
        content: 'hello world',
        count: 42,
        tags: ['test', 'sample']
      });

      model.save(database);
      this.assert(model.sid(), 'should have an id after save');
      this.assert(model.createdAt(), 'should have createdAt');
      this.assert(model.updatedAt(), 'should have updatedAt');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLitePersistedFindById',
    doc: 'SQLitePersisted should find objects by id',
    do() {
      const database = createTestDb();
      _.TestModel.initDB(database);

      const model = _.TestModel.new({
        content: 'find me',
        count: 99,
        tags: ['findable']
      });
      model.save(database);

      const found = _.TestModel.findById(database, model.sid());
      this.assertEq(found.content(), 'find me');
      this.assertEq(found.count(), 99);
      this.assertEq(found.tags()[0], 'findable');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLitePersistedFindAll',
    doc: 'SQLitePersisted should find all objects of a type',
    do() {
      const database = createTestDb();
      _.TestModel.initDB(database);

      const m1 = _.TestModel.new({ content: 'first', count: 1 });
      const m2 = _.TestModel.new({ content: 'second', count: 2 });
      m1.save(database);
      m2.save(database);

      const all = _.TestModel.findAll(database);
      this.assertEq(all.length, 2, 'should find 2 items');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLitePersistedUpdate',
    doc: 'SQLitePersisted should update existing objects',
    do() {
      const database = createTestDb();
      _.TestModel.initDB(database);

      const model = _.TestModel.new({ content: 'original', count: 1 });
      model.save(database);
      const originalId = model.sid();

      model.content('updated');
      model.count(2);
      model.save(database);

      this.assertEq(model.sid(), originalId, 'id should not change');

      const found = _.TestModel.findById(database, originalId);
      this.assertEq(found.content(), 'updated');
      this.assertEq(found.count(), 2);

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLitePersistedDelete',
    doc: 'SQLitePersisted should delete objects',
    do() {
      const database = createTestDb();
      _.TestModel.initDB(database);

      const model = _.TestModel.new({ content: 'to delete', count: 0 });
      model.save(database);
      const id = model.sid();

      model.delete(database);

      const found = _.TestModel.findById(database, id);
      this.assert(!found, 'should not find deleted model');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLiteStream',
    doc: 'SQLiteStream should append and read entries',
    do() {
      const database = createTestDb();

      const stream = $db.SQLiteStream.new({
        db: database,
        streamName: 'test:stream'
      });

      const id1 = stream.append({ type: 'event1', data: 'first' });
      const id2 = stream.append({ type: 'event2', data: 'second' });
      this.assert(id1, 'should return entry ID');
      this.assert(id2, 'should return entry ID');

      const entries = stream.readAfter(0, 100);
      this.assertEq(entries.length, 2, 'should have 2 entries');
      this.assertEq(entries[0].message.type, 'event1');
      this.assertEq(entries[1].message.data, 'second');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLiteStreamReadLatest',
    doc: 'SQLiteStream should read latest entries in reverse order',
    do() {
      const database = createTestDb();

      const stream = $db.SQLiteStream.new({
        db: database,
        streamName: 'test:stream2'
      });

      stream.append({ num: 1 });
      stream.append({ num: 2 });
      stream.append({ num: 3 });

      const latest = stream.readLatest(2);
      this.assertEq(latest.length, 2);
      this.assertEq(latest[0].message.num, 3, 'first should be newest');
      this.assertEq(latest[1].message.num, 2, 'second should be second newest');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLiteStreamReadAfter',
    doc: 'SQLiteStream should read entries after a given id',
    do() {
      const database = createTestDb();

      const stream = $db.SQLiteStream.new({
        db: database,
        streamName: 'test:stream3'
      });

      stream.append({ num: 1 });
      const entries1 = stream.readAfter(0, 100);
      const afterId = entries1[0].internalId;

      stream.append({ num: 2 });
      stream.append({ num: 3 });

      const newEntries = stream.readAfter(afterId, 100);
      this.assertEq(newEntries.length, 2);
      this.assertEq(newEntries[0].message.num, 2);
      this.assertEq(newEntries[1].message.num, 3);

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLiteStreamGetLastInternalId',
    doc: 'SQLiteStream should return last internal id for polling',
    do() {
      const database = createTestDb();

      const stream = $db.SQLiteStream.new({
        db: database,
        streamName: 'test:stream4'
      });

      const emptyId = stream.getLastInternalId();
      this.assertEq(emptyId, 0, 'empty stream should return 0');

      stream.append({ data: 'test' });
      const afterOne = stream.getLastInternalId();
      this.assert(afterOne > 0, 'should have positive id after append');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SQLiteStreamMultipleStreams',
    doc: 'SQLiteStream should isolate different stream names',
    do() {
      const database = createTestDb();

      const stream1 = $db.SQLiteStream.new({
        db: database,
        streamName: 'stream:one'
      });
      const stream2 = $db.SQLiteStream.new({
        db: database,
        streamName: 'stream:two'
      });

      stream1.append({ source: 'one' });
      stream1.append({ source: 'one' });
      stream2.append({ source: 'two' });

      const entries1 = stream1.readAfter(0, 100);
      const entries2 = stream2.readAfter(0, 100);

      this.assertEq(entries1.length, 2);
      this.assertEq(entries2.length, 1);
      this.assertEq(entries1[0].message.source, 'one');
      this.assertEq(entries2[0].message.source, 'two');

      database.close();
    }
  });

  $test.Case.new({
    name: 'MigrationRollback',
    doc: 'MigrationRunner should rollback migrations',
    do() {
      const database = new Database(':memory:');
      const runner = $db.MigrationRunner.new({ db: database });
      for (const migration of $sqlite.AgendaMigrations.all()) {
        runner.register(migration);
      }

      runner.migrate();
      const applied = runner.appliedVersions();
      this.assertEq(applied.length, 5);

      const rolled = runner.rollback();
      this.assertEq(rolled.version(), '005');

      const afterRollback = runner.appliedVersions();
      this.assertEq(afterRollback.length, 4);

      database.close();
    }
  });
}.module({
  name: 'test.sqlite',
  imports: [base, test, db, sqlite],
}).load();
