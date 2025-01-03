import { Database } from 'bun:sqlite';

const __ = globalThis.SIMULABRA;
export default await __.base().find('Class', 'Module').new({
  name: 'DB',
  doc: 'sqlite wrapper',
  imports: [__.base()],
  on_load(_, $) {
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
        $.DBVar.new({
          name: 'pid',
          doc: 'id in the db',
          primary: true,
          createText: 'INTEGER PRIMARY KEY AUTOINCREMENT',
        }),
        $.DBVar.new({
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
            return this.allSlots().filter(slot => slot.class().descended($.DBVar));
          }
        }),
        $.Method.new({
          name: 'columnReplacements',
          do: function columnReplacements(columns) {
              return Object.fromEntries(columns.map(col => (['$' + col.name(), col.toSQL().apply(this[col.name()]())])));
          }
        }),
        $.Static.new({
          name: 'table',
          do: function table() {
            return this.name();
          }
        }),
        $.Static.new({
          name: 'initDB',
          do: function initDB(db) {
            const createQuery = `CREATE TABLE IF NOT EXISTS ${this.table()} (${this.columns().map(col => col.name() + ' ' + col.createText()).join(', ')})`;
            db.query(createQuery).run();
          }
        }),
        $.Method.new({
          name: 'save',
          do: function save(db) {
            const columns = this.class().columns();
            if (!this.pid()) {
              const insertcols = columns.filter(col => !col.primary());
              const insertSQL = `INSERT INTO ${this.class().table()} (${insertcols.map(ic => ic.name()).join(', ')}) VALUES (${insertcols.map(ic => '$' + ic.name()).join(', ')})`;
              const insertQuery = db.query(insertSQL);
              const result = insertQuery.run(this.columnReplacements(insertcols));
              this.pid(result.lastInsertRowid);
            } else {
              const mutablecols = columns.filter(col => col.mutable());
              const updateSQL = `UPDATE ${this.class().table()} SET ${mutablecols.map(mc => mc.name() + ' = $' + mc.name()).join(', ')} WHERE pid = $pid`;
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
            const elems = db.query(`SELECT * FROM ${this.name()}`).all();
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
  }
}).load();
