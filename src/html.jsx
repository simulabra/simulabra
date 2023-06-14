import base from './base.js';
const __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'html',
  imports: [base],
  async on_load(_, $) {
    $.class.new({
      name: 'html_element',
      components: [
        $.var.new({ name: 'tag', default: 'div' }),
        $.var.new({ name: 'properties', default: {} }),
        $.var.new({ name: 'events', default: {} }),
        $.var.new({ name: 'children', default: () => [] }),
        $.method.new({
          name: 'to_dom',
          do() {
            const elem = document.createElement(this.tag());
            for (const prop of Object.keys(this.properties())) {
              if (prop.indexOf('on') === 0) {
                const fn = this.properties()[prop];
                const self = this;
                elem.addEventListener(prop.slice(2), e => {
                  fn.apply(self, [e]);
                });
              } else {
                elem.setAttribute(prop, this.properties()[prop]);
              }
            }
            for (const child of this.children()) {
              const domify = (node) => {
                if (typeof node === 'object' && 'type' in node && typeof node.type === 'string') {
                  return node;
                } else {
                  return node.to_dom();
                }
              }
              elem.appendChild(domify(child));
            }
            for (const [name, fn] of Object.entries(this.events())) {
              elem['on' + name] = fn.bind(this);
            }
            return elem;
          }
        })
      ]
    });

    $.class.new({
      name: 'message_log',
      components: [
        $.var.new({ name: 'element' }),
        $.method.new({
          name: 'add',
          do(message) {
            this.element().appendChild(<div>{message}</div>);
          }
        }),
      ]
    });

    $.class.new({
      name: 'object_browser',
      components: [
        $.var.new({ name: 'element' }),
        $.var.new({ name: 'click' }),
        $.method.new({
          name: 'add',
          do(u) {
            this.element().appendChild(<div><a href="#" object={u} onclick={this.click()}>{globalThis.SIMULABRA.deref(u).title()}</a></div>);
          }
        }),
      ]
    });

    $.class.new({
      name: 'object_explorer',
      components: [
        $.var.new({ name: 'element' }),
        $.var.new({ name: 'object' }),
        $.after.new({
          name: 'init',
          do() {
            this.element().appendChild(<div>{this.object().name()}</div>);
          }
        }),
      ]
    });
  }
}).load();
