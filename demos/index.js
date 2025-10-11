import html from '../src/html.js';
import { __, base } from '../src/base.js';

export default await function (_, $, $base, $html) {
  $base.Class.new({
    name: 'SimulabraInfo',
    slots: [
      $html.Component,
      $base.Signal.new({ name: 'text' }),
      $base.After.new({
        name: 'init',
        do() {
        }
      }),
      $base.Method.new({
        name: 'render',
        do() {
          return $html.HTML.t`
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
