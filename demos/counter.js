import htmlModule from '../src/html.js';   // loads the classes
import { __, base } from '../src/base.js';

export default await async function (_, $, $html) {
  $.Class.new({
    name: 'Counter',
    slots: [
      $.Signal.new({ name: 'count', default: 0 }),
      $.Method.new({ name: 'inc', do() { this.count(this.count() + 1); } }),
      $.Method.new({
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

  $.Class.new({
    name: 'CounterList',
    slots: [
      $.Var.new({ name: 'counter' }),
      $.Method.new({
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

  $.Class.new({
    name: 'App',
    slots: [
      $html.Component,
      $.Method.new({
        name: 'render',
        do() {
          const counter = _.Counter.new();
          const counterList = _.CounterList.new({ counter });
          return $html.HTML.t`
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

  _.App.new().mount();
}.module({ name: 'demo.counter', imports: [base, htmlModule] }).load();
