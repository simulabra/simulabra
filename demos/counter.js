import htmlModule from '../src/html.js';   // loads the classes
import { __, base } from '../src/base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'Counter',
    slots: [
      $.Signal.new({ name: 'count', default: 0 }),
      $.Method.new({ name: 'inc', do() { this.count(this.count() + 1); } }),
      $.Method.new({
        name: 'render',
        do() { 
          return $.HTML.t`
            <button id="clicky" onclick=${() => this.inc()}>
              clicked ${() => this.count()} times
            </button>
          `; 
        }
      })
    ]
  });

  $.Class.new({
    name: 'CounterList',
    slots: [
      $.Var.new({ name: 'counter' }),
      $.Method.new({
        name: 'render',
        do() { 
          let els = [];
          for (let i = 0; i < this.counter().count(); i++) {
            els.push($.HTML.t`<div>${i + 1}</div>`);
          }
          return els;
          }
      }),
    ]
  })

  $.Class.new({
    name: 'App',
    slots: [
      $.Component,
      $.Method.new({
        name: 'render',
        do() { 
          const counter = $.Counter.new();
          const counterList = $.CounterList.new({ counter });
          return $.HTML.t`
            <div>Here is a counter!
              ${() => counter.render()}
              ${() => counterList.render()}
            </div>
          `; 
        }
      }),
      $.Method.new({
        name: 'css',
        do() {
          return `
#clicky { color: red; }
`
        }
      })
    ]
  });

  $.App.new().mount();
}.module({ name: 'demo.counter', imports: [base, htmlModule] }).load();
