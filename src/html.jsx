import base from './base.js';

export default await base.find('class', 'module').new({
  name: 'html',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.class.new({
      name: 'component',
      slots: [
        $.method.new({
          name: 'container',
          do() {
            return <div class={this.class().name()} ref={this.uri()}></div>
          }
        }),
        $.method.new({
          name: 'inner',
          do(...objs) {
            this.element(this.container());
            this.element().children(objs);
          }
        }),
        $.var.new({
          name: 'element',
        }),
        $.method.new({
          name: 'render',
          do() {
            this.element().children(this.children());
          }
        }),
        $.var.new({
          name: 'children',
          default: []
        }),
        $.method.new({
          name: 'to_dom',
          do() {
            this.render();
            return this.element().to_dom();
          }
        }),
        $.method.new({
          name: 'add_child',
          do(child) {
            this.children().push(child);
          }
        }),
        $.after.new({
          name: 'init',
          do() {
            this.element(this.container());
          }
        }),
      ]
    });

    $.class.new({
      name: 'html_element',
      slots: [
        $.var.new({ name: 'tag', default: 'div' }),
        $.var.new({ name: 'properties', default: {} }),
        $.var.new({ name: 'events', default: {} }),
        $.var.new({ name: 'children', default: [] }),
        $.method.new({
          name: 'to_dom',
          override: true,
          do() {
            this.log(this);
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
                console.log(node);
                if (typeof node === 'object' && 'type' in node && typeof node.type === 'string') {
                  return node;
                } else if (typeof node === 'string') {
                  return document.createTextNode(node);
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
