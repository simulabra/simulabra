import base from './base.js';

export default await base.find('class', 'module').new({
  name: 'html',
  doc: 'html component classes for building applications',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.class.new({
      name: 'component',
      slots: [
        $.method.new({
          name: 'dom_id',
          do: function dom_id() {
            return `${this.class().name()}--${this.id()}`;
          }
        }),
        $.method.new({
          name: 'element',
          do: function element() {
            return document.getElementById(this.dom_id());
          }
        }),
        $.method.new({
          name: 'swap_target',
          do: function swap_target() {
            return this.element().querySelector('.swap-target');
          }
        }),
        $.method.new({
          name: 'container',
          do: function container(...children) {
            return $el.span({ id: this.dom_id(), class: this.class().name(), ref: this.uri() }, $el.span({ class: 'swap-target' }, ...children));
          }
        }),
        $.var.new({
          name: 'parent',
          default: null
        }),
        $.method.new({
          name: 'to_dom',
          do: function to_dom() {
            return this.container(this.render()).to_dom();
          }
        }),
        $.method.new({
          name: 'clear_swap_target',
          do: function clear_swap_target() {
            const st = this.swap_target();
            st.innerHTML = '';
          }
        }),
        $.method.new({
          name: 'swap',
          do: function swap() {
            this.clear_swap_target();
            const children = [this.render().to_dom()].flat(Infinity);
            for (const c of children) {
              this.swap_target().appendChild(c);
            }
          }
        }),
        $.event.new({
          name: 'update',
          do: function update(e) {
            if (this.element() && !e.swapped) {
              this.swap();
              e.swapped = true;
            }
          }
        }),
        $.after.new({
          name: 'dispatchEvent',
          do: function dispatchEvent(event) {
            this.parent()?.dispatchEvent(event);
          }
        })
      ]
    });
    $.class.new({
      name: 'window',
      slots: [
        $.component,
        $.var.new({ name: 'minimized', default: false }),
        $.method.new({
          name: 'toggle',
          do: function toggle() {
            this.minimized(!this.minimized());
            if (this.minimized()) {
              this.clear_swap_target();
            }
          }
        }),
        $.method.new({
          name: 'container',
          do: function container(...children) {
            return $el.div({
              id: this.dom_id(),
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
                  }, this.window_title())
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
        $.method.new({
          name: 'window_title',
          do: function window_title() {
            return this.title();
          }
        })
      ]
    });

    $.class.new({
      name: 'html_element',
      slots: [
        $.component,
        $.var.new({ name: 'tag', default: 'div' }),
        $.var.new({ name: 'properties', default: {} }),
        $.var.new({ name: 'events', default: {} }),
        $.var.new({ name: 'children', default: [] }),
        $.method.new({
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
                return node.to_dom();
              } catch (e) {
                this.log('failed to domify node', node);
                throw e;
              }
            }
          }
        }),
        $.method.new({
          name: 'to_dom',
          do: function to_dom() {
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
              if (Array.isArray(child)) {
                for (const n of child) {
                  elem.appendChild(this.domify(n));
                }
              } else {
                elem.appendChild(this.domify(child));
              }
            }
            elem.dispatchEvent(new Event('load'));
            return elem;
          }
        }),
        $.static.new({
          name: 'proxy',
          do: function proxy() {
            return new Proxy({}, {
              get(target, p) {
                return function(properties, ...children) {
                  return $.html_element.new({
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
    const $el = $.html_element.proxy();

    $.class.new({
      name: 'application',
      slots: [
        $.var.new({ name: 'command_history', default: [] }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.addEventListener('command', (e) => {
              this.process_command(e.target);
            });
            this.log('append css');
            const el = document.createElement('style');
            el.innerHTML = this.css();
            document.head.appendChild(el);
          }
        }),
        $.method.new({
          name: 'process_command',
          do: async function process_command(cmd) {
            this.log('process_command', cmd);
            try {
              await cmd.run(this);
              this.command_history().push(cmd);
            } catch (err) {
              this.log('command failed', cmd, err);
              this.dispatchEvent({ type: 'error', cmd, err })
            }
          }
        }),
        $.method.new({
          name: 'css',
          do: function css() {
            return '';
          }
        }),
      ]
    });

    $.class.new({
      name: 'button',
      slots: [
        $.component,
        $.var.new({ name: 'command' }),
        $.var.new({ name: 'slots' }),
        $.method.new({
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

    $.class.new({
      name: 'link',
      slots: [
        $.component,
        $.var.new({ name: 'command' }),
        $.var.new({ name: 'object' }),
        $.var.new({ name: 'properties', default: {} }),
        $.method.new({
          name: 'link_text',
          do: function link_text() {
            return this.object().title();
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            const uri = this.object().uri();
            return $el.a({
              href: '#',
              id: `link-${this.id()}`,
              object: uri,
              onclick: e => {
                this.log('click');
                return this.dispatchEvent({
                  type: 'command',
                  target: this.command(),
                });
              },
              ...this.properties()
            }, this.link_text());
          }
        })
      ]
    });

    $.class.new({
      name: 'if',
      slots: [
        $.var.new({ name: 'when' }),
        $.var.new({ name: 'slots', default: [] }),
        $.method.new({
          name: 'to_dom',
          do: function to_dom() {
            if (this.when()) {
              return this.slots().to_dom();
            } else {
              return ''.to_dom();
            }
          }
        })
      ]
    });
  }
}).load();
