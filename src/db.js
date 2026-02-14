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
        name: 'indexed',
        doc: 'create SQLite index for fast lookups',
        default: false,
      }),
      $.Var.new({
        name: 'searchable',
        doc: 'include in FTS5 table for full-text search',
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
    name: 'SQLitePersisted',
    doc: 'Mixin for SQLite-persisted objects with UUID primary keys, timestamps, indexing and FTS5',
    slots: [
      _.DBVar.new({
        name: 'sid',
        doc: 'SQLite UUID primary key',
        primary: true,
        createText: 'TEXT PRIMARY KEY',
      }),
      _.DBVar.new({
        name: 'createdAt',
        doc: 'creation timestamp',
        toSQL() { return this ? this.toISOString() : null; },
        fromSQL() { return this ? new Date(this) : null; },
      }),
      _.DBVar.new({
        name: 'updatedAt',
        doc: 'last update timestamp',
        mutable: true,
        toSQL() { return this ? this.toISOString() : null; },
        fromSQL() { return this ? new Date(this) : null; },
      }),
      $.Static.new({
        name: 'tableName',
        doc: 'get the table name (override for custom prefix)',
        do() {
          return this.name;
        }
      }),
      $.Static.new({
        name: 'dbVars',
        doc: 'get all DBVar slots',
        do() {
          return this.allSlots().filter(slot => slot.class().descended(_.DBVar));
        }
      }),
      $.Static.new({
        name: 'indexedVars',
        doc: 'get DBVar slots with indexed: true',
        do() {
          return this.dbVars().filter(slot => slot.indexed());
        }
      }),
      $.Static.new({
        name: 'searchableVars',
        doc: 'get DBVar slots with searchable: true',
        do() {
          return this.dbVars().filter(slot => slot.searchable());
        }
      }),
      $.Static.new({
        name: 'initTable',
        doc: 'create the main table if not exists',
        do(db) {
          const columns = this.dbVars().map(col => col.name + ' ' + col.createText()).join(', ');
          db.query(`CREATE TABLE IF NOT EXISTS ${this.tableName()} (${columns})`).run();
        }
      }),
      $.Static.new({
        name: 'initIndexes',
        doc: 'create secondary indexes for indexed fields',
        do(db) {
          for (const varSlot of this.indexedVars()) {
            const indexName = `idx_${this.tableName()}_${varSlot.name}`;
            db.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${this.tableName()} (${varSlot.name})`).run();
          }
        }
      }),
      $.Static.new({
        name: 'initFTS',
        doc: 'create FTS5 virtual table for searchable fields',
        do(db) {
          const searchableVars = this.searchableVars();
          if (searchableVars.length === 0) return;
          const ftsTable = this.tableName() + '_fts';
          const columns = searchableVars.map(v => v.name).join(', ');
          db.query(`CREATE VIRTUAL TABLE IF NOT EXISTS ${ftsTable} USING fts5(sid, ${columns}, content='${this.tableName()}', content_rowid='rowid')`).run();
          const insertTrigger = `CREATE TRIGGER IF NOT EXISTS ${ftsTable}_ai AFTER INSERT ON ${this.tableName()} BEGIN
            INSERT INTO ${ftsTable}(rowid, sid, ${columns}) VALUES (NEW.rowid, NEW.sid, ${searchableVars.map(v => 'NEW.' + v.name).join(', ')});
          END`;
          const deleteTrigger = `CREATE TRIGGER IF NOT EXISTS ${ftsTable}_ad AFTER DELETE ON ${this.tableName()} BEGIN
            INSERT INTO ${ftsTable}(${ftsTable}, rowid, sid, ${columns}) VALUES ('delete', OLD.rowid, OLD.sid, ${searchableVars.map(v => 'OLD.' + v.name).join(', ')});
          END`;
          const updateTrigger = `CREATE TRIGGER IF NOT EXISTS ${ftsTable}_au AFTER UPDATE ON ${this.tableName()} BEGIN
            INSERT INTO ${ftsTable}(${ftsTable}, rowid, sid, ${columns}) VALUES ('delete', OLD.rowid, OLD.sid, ${searchableVars.map(v => 'OLD.' + v.name).join(', ')});
            INSERT INTO ${ftsTable}(rowid, sid, ${columns}) VALUES (NEW.rowid, NEW.sid, ${searchableVars.map(v => 'NEW.' + v.name).join(', ')});
          END`;
          try { db.query(insertTrigger).run(); } catch (e) { if (!e.message.includes('already exists')) throw e; }
          try { db.query(deleteTrigger).run(); } catch (e) { if (!e.message.includes('already exists')) throw e; }
          try { db.query(updateTrigger).run(); } catch (e) { if (!e.message.includes('already exists')) throw e; }
        }
      }),
      $.Static.new({
        name: 'initDB',
        doc: 'initialize table, indexes, and FTS',
        do(db) {
          this.initTable(db);
          this.initIndexes(db);
          this.initFTS(db);
        }
      }),
      $.Method.new({
        name: 'toSQLHash',
        doc: 'serialize to SQL hash fields',
        do() {
          const hash = {};
          for (const varSlot of this.class().dbVars()) {
            const value = this[varSlot.name]();
            if (value !== undefined && value !== null) {
              hash['$' + varSlot.name] = varSlot.toSQL().apply(value);
            } else {
              hash['$' + varSlot.name] = null;
            }
          }
          return hash;
        }
      }),
      $.Static.new({
        name: 'fromSQLRow',
        doc: 'deserialize from SQL row',
        do(row) {
          const data = {};
          for (const varSlot of this.dbVars()) {
            const rawValue = row[varSlot.name];
            if (rawValue !== undefined && rawValue !== null) {
              data[varSlot.name] = varSlot.fromSQL().apply(rawValue);
            }
          }
          return this.new(data);
        }
      }),
      $.Method.new({
        name: 'save',
        doc: 'save object to SQLite (insert or update)',
        do(db) {
          const now = new Date();
          const isNew = !this.sid();
          if (isNew) {
            this.sid(crypto.randomUUID());
            this.createdAt(now);
          }
          this.updatedAt(now);
          const dbVars = this.class().dbVars();
          const hash = this.toSQLHash();
          if (isNew) {
            const columns = dbVars.map(v => v.name).join(', ');
            const placeholders = dbVars.map(v => '$' + v.name).join(', ');
            db.query(`INSERT INTO ${this.class().tableName()} (${columns}) VALUES (${placeholders})`).run(hash);
          } else {
            const mutableVars = dbVars.filter(v => !v.primary());
            const setClause = mutableVars.map(v => v.name + ' = $' + v.name).join(', ');
            db.query(`UPDATE ${this.class().tableName()} SET ${setClause} WHERE sid = $sid`).run(hash);
          }
          return this;
        }
      }),
      $.Method.new({
        name: 'delete',
        doc: 'delete object from SQLite',
        do(db) {
          db.query(`DELETE FROM ${this.class().tableName()} WHERE sid = $sid`).run({ $sid: this.sid() });
          return this;
        }
      }),
      $.Static.new({
        name: 'findById',
        doc: 'find object by sid',
        do(db, sid) {
          const row = db.query(`SELECT * FROM ${this.tableName()} WHERE sid = $sid`).get({ $sid: sid });
          if (!row) return null;
          return this.fromSQLRow(row);
        }
      }),
      $.Static.new({
        name: 'findByIndex',
        doc: 'find objects by indexed field value',
        do(db, fieldName, value) {
          const varSlot = this.dbVars().find(v => v.name === fieldName);
          if (!varSlot) throw new Error(`Unknown field: ${fieldName}`);
          const sqlValue = varSlot.toSQL().apply(value);
          const rows = db.query(`SELECT * FROM ${this.tableName()} WHERE ${fieldName} = $value`).all({ $value: sqlValue });
          return rows.map(row => this.fromSQLRow(row));
        }
      }),
      $.Static.new({
        name: 'findAll',
        doc: 'find all objects of this type',
        do(db) {
          const rows = db.query(`SELECT * FROM ${this.tableName()}`).all();
          return rows.map(row => this.fromSQLRow(row));
        }
      }),
      $.Static.new({
        name: 'search',
        doc: 'full-text search across searchable fields',
        do(db, query) {
          const searchableVars = this.searchableVars();
          if (searchableVars.length === 0) {
            throw new Error(`${this.name} has no searchable fields`);
          }
          const ftsTable = this.tableName() + '_fts';
          const rows = db.query(`SELECT ${this.tableName()}.* FROM ${this.tableName()} JOIN ${ftsTable} ON ${this.tableName()}.sid = ${ftsTable}.sid WHERE ${ftsTable} MATCH $query`).all({ $query: query });
          return rows.map(row => this.fromSQLRow(row));
        }
      }),
      $.Method.new({
        name: 'jsonify',
        doc: 'serialize to JSON with sid renamed to id for clean API',
        do() {
          const json = this.class().jsonify(this);
          if ('sid' in json) {
            json.id = json.sid;
            delete json.sid;
          }
          return json;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'SQLiteStream',
    doc: 'Stream storage for events/chat using SQLite table',
    slots: [
      $.Var.new({ name: 'db' }),
      $.Var.new({ name: 'streamName' }),
      $.Var.new({ name: 'tableName', default: '_streams' }),
      $.Method.new({
        name: 'initTable',
        doc: 'create the streams table if not exists',
        do() {
          this.db().query(`CREATE TABLE IF NOT EXISTS ${this.tableName()} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            streamName TEXT NOT NULL,
            entryId TEXT NOT NULL,
            data TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            hidden INTEGER NOT NULL DEFAULT 0
          )`).run();
          this.db().query(`CREATE INDEX IF NOT EXISTS idx_streams_name_id ON ${this.tableName()} (streamName, id)`).run();
        }
      }),
      $.Method.new({
        name: 'append',
        doc: 'append data to stream, returns entryId',
        do(data) {
          const createdAt = new Date().toISOString();
          const entryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
          this.db().query(`INSERT INTO ${this.tableName()} (streamName, entryId, data, createdAt) VALUES ($streamName, $entryId, $data, $createdAt)`).run({
            $streamName: this.streamName(),
            $entryId: entryId,
            $data: jsonData,
            $createdAt: createdAt,
          });
          return entryId;
        }
      }),
      $.Method.new({
        name: 'hideEntries',
        doc: 'hide stream entries by internal ids',
        do(internalIds) {
          if (!internalIds || internalIds.length === 0) return 0;
          const placeholders = internalIds.map(() => '?').join(',');
          const result = this.db().query(`UPDATE ${this.tableName()} SET hidden = 1 WHERE streamName = ? AND id IN (${placeholders})`).run(this.streamName(), ...internalIds);
          return result.changes;
        }
      }),
      $.Method.new({
        name: 'hideEntriesSince',
        doc: 'hide stream entries created after a given ISO timestamp',
        do(sinceIso) {
          const result = this.db().query(`UPDATE ${this.tableName()} SET hidden = 1 WHERE streamName = $streamName AND createdAt >= $since`).run({
            $streamName: this.streamName(),
            $since: sinceIso,
          });
          return result.changes;
        }
      }),
      $.Method.new({
        name: 'readAfter',
        doc: 'read entries after a given internal id (for polling)',
        do(afterId = 0, limit = 100) {
          const rows = this.db().query(`SELECT id, entryId, data, createdAt FROM ${this.tableName()} WHERE streamName = $streamName AND id > $afterId AND hidden = 0 ORDER BY id ASC LIMIT $limit`).all({
            $streamName: this.streamName(),
            $afterId: afterId,
            $limit: limit,
          });
          return rows.map(row => ({
            internalId: row.id,
            id: row.entryId,
            message: JSON.parse(row.data),
            createdAt: row.createdAt,
          }));
        }
      }),
      $.Method.new({
        name: 'readLatest',
        doc: 'read latest entries (newest first)',
        do(limit = 100) {
          const rows = this.db().query(`SELECT id, entryId, data, createdAt FROM ${this.tableName()} WHERE streamName = $streamName AND hidden = 0 ORDER BY id DESC LIMIT $limit`).all({
            $streamName: this.streamName(),
            $limit: limit,
          });
          return rows.map(row => ({
            internalId: row.id,
            id: row.entryId,
            message: JSON.parse(row.data),
            createdAt: row.createdAt,
          }));
        }
      }),
      $.Method.new({
        name: 'getLastInternalId',
        doc: 'get the last internal id for polling',
        do() {
          const row = this.db().query(`SELECT MAX(id) as maxId FROM ${this.tableName()} WHERE streamName = $streamName`).get({ $streamName: this.streamName() });
          return row?.maxId || 0;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'Migration',
    doc: 'Database migration with version and up/down methods',
    slots: [
      $.Var.new({
        name: 'version',
        doc: 'migration version string (e.g., "001", "002")',
      }),
      $.Var.new({
        name: 'description',
        doc: 'human-readable description of the migration',
      }),
      $.Var.new({
        name: 'up',
        doc: 'function to apply the migration (receives db)',
      }),
      $.Var.new({
        name: 'down',
        doc: 'function to revert the migration (receives db, optional)',
      }),
    ]
  });

  $.Class.new({
    name: 'MigrationRunner',
    doc: 'Runs and tracks database migrations',
    slots: [
      $.Var.new({ name: 'db' }),
      $.Var.new({
        name: 'migrations',
        doc: 'array of Migration instances',
        default: () => [],
      }),
      $.Var.new({
        name: 'migrationsTable',
        default: '_migrations',
      }),
      $.Method.new({
        name: 'initMigrationsTable',
        doc: 'create the migrations tracking table',
        do() {
          this.db().query(`CREATE TABLE IF NOT EXISTS ${this.migrationsTable()} (
            version TEXT PRIMARY KEY,
            appliedAt TEXT NOT NULL,
            description TEXT
          )`).run();
        }
      }),
      $.Method.new({
        name: 'appliedVersions',
        doc: 'get list of already applied migration versions',
        do() {
          const rows = this.db().query(`SELECT version FROM ${this.migrationsTable()} ORDER BY version`).all();
          return rows.map(r => r.version);
        }
      }),
      $.Method.new({
        name: 'pending',
        doc: 'get migrations that have not been applied',
        do() {
          const applied = new Set(this.appliedVersions());
          return this.migrations().filter(m => !applied.has(m.version())).sort((a, b) => a.version().localeCompare(b.version()));
        }
      }),
      $.Method.new({
        name: 'migrate',
        doc: 'apply all pending migrations',
        do() {
          this.initMigrationsTable();
          const pending = this.pending();
          for (const migration of pending) {
            migration.up()(this.db());
            this.db().query(`INSERT INTO ${this.migrationsTable()} (version, appliedAt, description) VALUES ($version, $appliedAt, $description)`).run({
              $version: migration.version(),
              $appliedAt: new Date().toISOString(),
              $description: migration.description(),
            });
          }
          return pending.length;
        }
      }),
      $.Method.new({
        name: 'rollback',
        doc: 'rollback the most recent migration',
        do() {
          this.initMigrationsTable();
          const applied = this.appliedVersions();
          if (applied.length === 0) {
            this.tlog('no migrations to rollback');
            return null;
          }
          const lastVersion = applied[applied.length - 1];
          const migration = this.migrations().find(m => m.version() === lastVersion);
          if (!migration) {
            throw new Error(`Migration ${lastVersion} not found in migrations list`);
          }
          if (!migration.down()) {
            throw new Error(`Migration ${lastVersion} does not support rollback`);
          }
          this.tlog(`rolling back migration ${migration.version()}: ${migration.description()}`);
          migration.down()(this.db());
          this.db().query(`DELETE FROM ${this.migrationsTable()} WHERE version = $version`).run({ $version: lastVersion });
          return migration;
        }
      }),
      $.Method.new({
        name: 'register',
        doc: 'register a migration',
        do(migration) {
          this.migrations().push(migration);
          return this;
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
        name: 'streamReadAfter',
        doc: 'read entries strictly after an id (exclusive)',
        async do(stream, afterId, count = 100) {
          const start = afterId ? `(${afterId}` : '-';
          return await this.client().xRange(stream, start, '+', { COUNT: count });
        }
      }),
      $.Method.new({
        name: 'streamRevRange',
        doc: 'read entries from a Redis Stream in reverse order (newest first)',
        async do(stream, count = 100) {
          return await this.client().xRevRange(stream, '+', '-', { COUNT: count });
        }
      }),
      $.Method.new({
        name: 'streamReadBlock',
        doc: 'blocking read for new stream entries after a given id',
        async do(stream, afterId, timeoutMs = 5000, count = 100) {
          const id = afterId || '$';
          const result = await this.client().xRead(
            [{ key: stream, id }],
            { BLOCK: timeoutMs, COUNT: count }
          );
          if (!result || result.length === 0) return [];
          return result[0].messages;
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
