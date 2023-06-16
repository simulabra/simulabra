import base from './base.js';

export default await base.find('class', 'module').new({
  name: 'html',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.class.new({
      name: 'component',
      components: [
        $.var.new({
          name: 'element',
        }),
        $.method.new({
          name: 'to_dom',
          do() {
            return this.render().to_dom();
          }
        }),
        $.after.new({
          name: 'init',
          do() {
            this.element(this.to_dom());
          }
        }),
        $.method.new({
          name: 'container',
          do() {
            return <div ref={this.uri()}></div>
          }
        }),
      ]
    });

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

  }
}).load();
