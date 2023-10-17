import base from './base.js';
import html from './html.js';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html],
  on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.class.new({
      name: 'message',
      slots: [
        $.component,
        $.var.new({ name: 'text' }),
        $.var.new({ name: 'time' }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $.el('div', {}, [
              $.el('span', { class: 'time' }, this.time().toISOString()),
              this.text()
            ]);
          }
        }),
      ]
    });

    $.class.new({
      name: 'message_log',
      slots: [
        $.window,
        $.var.new({
          name: 'message_list',
          default: []
        }),
        $.method.new({
          name: 'add',
          do: function add(mstr) {
            this.message_list().push($.message.new({ text: mstr, time: new Date() }));
            this.dispatchEvent({ type: 'update' });
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $.el('div', {}, this.message_list().map(m => m.render()));
          }
        }),
      ]
    });

    $.class.new({
      name: 'explorer_select_link',
      slots: [
        $.link,  // Assuming that `$$link` refers to a previously defined class named 'link'
        $.var.new({ name: 'target' }),
        $.var.new({ name: 'object' }),
        $.method.new({
          name: 'command',
          do: function command() {
            return $.explorer_select_command.new({ object: this.object() });
          }
        }),
      ]
    });

    $.class.new({
      name: 'intro',
      slots: [
        $.window,  // Assuming that `$$window` refers to a previously defined class named 'window'
        $.method.new({
          name: 'render',
          do: function render() {
            return $.el('div', {}, [
              $.el('div', { class: 'intro-title' }, 'SIMULABRA'),
              $.el('div', { class: 'intro-infinite' }, 'alpha - "infinite software"'),
              $.el('div', {}, 'a software construction kit for the web'),
              $.el('div', {}, 'try exploring some classes or adding some todos'),
              $.el('div', {}, 'soon: modifying values in the explorer, drag and drop, basic code editing'),
              $.el('div', {}, [
                'behold the source at the ',
                $.el('a', { href: 'https://github.com/simulabra/simulabra' }, 'github repo&#128279;')
              ])
            ]);
          }
        }),
      ]
    });

    $.class.new({
      name: 'module_browser',
      slots: [
        $.window,  // Assuming that `$$window` refers to a previously defined class named 'window'
        $.method.new({
          name: 'objects',
          do: function objects() {
            return this.module().classes();
          }
        }),
        $.var.new({ name: 'module' }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $.el('div', {}, this.objects().map(c => {
              return $.explorer_select_link.new({ object: c, parent: this });
            }));
          }
        }),
      ]
    });

    $.class.new({
      name: 'slot_value',
      slots: [
        $.component,
        $.var.new({ name: 'slot_name' }),
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'display',
          do: function display() {
            if (this.value() !== null && typeof this.value() === 'object' && '_id' in this.value()) {
              return $.explorer_select_link.new({ object: this.value(), parent: this });
            } else if (Array.isArray(this.value())) {
              return $.el('span', {},
                'list(' + this.value().length + ')',
                this.value().map((it, idx) => $.el('div', { class: 'array-item' }, $.slot_value.new({ slot_name: idx, value: it, parent: this }).display())));
            } else if (this.value() !== null && 'to_dom' in (Object.getPrototypeOf(this.value()) || {})) {
              return this.value();
            } else if (this.value() instanceof WeakRef) {
              const ref = this.value().deref();
              if (ref !== undefined) {
                return $.slot_value.new({ slot_name: this.slot_name(), value: ref }).display();
              } else {
                return $.el('span', {}, '(empty ref)');
              }
            } else {
              return $.el('span', {}, this.value()?.toString() ?? JSON.stringify(this.value()));
            }
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $.el('div', {}, this.slot_name() + ':', this.display());
          }
        })
      ]
    });

    $.class.new({
      name: 'object_explorer',
      slots: [
        $.window,
        $.var.new({ name: 'object' }),
        $.method.new({
          name: 'render',
          do: function render() {
            if (!this.object()) {
              return $.el('span', {}, '(no object)');
            }
            return [
              $.el('div', { class: 'explorer-title' }, this.object().title()),
              $.explorer_select_link.new({ object: this.object().class(), parent: this }),
              ...this.object().state().map(v => {
                const [name, value] = v.kv();
                return $.slot_value.new({ slot_name: name, value: value, parent: this });
              }),
              this.object().class() === $.class ? $.slot_value.new({ slot_name: 'instances', value: this.object().instances(), parent: this }) : $.el('span', {}, '-')
            ];
          }
        })
      ]
    });

    $.class.new({
      name: 'explorer_select_command',
      slots: [
        $.command,
        $.var.new({ name: 'object' }),
        $.var.new({ name: 'previous' }),
        $.method.new({
          name: 'target',
          do: function target() {
            return $editor.explorer();
          }
        }),
        $.method.new({
          name: 'run',
          do: function run() {
            this.previous(this.target().object());
            this.target().object(this.object());
          }
        }),
        $.method.new({
          name: 'description',
          do: function description() {
            return `~explorer_select_command object=${this.object().title()}`;
          }
        }),
      ]
    });

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
            return $.el('span', {},
              $.el('span', { class: `completed-${this.completed()}` }, this.description()),
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
          name: 'load_tasks_from_storage',
          do: function load_tasks_from_storage() {
            const storedTasks = JSON.parse(localStorage.getItem('tasks'));
            if (storedTasks) {
              this.tasks(storedTasks.map(taskData => {
                const task = $.task.new({ description: taskData.description, completed: taskData.completed, parent: this });
                return task;
              }));
            }
          }
        }),
        $.method.new({
          name: 'save_tasks_to_storage',
          do: function save_tasks_to_storage() {
            const taskData = this.tasks().map(task => ({
              description: task.description(),
              completed: task.completed(),
            }));
            localStorage.setItem('tasks', JSON.stringify(taskData));
          }
        }),
        $.method.new({
          name: 'add_task',
          do: function add_task(description) {
            const task = $.task.new({ description: description, parent: this });
            this.tasks([...this.tasks(), task]);
            this.save_tasks_to_storage();
          }
        }),
        $.method.new({
          name: 'remove_task',
          do: function remove_task(task) {
            this.tasks(this.tasks().filter(t => t !== task));
            this.save_tasks_to_storage();
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
            return $.el('div', {}, [
              $.el('div', {}, 'what needs to be done?'),
              $.el('input', {
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
              $.el('ul', {}, this.tasks().map(task =>
                $.el('li', {}, [
                  task,
                  $.button.new({ command: $.task_remove_command.new({ target: this, task: task }), parent: this }, 'delete')
                ])
              ))
            ]);
          }
        }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.load_tasks_from_storage();
          }
        })
      ]
    });

    $.class.new({
      name: 'todos',
      slots: [
        $.window,
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
        })
      ]
    });

    $.class.new({
      name: 'editor',
      slots: [
        $.window,
        $.application,
        $.var.new({ name: 'messages' }),
        $.var.new({ name: 'explorer' }),
        $.var.new({ name: 'modules' }),
        $.var.new({ name: 'todos' }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.messages($.message_log.new({ parent: this }));
            this.explorer($.object_explorer.new({ parent: this }));
            this.messages().add('STARTING SIMULABRA');
            this.todos($.todos.new({ parent: this }));
            this.modules(__.base().instances($.module).map(it => $.module_browser.new({ name: it.name(), module: it, parent: this })));
            this.addEventListener('error', evt => {
              this.messages().add(`error: ${evt.err.toString()}`);
            });
          }
        }),
        $.before.new({
          name: 'process_command',
          do: function process_command(cmd) {
            this.messages().add('run: ' + cmd.description());
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $.el('div', { class: 'container' }, [
              $.el('div', { class: 'col' }, [$.intro.new(), this.modules()]),
              $.el('div', { class: 'col' }, [this.todos(), this.explorer(), this.messages()])
            ]);
          }
        }),
        $.method.new({
          name: 'css',
          do: function css() {
            return `
.message_log {}

.time {
  font-style: italic;
  font-size: 11px;
}

.explorer_select_link {
  margin: 2px;
}

.explorer-title {
  font-weight: bold;
}

.completor-link-pre {
  color: var(--secondary-2);
}

.completor-link-pre-emphasize {
  color: var(--secondary-2);
}

.completed-true {
  text-decoration: line-through;
}

.intro-title {
  font-weight: bold;
  font-style: italic;
  font-size: 24px;
}

.intro-infinite {
  font-style: italic;
}
`;
          }
        })
      ]
    });

    const $editor = $.editor.new();
    document.body.appendChild($editor.to_dom());
  }
}).load();
