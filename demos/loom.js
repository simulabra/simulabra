import html from '../src/html.js';   // loads the classes
import { __, base } from '../src/base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'Loom',
    slots: [
      $.Var.new({ name: 'text' }),
      $.Var.new({ name: 'history' }),
      $.Method.new({
        name: 'render',
        do() {
          return $.HTML.t`
            <div class="loom">
              <div>
                ${() => this.choices()}
              </div>
              <div>
                <input bind="textEl" value=${this.text()} />
              </div>
            </div>
          `;
        }
      })
    ]
  });
  $.App.new().mount();
}.module({ name: 'demo.loom', imports: [base, html] }).load();
