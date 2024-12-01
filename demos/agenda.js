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
      name: 'LogCommand',
      slots: [
        $.AgendaCommand,
        $.Var.new({
          name: 'message',
          type: 'string',
        }),
        $.Method.new({
          name: 'run',
          do: function run(agenda) {
            agenda.addLog(this.createdAt(), this.message());
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
      name: 'TaskCommand',
      slots: [
        $.AgendaCommand,
        $.Var.new({
          name: 'task',
          type: 'Task',
        }),
        $.Method.new({
          name: 'run',
          do: function run(agenda) {
            agenda.addTask(this.task());
            agenda.addLog(this.createdAt(), `added ${this.task()}`);
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
          name: 'journal',
          doc: 'history of commands',
          default: () => [],
        }),
        $.Var.new({
          name: 'logs',
          default: () => [],
        }),
        $.Var.new({
          name: 'tasks',
          default: () => [],
        }),
        $.Method.new({
          name: 'addLog',
          do: function addLog(date, message, stdout = true) {
            const entry = `[${date.toISOString()}] ${message}`;
            this.logs().push(entry);
            if (stdout) {
              this.log(entry);
            }
          }
        }),
        $.Method.new({
          name: 'addTask',
          do: function addTask(task) {
            this.tasks().push(task);
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
