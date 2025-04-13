import { __, base } from './base.js';
import html from './html.js';

export default await base.find('class', 'module').new({
  name: 'editor',
  doc: 'classes for the simulabra editor',
  imports: [base, html],
  mod(_, $) {
    const __ = globalThis.SIMULABRA;
    const $el = $.html_element.proxy();

    $.class.new({
      name: 'message',
      slots: [
        $.component,
        $.Var.new({ name: 'text' }),
        $.Var.new({ name: 'time' }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div({},
              $el.span({ class: 'time' }, this.time().toISOString()),
              ' ',
              this.text()
            );
          }
        }),
      ]
    });

    $.class.new({
      name: 'message_log',
      slots: [
        $.Window,
        $.Var.new({
          name: 'message_list',
          default: []
        }),
        $.Method.new({
          name: 'add',
          do: function add(mstr) {
            this.message_list().push($.message.new({ text: mstr, time: new Date() }));
            this.dispatchEvent({ type: 'update' });
          }
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div({}, ...this.message_list().map(m => m.render()));
          }
        }),
      ]
    });

    $.class.new({
      name: 'explorer_select_command',
      slots: [
        $.Command,
        $.Var.new({ name: 'object' }),
        $.Var.new({ name: 'previous' }),
        // (~Var #object)
        // ~Method#target(%editor.explorer)
        // $Method(:target %editor.explorer)
        $.Method.new({
          name: 'target',
          do: function target() {
            return $editor.explorer();
          }
        }),
        $.Method.new({
          name: 'run',
          do: function run() {
            this.previous(this.target().object());
            this.target().object(this.object());
          }
        }),
        $.Method.new({
          name: 'description',
          do: function description() {
            return `~explorer_select_command object=${this.object().title()}`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'explorer_select_link',
      slots: [
        $.link,
        $.Var.new({ name: 'target' }),
        $.Var.new({ name: 'object' }),
        $.Method.new({
          name: 'command',
          do: function command() {
            return $.explorer_select_command.new({ object: this.object() });
          }
        }),
      ]
    });

    $.class.new({
      name: 'slot_value',
      slots: [
        $.component,
        $.Var.new({ name: 'slot_name' }),
        $.Var.new({ name: 'value' }),
        $.Method.new({
          name: 'display_function_or_object',
          do: function display_function_or_object() {
            return $.explorer_select_link.new({ object: this.value(), parent: this });
          }
        }),
        $.Method.new({
          name: 'display_array',
          do: function display_array() {
            return $el.span({},
              'list(' + this.value().length + ')',
              this.value().map((it, idx) => $el.div({ class: 'array-item' }, $.slot_value.new({ slot_name: idx, value: it, parent: this }).display())));
          }
        }),
        $.Method.new({
          name: 'display_weak_ref',
          do: function display_weak_ref() {
            const ref = this.value().deref();
            if (ref !== undefined) {
              return $.slot_value.new({ slot_name: this.slot_name(), value: ref }).display();
            } else {
              return $el.span({}, '(empty ref)');
            }
          }
        }),
        $.Method.new({
          name: 'display_primitive',
          do: function display_primitive() {
            this.log(this.value());
            return $el.span({}, this.value()?.display() ?? JSON.stringify(this.value()));
          }
        }),
        $.Method.new({
          name: 'display',
          do: function display() {
            if (this.value() !== null && (typeof this.value() === 'function' || typeof this.value() === 'object' && '_id' in this.value())) {
              return this.display_function_or_object();
            } else if (Array.isArray(this.value())) {
              return this.display_array();
            } else if (this.value() !== null && 'to_dom' in (Object.getPrototypeOf(this.value()) || {})) {
              return this.value().to_dom();
            } else if (this.value() instanceof WeakRef) {
              return this.display_weak_ref();
            } else {
              return this.display_primitive();
            }
          }
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div({ class: 'slot-value' }, [$el.span({}, this.slot_name() + ': '), this.display()]);
          }
        })
      ]
    });

    $.class.new({
      name: 'object_explorer',
      slots: [
        $.Window,
        $.Var.new({ name: 'object' }),
        $.Method.new({
          name: 'render',
          do: function render() {
            if (!this.object()) {
              return $el.span({}, '(no object)');
            }
            return [
              $el.div({ class: 'explorer-title' }, this.object().title()),
              $.explorer_select_link.new({ object: this.object().class(), parent: this }),
              ...this.object().state().map(v => {
                const [name, value] = v.kv();
                return $.slot_value.new({ slot_name: name, value: value, parent: this });
              }),
              this.object().class() === $.class ? $.slot_value.new({ slot_name: 'instances', value: this.object().instances(), parent: this }) : $el.span({}, '-')
            ];
          }
        })
      ]
    });

    $.class.new({
      name: 'intro',
      slots: [
        $.Window,
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div({}, [
              $el.div({ class: 'intro-title' }, 'SIMULABRA'),
              $el.div({ class: 'intro-infinite' }, 'alpha - "infinite software"'),
              $el.div({},
                'behold the source at the ',
                $el.a({ href: 'https://github.com/simulabra/simulabra' }, 'github repo')
              )
            ]);
          }
        }),
      ]
    });

    $.class.new({
      name: 'module_browser',
      slots: [
        $.Window,
        $.Method.new({
          name: 'objects',
          do: function objects() {
            return this.module().instances($.class);
          }
        }),
        $.Var.new({ name: 'module' }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div(
              {},
              $el.div({ class: 'module-doc', }, this.module().doc()),
              ...this.objects().map(c => {
                return $.explorer_select_link.new({ object: c, parent: this });
              })
            );
          }
        }),
      ]
    });

    $.class.new({
      name: 'codemirror_run_command',
      slots: [
        $.Command,
        $.Var.new({ name: 'codemirror' }),
        $.Method.new({
          name: 'run',
          do: async function run() {
            const todo_mod = (await this.import_module()).default;
            this.codemirror().parent().add_module(todo_mod);
            todo_mod.$().todo_list.mount(this.codemirror().parent());
          }
        }),
        $.Method.new({
          name: 'import_module',
          do: function import_module() {
            const code = this.codemirror().editor().getValue();
            const blob = new Blob([code], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            return import(url);
          }
        }),
      ]
    });

    $.class.new({
      name: 'codemirror',
      slots: [
        $.Window,
        $.Var.new({ name: 'editor' }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div(
              {},
              $el.div({
                onload: async e => {
                  this.editor(CodeMirror(e.target, {
                    mode: 'javascript',
                    theme: 'simulabra',
                  }), false);
                  const todos = await fetch('/demos/todos.js');
                  const text = await todos.text();
                  this.editor().setValue(text);
                }
              }),
              $el.button({
                onclick: async e => {
                  this.dispatchEvent({
                    type: 'command',
                    target: $.codemirror_run_command.new({ codemirror: this })
                  });
                }
              },
                'run!'
              )
            );
          }
        }),
      ]
    });

    $.class.new({
      name: 'editor',
      slots: [
        $.Window,
        $.Application,
        $.Var.new({ name: 'messages' }),
        $.Var.new({ name: 'explorer' }),
        $.Var.new({ name: 'modules' }),
        $.Var.new({ name: 'codemirror' }),
        $.After.new({
          name: 'init',
          do: function init() {
            this.messages($.message_log.new({ parent: this }));
            this.explorer($.object_explorer.new({ parent: this }));
            this.codemirror($.codemirror.new({ parent: this }));
            this.load_modules();
            this.messages().add('STARTING SIMULABRA');
            this.addEventListener('error', evt => {
              this.messages().add(`error: ${evt.err.toString()}`);
            });
          }
        }),
        $.Before.new({
          name: 'process_command',
          do: function process_command(cmd) {
            this.messages().add('run: ' + cmd.description());
          }
        }),
        $.Method.new({
          name: 'load_modules',
          do: function load_modules() {
            this.modules(__.base().instances($.module).map(it => $.module_browser.new({ name: it.name(), module: it, parent: this })));
          }
        }),
        $.Method.new({
          name: 'add_module',
          do: function add_module(mod) {
            this.modules([...this.modules().filter(m => m.name() !== mod.name()), $.module_browser.new({ name: mod.name(), module: mod, parent: this })]);
          }
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div({ class: 'container' }, [
              $el.div({ class: 'col' }, [$.intro.new(), this.modules()]),
              $el.div({ class: 'col col-wide' }, [this.codemirror()]),
              $el.div({ class: 'col' }, [$el.div({ id: 'todos-container' }), this.explorer(), this.messages()])
            ]);
          }
        }),
        $.Method.new({
          name: 'css',
          do: function css() {
            return `
.message_log {}

.time {
  font-style: italic;
  font-size: 11px;
}

.object_explorer > .window-body {
  max-height: 50vh;
}

.explorer_select_link {
  margin: 2px;
}

.explorer-title {
  font-weight: bold;
}

.completor-link-pre {
  color: Var(--secondary-2);
}

.completor-link-pre-emphasize {
  color: Var(--secondary-2);
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

.module-doc {
  font-style: italic;
}

.CodeMirror {
  height: 90vh;
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
