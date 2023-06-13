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
            // <div><a href="#" onclick={this.click()}>u</a></div>
            this.element().appendChild($.html_element.new({
              tag: 'div',
              children: [$.html_element.new({
                tag: 'a',
                properties: { href: '#' },
                events: {
                  click: this.click(),
                },
                children: [u],
              })]
            }).to_dom());
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
            // <div>{this.object().name()}</div>
            this.element().appendChild($.html_element.new({
              tag: 'div',
              children: [this.object().name()]
            }).to_dom());
          }
        }),
      ]
    });
  }
}).load();

/*
I want to make a JSX-like transformer for my object framework as a shorthand for creating dynamic HTML elements.
```
```
Take me through what a basic implementation would look like,
 */
