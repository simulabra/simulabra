import htmlModule from '../src/html.js';   // loads the classes
import { __, base } from '../src/base.js';

export default await function (_, $, $base, $html) {
  $base.Class.new({
    name: 'Counter',
    slots: [
      $base.Signal.new({ name: 'count', default: 0 }),
      $base.Method.new({ name: 'inc', do() { this.count(this.count() + 1); } }),
      $base.Method.new({
        name: 'render',
        do() { 
          return $html.HTML.t`
            <button id="clicky" onclick=${() => this.inc()}>
              clicked <span id="clicky-number">${() => this.count()}</span> times
            </button>
          `; 
        }
      })
    ]
  });

  $base.Class.new({
    name: 'CounterList',
    slots: [
      $base.Var.new({ name: 'counter' }),
      $base.Method.new({
        name: 'render',
        do() { 
          return Array.from(
            { length: this.counter().count() },
            (it, idx) => $html.HTML.t`<div>${idx + 1}</div>`
          );
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'App',
    slots: [
      $html.Component,
      $base.Method.new({
        name: 'render',
        do() { 
          const counter = $.Counter.new();
          const counterList = $.CounterList.new({ counter });
          return $html.HTML.t`
            <div>Here is a counter!
              ${() => counter.render()}
              ${() => counterList.render()}
            </div>
          `; 
        }
      }),
      $base.Method.new({
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
