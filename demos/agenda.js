import db from '../src/db';

const __ = globalThis.SIMULABRA;

export default await function (_, $) {
  $.Class.new({
    name: 'Todo',
    slots: [
      $.Persisted,
      $.DBVar.new({
        name: 'content',
        mutable: true,
      }),
      $.DBVar.new({
        name: 'finished',
        mutable: true,
        toSQL() {
          return this ? this.toISOString() : null;
        },
        fromSQL() {
          return this ? new Date(this) : null;
        },
      }),
      $.Method.new({
        name: 'description',
        do: function description() {
          return `todo "${this.content()}"`;
        }
      }),
      $.Command.new({
        name: 'create',
        run(command, agenda) {
          agenda.todos().push(this);
          this.save(agenda.db());
          agenda.sysnote(`added ${this}`);
        }
      }),
      $.Command.new({
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

  $.Class.new({
    name: 'Note',
    slots: [
      $.Persisted,
      $.DBVar.new({
        name: 'source',
        default: 'user',
      }),
      $.DBVar.new({
        name: 'message',
      }),
      $.Method.new({
        name: 'logline',
        do: function logline() {
          return `${this.title()} [${this.created().toISOString()}] <${this.source()}> ${this.message()}`;
        }
      }),
      $.Command.new({
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

  $.Class.new({
    name: 'ScheduleMemo',
    slots: [
      $.Var.new({
        name: 'memo',
        type: 'string',
      }),
      $.Var.new({
        name: 'eventDate',
        type: 'date',
      }),
      $.Command.new({
        name: 'create',
        run(command, agenda) {
          agenda.schedule(this);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'Agenda',
    slots: [
      $.Var.new({
        name: 'dbName',
        doc: 'name of db file or :memory:',
        default: ':memory:',
      }),
      $.Var.new({
        name: 'db',
        doc: 'bun sqlite instance',
      }),
      $.After.new({
        name: 'init',
        do: function init() {
          this.db($.SQLite.createDatabase(this.dbName()));

          $.Note.initDB(this.db());
          $.Todo.initDB(this.db());
          this.notes($.Note.loadAll(this.db()));
          this.todos($.Todo.loadAll(this.db()).filter(t => !t.finished));
        }
      }),
      $.Var.new({
        name: 'journal',
        doc: 'history of commands',
        default: () => [],
      }),
      $.Var.new({
        name: 'notes',
        default: () => [],
      }),
      $.Var.new({
        name: 'todos',
        default: () => [],
      }),
      $.Method.new({
        name: 'sysnote',
        do: function sysnote(message) {
          this.receive($.Note.new({
            source: 'system', 
            message
          }).create(this));
        }
      }),
      $.Method.new({
        name: 'receive',
        do: function receive(cmd) {
          cmd.run(this);
          this.journal().push(cmd);
        }
      }),
    ]
  });
}.module({
  name: 'agenda',
  doc: 'what is needing to be done',
  imports: [__.base(), db],
}).load();
