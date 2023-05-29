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
            return elem;
          }
        })
      ]
    });
  }
}).load();
