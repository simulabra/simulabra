import { __, base } from './base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'VNode',
    slots: [
      $.Var.new({ name: 'el' }),
      $.Var.new({ name: 'mountPoint' }),
      $.Method.new({
        name: 'mount',
        do(parent) {
          this.mountPoint(parent);
          parent.appendChild(this.el());
        }
      }),
      $.Static.new({
        name: 'h',
        do(tag, props = {}, ...kids) {
          const el = document.createElement(tag);

          Object.entries(props).forEach(([k, v]) => {
            el[k] = v;
          });

          const append = child => {
            if (child?.el) {
              el.appendChild(child.el());
            } else if (typeof child === 'function') {
              $.Effect.create(() => { 
                el.replaceChildren();
                el.appendChild(document.createTextNode(child())); 
              });
            } else {
              el.appendChild(document.createTextNode(child));
            }
          };
          kids.flat().forEach(append);

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
