import html from '../src/html.js';
import { __, base } from '../src/base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'SimulabraInfo',
    slots: [
      $.Component,
      $.Signal.new({ name: 'text' }),
      $.After.new({
        name: 'init',
        do() {
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          return $.HTML.t`
            <div class="">
Hey, this is SIMULABRA!
            </div>
          `;
        }
      })
    ]
  });
  $.SimulabraInfo.new().mount();
}.module({ name: 'demo.index', imports: [base, html] }).load();
