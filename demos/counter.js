import { __, base } from '../src/base.js';
import html from '../src/html.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'Counter',
    slots: [
      $.Signal.new({
        name: 'count',
        default: 0
      }),
      $.Method.new({
        name: 'inc',
        do() {
          this.count(this.count() + 1);
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          // return __.h`<button onclick=${() => this.inc()}>clicked ${this.count()} times</button>`;
          return $.VNode.h(
            'button', 
            { onclick: () => this.inc() },
            () => `clicked ${this.count()} times`,
          );
        }
      }),
    ]
  });

  const counter = $.Counter.new();
  counter.render().mount(document.body);
}.module({
  name: 'counter',
  imports: [base, html],
}).load();
