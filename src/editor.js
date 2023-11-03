import base from './base.js';
import html from './html.js';

export default await base.find('class', 'module').new({
  name: 'editor',
  doc: 'classes for the simulabra editor',
  imports: [base, html],
  on_load(_, $) {
    const __ = globalThis.SIMULABRA;
    const $el = $.html_element.proxy();

    $.class.new({
      name: 'message',
      slots: [
        $.component,
        $.var.new({ name: 'text' }),
        $.var.new({ name: 'time' }),
        $.method.new({
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
            return $el.div({}, ...this.message_list().map(m => m.render()));
          }
        }),
      ]
    });

    $.class.new({
      name: 'explorer_select_link',
      slots: [
        $.link,
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
        $.window,
        $.method.new({
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
        $.window,
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
      name: 'codemirror',
      slots: [
        $.window,
        $.var.new({ name: 'editor' }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $el.div(
              {},
              $el.div({
                onload: async e => {
                  this.log(e.target);
                  this.editor(CodeMirror(e.target, {
                    mode: 'javascript',
                    theme: 'gruvbox-dark',
                  }));
                  const todos = await fetch('/todos.demo.js');
                  const text = await todos.text();
                  this.editor().setValue(text);
                }
              }),
              $el.button({
                onclick: async e => {
                  const todo_mod = (await this.import_module()).default;
                  this.log(todo_mod);
                }
              },
                'run!'
              )
            );
          }
        }),
        $.method.new({
          name: 'import_module',
          do: function import_module() {
            const code = this.editor().getValue();
            const blob = new Blob([code], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            return import(url);
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
            if (this.value() !== null && (typeof this.value() === 'function' || typeof this.value() === 'object' && '_id' in this.value())) {
              return $.explorer_select_link.new({ object: this.value(), parent: this });
            } else if (Array.isArray(this.value())) {
              return $el.span({},
                'list(' + this.value().length + ')',
                this.value().map((it, idx) => $el.div({ class: 'array-item' }, $.slot_value.new({ slot_name: idx, value: it, parent: this }).display())));
            } else if (this.value() !== null && 'to_dom' in (Object.getPrototypeOf(this.value()) || {})) {
              return this.value();
            } else if (this.value() instanceof WeakRef) {
              const ref = this.value().deref();
              if (ref !== undefined) {
                return $.slot_value.new({ slot_name: this.slot_name(), value: ref }).display();
              } else {
                return $el.span({}, '(empty ref)');
              }
            } else {
              this.log(this.value());
              return $el.span({}, this.value()?.description() ?? JSON.stringify(this.value()));
            }
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $el.div({}, this.slot_name() + ':', this.display());
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
      name: 'editor',
      slots: [
        $.window,
        $.application,
        $.var.new({ name: 'messages' }),
        $.var.new({ name: 'explorer' }),
        $.var.new({ name: 'modules' }),
        $.var.new({ name: 'codemirror' }),
        $.after.new({
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
        $.before.new({
          name: 'process_command',
          do: function process_command(cmd) {
            this.messages().add('run: ' + cmd.description());
          }
        }),
        $.method.new({
          name: 'load_modules',
          do: function load_modules() {
            this.modules(__.base().instances($.module).map(it => $.module_browser.new({ name: it.name(), module: it, parent: this })));
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $el.div({ class: 'container' }, [
              $el.div({ class: 'col' }, [$.intro.new(), this.modules()]),
              $el.div({ class: 'col' }, [this.codemirror(), $el.div({ id: 'todos-container' })]),
              $el.div({ class: 'col' }, [this.explorer(), this.messages()])
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

.module-doc {
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
