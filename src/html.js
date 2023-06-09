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
        $.var.new({ name: 'properties', default: () => {} }),
        $.var.new({ name: 'events', default: {} }),
        $.var.new({ name: 'children', default: () => [] }),
        $.method.new({
          name: 'to_dom',
          do() {
            const elem = document.createElement(this.tag());
            for (const prop in this.properties()) {
              elem.setAttribute(prop, this.properties()[prop]);
            }
            for (const child of this.children()) {
              elem.appendChild(child.to_dom());
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
            this.element().appendChild($.html_element.new({
              tag: 'div',
              properties: {},
              children: [message],
            }).to_dom());
          }
        }),
      ]
    });

    $.class.new({
      name: 'object_explorer',
      components: [
        $.var.new({ name: 'element' }),
        $.var.new({ name: 'click' }),
        $.method.new({
          name: 'add',
          do(u) {
            this.element().appendChild($.html_element.new({
              tag: 'div',
              properties: {},
              events: {
                click: this.click(),
              },
              children: [u],
            }).to_dom());
          }
        }),
      ]
    });
  }
}).load();
