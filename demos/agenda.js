import { __, base } from '../src/base.js';
import db from '../src/db.js';

export default await function (_, $, $base, $db) {
  $base.Class.new({
    name: 'ActComponent',
    slots: [
      $base.Method.new({
        name: "runcommand",
        do(cmd) {
          cmd.command().run().apply(cmd.parent(), [cmd, ...cmd.args()]);
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'Todo',
    slots: [
      $.ActComponent,
      $db.Persisted,
      $db.DBVar.new({
        name: 'content',
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'finished',
        mutable: true,
        toSQL() {
          return this ? this.toISOString() : null;
        },
        fromSQL() {
          return this ? new Date(this) : null;
        },
      }),
      $base.Method.new({
        name: 'description',
        do: function description() {
          return `todo "${this.content()}"`;
        }
      }),
      $base.Command.new({
        name: 'create',
        run(command, agenda) {
          agenda.todos().push(this);
          this.save(agenda.db());
          agenda.sysnote(`added ${this}`);
        }
      }),
      $base.Command.new({
        name: 'finish',
        run(command, agenda) {
          this.finished(new Date());
          this.save(agenda.db());
          agenda.todos(agenda.todos().filter(t => t !== this));
          agenda.sysnote(`finished ${this}`);
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'Note',
    slots: [
      $.ActComponent,
      $db.Persisted,
      $db.DBVar.new({
        name: 'source',
        default: 'user',
      }),
      $db.DBVar.new({
        name: 'message',
      }),
      $base.Method.new({
        name: 'logline',
        do() {
          return `${this.title()} [${this.created().toISOString()}] <${this.source()}> ${this.message()}`;
        }
      }),
      $base.Method.new({
        name: 'description',
        do() {
          return `[${this.source()}] ${this.message()}`;
        }
      }),
      $base.Command.new({
        name: 'create',
        run(command, agenda, stdout = true) {
          if (!this.created()) {
            this.created(new Date());
          }
          agenda.notes().push(this);
          this.save(agenda.db());
          if (stdout) {
            agenda.log(this.logline());
          }
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'Journal',
    slots: [
      $.ActComponent,
      $db.Persisted,
      $base.Var.new({
        name: 'notes',
        default: () => [],
      }),
    ]
  });

  $base.Class.new({
    name: 'ScheduleMemo',
    slots: [
      $.ActComponent,
      $base.Var.new({
        name: 'memo',
        type: 'string',
      }),
      $base.Var.new({
        name: 'eventDate',
        type: 'date',
      }),
      $base.Command.new({
        name: 'create',
        run(command, agenda) {
          agenda.schedule(this);
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'Agenda',
    slots: [
      $.ActComponent,
      $base.Var.new({
        name: 'dbName',
        doc: 'name of db file or :memory:',
        default: ':memory:',
      }),
      $base.Var.new({
        name: 'db',
        doc: 'bun sqlite instance',
      }),
      $base.After.new({
        name: 'init',
        do() {
          this.db($db.SQLite.createDatabase(this.dbName()));

          $.Note.initDB(this.db());
          $.Todo.initDB(this.db());
          this.notes($.Note.loadAll(this.db()));
          this.todos($.Todo.loadAll(this.db()).filter(t => !t.finished));
        }
      }),
      $base.Var.new({
        name: 'history',
        doc: 'history of commands',
        default: () => [],
      }),
      $base.Var.new({
        name: 'notes',
        default: () => [],
      }),
      $base.Var.new({
        name: 'todos',
        default: () => [],
      }),
      $base.Method.new({
        name: 'sysnote',
        do(message) {
          $.Note.new({
            source: 'system',
            message
          }).create(this);
        }
      }),
      $base.Method.new({
        name: 'receive',
        do(cmd) {
          cmd.run(this);
          this.history().push(cmd);
        }
      }),
    ]
  });
}.module({
  name: 'agenda',
  doc: 'what is needing to be done',
  imports: [base, db],
}).load();
