import db from '../src/db';

const __ = globalThis.SIMULABRA;
export default await __.base().find('Class', 'Module').new({
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
        $.Method.new({
          name: 'command',
          do: function command() {
            return $.TodoCommand.new({ todo: this });
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
      name: 'TodoCommand',
      slots: [
        $.AgendaCommand,
        $.Var.new({
          name: 'todo',
          type: 'Todo',
        }),
        $.Method.new({
          name: 'run',
          do: function run(agenda) {
            agenda.todo(this.todo());
          }
        }),
      ]
    });

    $.Class.new({
      name: 'FinishTodoCommand',
      slots: [
        $.AgendaCommand,
        $.Var.new({
          name: 'todo',
        }),
        $.Method.new({
          name: 'run',
          do: function run(agenda) {
            agenda.finishTodo(this.todo());
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
          name: 'finishTodo',
          do: function finishTodo(todo) {
            todo.finished(new Date());
            todo.save(this.db());
            this.todos(this.todos().filter(t => t !== todo));
            this.sysnote(`finished ${todo}`);
          }
        }),
        $.Method.new({
          name: 'processCommand',
          do: function processCommand(cmd) {
            cmd.run(this);
            this.journal().push(cmd);
          }
        }),
      ]
    });

  //  $.Class.new({
  //    name: 'AgendaTodo',
  //    slots: [
  //      $.Component,
  //      $.Var.new({ name: 'description', default: '' }),
  //      $.Var.new({ name: 'completed', default: false }),
  //      $.Button.new({
  //        name: 'removeButton',
  //        command: () => $.TodoRemoveCommand.new({ target: this }),
  //        text: 'delete',
  //      }),
  //      $.Method.new({
  //        name: 'render',
  //        do: function render() {
  //          return $.sjsx`<li class="todo-${this.completed() ? 'completed' : 'todo'}">
  //            ${this.todo()}
  //            ${this.removeButton()}
  //          </li>`;
  //        }
  //      }),
  //    ]
  //  });
  //
  //  $.Class.new({
  //    name: 'AgendaList',
  //    slots: [
  //      $.Component,
  //      $.Var.new({
  //        name: 'todos',
  //        default: () => [],
  //      }),
  //      $.Method.new({
  //        name: 'add',
  //        do: function add(todo) {
  //          const todoItem = $.AgendaItem.new({
  //            todo,
  //            parent: this
  //          });
  //          this.todos(...this.todos(), todoItem);
  //          this.rerender();
  //        }
  //      }),
  //      $.Method.new({
  //        name: 'render',
  //        do: function render() {
  //          return $.sjsx`<ul>
  //            ${this.todos()}
  //          </ul>`;
  //        }
  //      }),
  //    ]
  //  }),
  //  $.Class.new({
  //    name: 'AgendaApp',
  //    slots: [
  //      $.Window,
  //      $.Var.new({
  //        name: 'prompt',
  //        default: 'what to do?' // change me!
  //      }),
  //      $.AgendaList.new({
  //        name: 'todoList',
  //      }),
  //      $.Method.new({
  //        name: 'addTodo',
  //        do: function addTodo(description) {
  //          this.todoList().add(description);
  //        }
  //      }),
  //      $.Method.new({
  //        name: 'removeTodo',
  //        do: function removeTodo(todo) {
  //          this.todos(this.todos().filter(t => t !== todo));
  //        }
  //      }),
  //      $.Method.new({
  //        name: 'submit',
  //        do: function submit() {
  //          const input = this.element().querySelector('input');
  //          const description = input.value;
  //          if (description) {
  //            this.addTodo(description);
  //            input.value = '';
  //          }
  //        }
  //      }),
  //      $.TextInput({
  //        name: 'todoInput',
  //        onkeydown: e => {
  //          if (e.key === 'Enter') {
  //            return this.dispatchEvent({
  //              type: 'command',
  //              target: $.TodoSubmitCommand.new({ target: this }),
  //            });
  //          }
  //        }
  //      }),
  //      $.Button.new({
  //        name: 'addButton',
  //        command: () => $.TodoSubmitCommand.new({ target: this }),
  //      }),
  //      $.Method.new({
  //        name: 'render',
  //        do: function render() {
  //          return $.sjsx`<div>
  //            ${this.prompt()}
  //            ${this.todoInput()}
  //            ${this.addButton()}
  //            ${this.todoList()}
  //          </div>`;
  //        }
  //      }),
  //    ]
  //  });
  //
  //  $.Class.new({
  //    name: 'todo_finish_command',
  //    slots: [
  //      $.Command,
  //      $.Var.new({ name: 'target' }),
  //      $.Method.new({
  //        name: 'run',
  //        do: function run() {
  //          this.log('finish');
  //          this.target().completed(!this.target().completed());
  //        }
  //      }),
  //    ]
  //  });
  //
  //  $.Class.new({
  //    name: 'todo',
  //    slots: [
  //      $.component,
  //      $.Method.new({
  //        name: 'render',
  //        do: function render() {
  //          return $el.span({},
  //            $el.span({ class: `completed-${this.completed()}` }, this.description()),
  //            ' ',
  //            $.button.new({ command: $.todo_finish_command.new({ target: this }), slots: [this.completed() ? 'undo' : 'finish'], parent: this })
  //          );
  //        }
  //      }),
  //    ]
  //  });
  //
  //  $.Class.new({
  //    name: 'TodoSubmitCommand',
  //    slots: [
  //      $.Command,
  //      $.Var.new({ name: 'target' }),
  //      $.Method.new({
  //        name: 'run',
  //        do: function run() {
  //          this.target().submit();
  //        }
  //      }),
  //    ]
  //  });
  //
  //  $.Class.new({
  //    name: 'TodoRemoveCommand',
  //    slots: [
  //      $.Command,
  //      $.Var.new({ name: 'target' }),
  //      $.Var.new({ name: 'todo' }),
  //      $.Method.new({
  //        name: 'run',
  //        do: function run() {
  //          this.target().removeTodo(this.todo());
  //        }
  //      }),
  //    ]
  //  });
  }
}).load();
