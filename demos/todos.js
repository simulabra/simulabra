const __ = globalThis.SIMULABRA;
const base = __.base();
const html = base.find('module', 'html');

console.log('html', html);
export default await base.find('class', 'module').new({
  name: 'todos',
  imports: [base, html],
  on_load(_, $) {
    const $el = $.html_element.proxy();
    $.class.new({
      name: 'task_finish_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.method.new({
          name: 'run',
          do: function run() {
            this.log('finish');
            this.target().completed(!this.target().completed());
          }
        }),
      ]
    });

    $.class.new({
      name: 'task',
      slots: [
        $.component,
        $.var.new({ name: 'description', default: '' }),
        $.var.new({ name: 'completed', default: false }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $el.span({},
              $el.span({ class: `completed-${this.completed()}` }, this.description()),
              ' ',
              $.button.new({ command: $.task_finish_command.new({ target: this }), slots: [this.completed() ? 'undo' : 'finish'], parent: this })
            );
          }
        }),
      ]
    });

    $.class.new({
      name: 'task_submit_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.method.new({
          name: 'run',
          do: function run() {
            this.target().submit();
          }
        }),
      ]
    });

    $.class.new({
      name: 'task_remove_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.var.new({ name: 'task' }),
        $.method.new({
          name: 'run',
          do: function run() {
            this.target().remove_task(this.task());
          }
        }),
      ]
    });

    $.class.new({
      name: 'todo_list',
      slots: [
        $.component,
        $.var.new({ name: 'tasks', default: [] }),
        $.method.new({
          name: 'add_task',
          do: function add_task(description) {
            const task = $.task.new({ description: description, parent: this });
            this.tasks([...this.tasks(), task]);
          }
        }),
        $.method.new({
          name: 'remove_task',
          do: function remove_task(task) {
            this.tasks(this.tasks().filter(t => t !== task));
          }
        }),
        $.method.new({
          name: 'submit',
          do: function submit() {
            const input = this.element().querySelector('input');
            const description = input.value;
            if (description) {
              this.add_task(description);
              input.value = '';
            }
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $el.div({}, [
              $el.div({}, 'what needs to be done?'),
              $el.input({
                type: 'text',
                onkeydown: e => {
                  if (e.key === 'Enter') {
                    return this.dispatchEvent({
                      type: 'command',
                      target: $.task_submit_command.new({ target: this }),
                    });
                  }
                }
              }),
              $.button.new({ command: $.task_submit_command.new({ target: this }), parent: this }, 'add'),
              $el.ul({}, this.tasks().map(task =>
                $el.li({}, [
                  task,
                  $.button.new({ command: $.task_remove_command.new({ target: this, task: task }), parent: this }, 'delete')
                ])
              ))
            ]);
          }
        })
      ]
    });

    $.class.new({
      name: 'todos',
      slots: [
        $.window,
        $.application,
        $.var.new({ name: 'todo_list' }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.todo_list($.todo_list.new({ parent: this }));
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return this.todo_list();
          }
        }),
        $.method.new({
          name: 'css',
          do: function css() {
            return `
`;
          }
        })
      ]
    });

    const $todos = $.todos.new();
    const container = document.getElementById('todos-container');
    container.innerHTML = '';
    container.appendChild($todos.to_dom());
  }
}).load();
