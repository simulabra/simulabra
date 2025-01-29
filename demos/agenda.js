import db from '../src/db';

const __ = globalThis.SIMULABRA;
export default await __.$().Module.new({
  name: 'Agenda',
  doc: 'what is needing to be done',
  imports: [__.base(), db],
  on_load(_, $) {
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
            agenda.todo(this);
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
            return `$.Note#${this.pid() ?? 'unsaved'} [${this.source()}/${this.created().toISOString()}] ${this.message()}`;
          }
        }),
        $.Method.new({
          name: 'command',
          do: function command() {
            return $.NoteCommand.new({ note: this });
          }
        }),
      ]
    });

    $.Class.new({
      name: 'AgendaCommand',
      slots: [
        $.Command,
        $.AutoVar.new({
          name: 'created',
          doc: 'date of creation timestamp',
          autoFunction() {
            return new Date();
          }
        }),
      ]
    });

    $.Class.new({
      name: 'NoteCommand',
      slots: [
        $.AgendaCommand,
        $.Var.new({
          name: 'note',
        }),
        $.Method.new({
          name: 'run',
          do: function run(agenda) {
            agenda.note(this.note());
          }
        }),
      ]
    });

    $.Class.new({
      name: 'ScheduleCommand',
      slots: [
        $.AgendaCommand,
        $.Var.new({
          name: 'memo',
          type: 'string',
        }),
        $.Var.new({
          name: 'eventDate',
          type: 'date',
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
          name: 'note',
          do: function note(note, stdout = true) {
            if (!note.created()) {
              note.created(new Date());
            }
            this.notes().push(note);
            note.save(this.db());
            if (stdout) {
              this.log(note.logline());
            }
          }
        }),
        $.Method.new({
          name: 'sysnote',
          do: function sysnote(message) {
            this.note($.Note.new({
              source: 'system', 
              message
            }));
          }
        }),
        $.Method.new({
          name: 'todo',
          do: function todo(todo) {
            this.todos().push(todo);
            todo.save(this.db());
            this.sysnote(`added ${todo}`);
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
  }
}).load();
