import base from './base.js';

export default await base.find('Class', 'Module').new({
  name: 'HTML',
  doc: 'HTML component classes for building Web applications',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.Class.new({
      name: 'Component',
      slots: [
        $.Method.new({
          name: 'domID',
          do: function domID() {
            return `${this.class().name()}--${this.id()}`;
          }
        }),
        $.Method.new({
          name: 'element',
          do: function element() {
            return document.getElementById(this.domID());
          }
        }),
        $.Method.new({
          name: 'swapTarget',
          do: function swapTarget() {
            return this.element().querySelector('.swap-target');
          }
        }),
        $.Method.new({
          name: 'container',
          do: function container(...children) {
            return $el.span({ id: this.domID(), class: this.class().name(), ref: this.uri() }, $el.span({ class: 'swap-target' }, ...children));
          }
        }),
        $.Var.new({
          name: 'parent',
          default: null
        }),
        $.Method.new({
          name: 'toDOM',
          do: function toDOM() {
            return this.container(this.render()).toDOM();
          }
        }),
        $.Method.new({
          name: 'load',
          do: function load(e) {
            // this.log('load', e);
          }
        }),
        $.Method.new({
          name: 'clearSwapTarget',
          do: function clearSwapTarget() {
            const st = this.swapTarget();
            st.innerHTML = '';
          }
        }),
        $.Method.new({
          name: 'swap',
          do: function swap() {
            this.clearSwapTarget();
            const children = [this.render().toDOM()].flat(Infinity);
            for (const c of children) {
              this.swapTarget().appendChild(c);
            }
            this.load(this.element());
          }
        }),
        $.event.new({
          name: 'update',
          do: function update(e) {
          }
        }),
        $.After.new({
          name: 'dispatchEvent',
          do: function dispatchEvent(event) {
            this.parent()?.dispatchEvent(event);
          }
        })
      ]
    });
    $.Class.new({
      name: 'Window',
      slots: [
        $.Component,
        $.Var.new({ name: 'minimized', default: false }),
        $.Method.new({
          name: 'toggle',
          do: function toggle() {
            this.minimized(!this.minimized());
            if (this.minimized()) {
              this.clearSwapTarget();
            }
          }
        }),
        $.Method.new({
          name: 'container',
          do: function container(...children) {
            return $el.div({
              id: this.domID(),
              class: `windowed ${this.class().name()}`,
              ref: this.uri()
            }, [
              $el.span({
                class: 'window-bar'
              }, [
                $el.span({
                  class: 'window-info'
                }, [
                  // $el.span({
                  //   class: 'window-layout',
                  //   onclick: e => {
                  //     e.preventDefault();
                  //     this.toggle();
                  //   },
                  //   onmousedown: e => e.preventDefault()
                  // }),
                  $el.span({
                    class: 'window-title'
                  }, this.windowTitle())
                ])
              ]),
              $el.div({
                class: 'window-body'
              }, [
                $el.span({
                  class: 'swap-target'
                }, !this.minimized() ? children : [])
              ])
            ]);
          }
        }),
        $.Method.new({
          name: 'windowTitle',
          do: function windowTitle() {
            return this.title();
          }
        })
      ]
    });

    $.Class.new({
      name: 'HtmlElement',
      slots: [
        $.Component,
        $.Var.new({ name: 'tag', default: 'div' }),
        $.Var.new({ name: 'properties', default: {} }),
        $.Var.new({ name: 'events', default: {} }),
        $.Var.new({ name: 'children', default: [] }),
        $.Method.new({
          name: 'domify',
          do: function domify(node) {
            if (typeof node === 'object' && 'type' in node && typeof node.type === 'string') {
              return node;
            } else if (typeof node === 'string') {
              return document.createTextNode(node);
            } else if (node instanceof Node) {
              return node;
            } else {
              try {
                return node.toDOM();
              } catch (e) {
                this.log('failed to domify node', node);
                throw e;
              }
            }
          }
        }),
        $.Method.new({
          name: 'attachToElement',
          do: function attachToElement(elem, child) {
              if (Array.isArray(child)) {
                for (const n of child) {
                  this.attachToElement(elem, n);
                }
              } else {
                elem.appendChild(this.domify(child));
                if (typeof child === 'object' && 'load' in child) {
                  child.load();
                }
              }
          }
        }),
        $.Method.new({
          name: 'toDOM',
          do: function toDOM() {
            const elem = document.createElement(this.tag());
            for (const pkey of Object.keys(this.properties())) {
              const prop = this.properties()[pkey];
              if (typeof prop === 'string') {
                elem.setAttribute(pkey, prop);
              } else {
                elem.setAttribute('directed', pkey);
                if (pkey.startsWith('on')) {
                  const eventName = pkey.slice(2).toLowerCase();
                  elem.addEventListener(eventName, prop);
                } else {
                  elem[pkey] = prop;
                }
              }
            }
            for (const child of this.children()) {
              this.attachToElement(elem, child);
            }
            elem.dispatchEvent(new Event('load'));
            // this.load(elem);
            return elem;
          }
        }),
        $.Static.new({
          name: 'proxy',
          do: function proxy() {
            return new Proxy({}, {
              get(target, p) {
                return function(properties, ...children) {
                  return $.HtmlElement.new({
                    tag: p,
                    properties,
                    children
                  });
                };
              }
            });
          }
        }),
      ]
    });
    const $el = $.HtmlElement.proxy();

    $.Class.new({
      name: 'Application',
      slots: [
        $.Var.new({ name: 'commandHistory', default: [] }),
        $.After.new({
          name: 'init',
          do: function init() {
            this.addEventListener('command', (e) => {
              this.processCommand(e.target);
            });
            this.log('append css');
            const el = document.createElement('style');
            el.innerHTML = this.css();
            document.head.appendChild(el);
          }
        }),
        $.Method.new({
          name: 'processCommand',
          do: async function processCommand(cmd) {
            this.log('processCommand', cmd);
            try {
              await cmd.run(this);
              this.commandHistory().push(cmd);
            } catch (err) {
              this.log('command failed', cmd, err);
              this.dispatchEvent({ type: 'error', cmd, err })
            }
          }
        }),
        $.Method.new({
          name: 'css',
          do: function css() {
            return '';
          }
        }),
      ]
    });

    $.Class.new({
      name: 'Button',
      slots: [
        $.Component,
        $.Var.new({ name: 'command' }),
        $.Var.new({ name: 'slots' }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.button({
              id: `button-${this.id()}`,
              onclick: e => {
                return this.dispatchEvent({
                  type: 'command',
                  target: this.command(),
                });
              }
            }, this.slots()[0]);
          }
        })
      ]
    });

    $.Class.new({
      name: 'Link',
      slots: [
        $.Component,
        $.Var.new({ name: 'command' }),
        $.Var.new({ name: 'object' }),
        $.Var.new({ name: 'properties', default: {} }),
        $.Method.new({
          name: 'linkText',
          do: function linkText() {
            return this.object().title();
          }
        }),
        $.Method.new({
          name: 'subtext',
          do: function subtext() {
            return '';
          }
        }),
        $.Method.new({
          name: 'hover',
          do: function hover() {
          }
        }),
        $.Method.new({
          name: 'unhover',
          do: function unhover() {
          }
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            const uri = this.object().uri();
            let hovering = false;
            return $el.span({
              class: 'link_body',
              onclick: e => {
                this.log('click');
                return this.dispatchEvent({
                  type: 'command',
                  target: this.command(),
                });
              },
              onmouseover: e => {
                if (!hovering) {
                  hovering = true;
                  e.preventDefault();
                  this.hover();
                }
              },
              onmouseleave: e => {
                e.preventDefault();
                hovering = false;
                this.unhover();
              },
              id: `link-${this.id()}`,
              object: uri,
              ...this.properties()
            },
              this.linkText(),
              $el.span({ class: 'subtext' }, this.subtext())
            );
          }
        })
      ]
    });

    $.Class.new({
      name: 'If',
      slots: [
        $.Var.new({ name: 'when' }),
        $.Var.new({ name: 'slots', default: [] }),
        $.Method.new({
          name: 'toDOM',
          do: function toDOM() {
            if (this.when()) {
              return this.slots().toDOM();
            } else {
              return ''.toDOM();
            }
          }
        })
      ]
    });

    $.Class.new({
      name: 'NumberInput',
      slots: [
        $.Component,
        $.Var.new({ name: 'value' }),
        $.Var.new({ name: 'step', default: 1 }),
        $.Var.new({ name: 'bind' }),
        $.Var.new({ name: 'command' }),
        $.After.new({
          name: 'init',
          do: function init() {
            this.value(this.parent()[this.bind()](), false);
          }
        }),
        $.Method.new({
          name: 'render',
          do: function render(ctx) {
            return $el.span(
              {},
              this.name(),
              $el.input({
                class: 'NumberInput_input',
                type: 'number',
                value: this.value(),
                step: this.step(),
                onchange: e => {
                  this.value(+e.target.value, false);
                  this.command().new({ target: this.parent(), value: this.value() }).dispatchTo(this);
                }
              })
            );
          }
        }),
        $.After.new({
          name: 'value',
          do: function value__after(setValue) {
            this.log('after value');
            if (this.element() && setValue !== undefined) {
              this.log('update??');
              this.element().querySelector('.NumberInput_input').value = setValue;
            }
          }
        }),
      ]
    });

    $.Class.new({
      name: 'Input',
      slots: [
        $.Component,
        $.Var.new({ name: 'value', default: '' }),
        $.Var.new({ name: 'textarea' }),
        $.Method.new({
          name: 'autoheight',
          do: function autoheight() {
            const el = this.element();
            // el.style.height = 'auto';
            if (el) {
              el.style.height = el.scrollHeight + 'px';
            }
          }
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.textarea({
              id: this.inputID(),
              style: 'height: 0px;',
              oninput: e => {
                this.value(e.target.value, false);
                this.autoheight();
              },
              onload: e => {
                e.target.value = this.value();
                setTimeout(() => {
                  this.autoheight();
                  e.target.scrollTop = e.target.scrollHeight;
                }, 0);
              },
              onblur: (e) => {
                this.dispatchEvent({
                  'type': 'blur',
                });
              },
              placeholder: this.placeholder(),
            }, this.value());
          }
        }),
        $.Method.new({
          name: 'set',
          do: function set(value) {
            this.value(value);
            if (this.element()) {
              this.element().value = value;
            }
          }
        }),
        $.Method.new({
          name: 'inputID',
          do: function inputID() {
            return `input-${this.name()}`;
          }
        }),
        $.Method.new({
          name: 'element',
          do: function element() {
            return document.getElementById(this.inputID());
          }
        }),
        $.Method.new({
          name: 'active',
          do: function active() {
            return this.element() === document.activeElement;
          }
        }),
        $.Method.new({
          name: 'placeholder',
          do: function placeholder() {
            return `${this.name()}...`;
          }
        }),
        $.Method.new({
          name: 'blur',
          do: function blur() {
            this.element().blur();
          }
        }),
        $.Method.new({
          name: 'focus',
          do: function focus() {
            this.element().focus();
          }
        }),
        $.Method.new({
          name: 'moveToEnd',
          do: function moveToEnd() {
            const endp = this.value().length;
            this.element().setSelectionRange(endp, endp);
          }
        }),
      ]
    });

    $.Class.new({
      name: 'TogglyInput',
      slots: [
        $.Component,
        $.Var.new({ name: 'input', default() {
          return $.input.new({
            name: this.name(),
            parent: this,
          })
        } }),
        $.Var.new({ name: 'active', default: false }),
        $.Var.new({ name: 'preview_text', default: '' }),
        $.Var.new({ name: 'preview_hide', default: false }),
        $.event.new({
          name: 'blur',
          do: function onblur(e) {
            this.active(false);
          }
        }),
        $.Method.new({
          name: 'value',
          do: function value() {
            return this.input().value();
          }
        }),
        $.Method.new({
          name: 'set',
          do: function set(value) {
            this.input().set(value);
            if (this.element()) {
              const text = this.element().querySelector('.TogglyInput_container');
              text.childNodes[0].innerHTML = value; // ????
            }
          }
        }),
        $.Method.new({
          name: 'preview',
          do: function preview(text, hide = false) {
            if (text !== undefined) {
              this.active(false);
              this.preview_text(text);
              const previewElem = this.element().querySelector('.TogglyInput_preview');
              previewElem.innerHTML = text;
              previewElem.hidden = hide;
            }
            return this.preview_text();
          }
        }),
        $.Method.new({
          name: 'blur',
          do: function blur() {
            if (this.active()) {
              this.input().blur();
              this.active(false);
            }
          }
        }),
        $.After.new({
          name: 'active',
          do: function active__after(value) {
            if (!this.element()) return;
            const input = this.element().querySelector('.TogglyInput_input');
            const text = this.element().querySelector('.TogglyInput_container');

            if (value !== undefined) {
              input.hidden = !value;
              text.hidden = value;
            }
            if (value === false) {
              text.childNodes[0].innerText = this.value(); // ????
            }
          }
        }),
        $.Method.new({
          name: 'focus',
          do: function focus() {
            this.active(true);
            this.input().focus();
            this.input().moveToEnd();
          }
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div(
              {},
              $el.div({ class: 'TogglyInput_name' }, this.name(), $el.span({ class: 'subtext' }, `[i] ${this.value().length}c`)),
              $el.span({ class: 'TogglyInput_input' }, this.input()),
              $el.div(
                {
                  class: 'TogglyInput_container',
                  hidden: !this.active(),
                  onload: e => {
                    setTimeout(() => {
                      e.target.scrollTop = e.target.scrollHeight;
                    }, 0);
                  },
                  onclick: e => {
                    this.focus();
                  },
                },
                $el.span({ class: 'TogglyInput_text', hidden: this.active() }, this.value()),
                $el.span({ class: 'TogglyInput_preview' }, this.preview())),
            )
          }
        }),
      ]
    });
  }
}).load();
