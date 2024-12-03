import { Database } from 'bun:sqlite';

const __ = globalThis.SIMULABRA;
export default await __.base().find('Class', 'Module').new({
  name: 'Agenda',
  doc: 'what is needing to be done',
  imports: [__.base(), __.base().find('Module', 'HTML')],
  on_load(_, $) {
    //const $el = $.HtmlElement.proxy();


    $.Class.new({
      name: 'AgendaCommand',
      slots: [
        $.Command,
        $.AutoVar.new({
          name: 'createdAt',
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
      name: 'Task',
      slots: [
        $.Var.new({
          name: 'title'
        }),
        $.Var.new({
          name: 'created',
        }),
        $.Var.new({
          name: 'deadline',
        }),
        $.Method.new({
          name: 'description',
          do: function description() {
            return `task "${this.title()}"`;
          }
        }),
      ]
    });

    $.Class.new({
      name: 'NoteFragment',
      slots: [
        $.AutoVar.new({
          name: 'created',
          doc: 'date of creation timestamp',
          json: true,
          autoFunction() {
            return new Date();
          }
        }),
        $.Var.new({
          name: 'dbid',
          doc: 'id in the db',
        }),
        $.Var.new({
          name: 'source',
          default: 'user',
          json: true,
        }),
        $.Var.new({
          name: 'message',
          json: true,
        }),
        $.Method.new({
          name: 'description',
          do: function description() {
            return `#${this.dbid() ?? 'unsaved'} [${this.source()}/${this.created().toISOString()}] ${this.message()}`;
          }
        }),
      ]
    });

    $.Class.new({
      name: 'TodoCommand',
      slots: [
        $.AgendaCommand,
        $.Var.new({
          name: 'task',
          type: 'Task',
        }),
        $.Method.new({
          name: 'run',
          do: function run(agenda) {
            agenda.todo(this.task());
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
            this.db(new Database(this.dbName()));
            this.db().query('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT, source TEXT, message TEXT)').run();
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
          name: 'tasks',
          default: () => [],
        }),
        $.Method.new({
          name: 'loadNotes',
          do: function loadNotes() {
            const dbNotes = this.db().query('SELECT * FROM notes').all();
            return dbNotes.map(dbNote => {
              return $.NoteFragment.new({
                dbid: dbNote.id,
                created: new Date(dbNote.created),
                source: dbNote.source,
                message: dbNote.message,
              });
            });
          }
        }),
        $.Method.new({
          name: 'note',
          do: function note(note, stdout = true) {
            this.notes().push(note);
            const noteQuery = this.db().query('INSERT INTO notes (source, created, message) VALUES ($source, $created, $message)');
            const dbNote = noteQuery.run({
              $source: note.source(),
              $created: note.created().toISOString(),
              $message: note.message(),
            });
            note.dbid(dbNote.lastInsertRowid);
            if (stdout) {
              this.log(note.description());
            }
          }
        }),
        $.Method.new({
          name: 'todo',
          do: function todo(task) {
            this.tasks().push(task);
            this.note($.NoteFragment.new({
              source: 'system', 
              message: `added ${task}`
            }));
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
  //    name: 'AgendaTask',
  //    slots: [
  //      $.Component,
  //      $.Var.new({ name: 'description', default: '' }),
  //      $.Var.new({ name: 'completed', default: false }),
  //      $.Button.new({
  //        name: 'removeButton',
  //        command: () => $.TaskRemoveCommand.new({ target: this }),
  //        text: 'delete',
  //      }),
  //      $.Method.new({
  //        name: 'render',
  //        do: function render() {
  //          return $.sjsx`<li class="task-${this.completed() ? 'completed' : 'todo'}">
  //            ${this.task()}
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
  //        name: 'tasks',
  //        default: () => [],
  //      }),
  //      $.Method.new({
  //        name: 'add',
  //        do: function add(task) {
  //          const todoItem = $.AgendaItem.new({
  //            task,
  //            parent: this
  //          });
  //          this.tasks(...this.tasks(), todoItem);
  //          this.rerender();
  //        }
  //      }),
  //      $.Method.new({
  //        name: 'render',
  //        do: function render() {
  //          return $.sjsx`<ul>
  //            ${this.tasks()}
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
  //        name: 'taskList',
  //      }),
  //      $.Method.new({
  //        name: 'addTask',
  //        do: function addTask(description) {
  //          this.taskList().add(description);
  //        }
  //      }),
  //      $.Method.new({
  //        name: 'removeTask',
  //        do: function removeTask(task) {
  //          this.tasks(this.tasks().filter(t => t !== task));
  //        }
  //      }),
  //      $.Method.new({
  //        name: 'submit',
  //        do: function submit() {
  //          const input = this.element().querySelector('input');
  //          const description = input.value;
  //          if (description) {
  //            this.addTask(description);
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
  //              target: $.TaskSubmitCommand.new({ target: this }),
  //            });
  //          }
  //        }
  //      }),
  //      $.Button.new({
  //        name: 'addButton',
  //        command: () => $.TaskSubmitCommand.new({ target: this }),
  //      }),
  //      $.Method.new({
  //        name: 'render',
  //        do: function render() {
  //          return $.sjsx`<div>
  //            ${this.prompt()}
  //            ${this.todoInput()}
  //            ${this.addButton()}
  //            ${this.taskList()}
  //          </div>`;
  //        }
  //      }),
  //    ]
  //  });
  //
  //  $.Class.new({
  //    name: 'task_finish_command',
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
  //    name: 'task',
  //    slots: [
  //      $.component,
  //      $.Method.new({
  //        name: 'render',
  //        do: function render() {
  //          return $el.span({},
  //            $el.span({ class: `completed-${this.completed()}` }, this.description()),
  //            ' ',
  //            $.button.new({ command: $.task_finish_command.new({ target: this }), slots: [this.completed() ? 'undo' : 'finish'], parent: this })
  //          );
  //        }
  //      }),
  //    ]
  //  });
  //
  //  $.Class.new({
  //    name: 'TaskSubmitCommand',
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
  //    name: 'TaskRemoveCommand',
  //    slots: [
  //      $.Command,
  //      $.Var.new({ name: 'target' }),
  //      $.Var.new({ name: 'task' }),
  //      $.Method.new({
  //        name: 'run',
  //        do: function run() {
  //          this.target().removeTask(this.task());
  //        }
  //      }),
  //    ]
  //  });
  }
}).load();
