import { __, base } from './base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'VNode',
    slots: [
      $.Var.new({ name: 'el' }),
      $.Method.new({
        name: 'mount',
        do(parent) {
          parent.appendChild(this.el());
        }
      }),
      $.Static.new({
        name: 'h',
        do(tag, props = {}, ...kids) {
          const el = document.createElement(tag);

          for (const [k, v] of Object.entries(props)) {
            el[k] = v;
          }

          for (const child of kids.flat()) {
            if (__.instanceOf(child, $.VNode)) {
              el.appendChild(child.el());
            } else if (typeof child === 'function') {
              const node = document.createTextNode('')
              el.appendChild(node);
              $.Effect.create(() => { 
                node.nodeValue = child();
              });
            } else {
              el.appendChild(document.createTextNode(child));
            }
          }

          return $.VNode.new({ el });
        }
      }),
    ]
  });
}.module({
  name: 'HTML',
  doc: 'HTML component classes for building Web applications',
  imports: [base],
}).load();
