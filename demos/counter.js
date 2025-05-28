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
              clicked <span id="clicky-number">${() => this.count()}</span> times
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
          return Array.from(
            { length: this.counter().count() },
            (it, idx) => $.HTML.t`<div>${idx + 1}</div>`
          );
        }
      }),
    ]
  });

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
#clicky-number { color: var(--dusk); }
`
        }
      })
    ]
  });

  $.App.new().mount();
}.module({ name: 'demo.counter', imports: [base, htmlModule] }).load();
