import html from '../src/html.js';
import { __, base } from '../src/base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'V1Client',
    doc: 'wrapper for openai v1 api compatible apis',
    slots: [
      $.Var.new({ name: 'baseURL', default: 'http://localhost:3731' }),
      $.Var.new({ name: 'model', default: 'none' }),
      $.Method.new({
        name: 'completion',
        async: true,
        do: async function completion(prompt, config) {
          const options = {
            prompt,
            temperature: config.t(),
            max_tokens: config.l(),
          };
          const res = await fetch(`${this.baseURL()}/v1/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options),
          });
          const json = await res.json();
          return json;
        }
      }),
    ]
  });
  $.Class.new({
    name: 'LoomConfig',
    slots: [
      $.Component,
      $.Signal.new({
        name: 'n',
        doc: 'number of threads',
        default: 4,
      }),
      $.Signal.new({
        name: 'l',
        doc: 'length of thread in tokens',
        default: 8,
      }),
      $.Signal.new({
        name: 't',
        doc: 'generation temperature',
        default: 1.0,
      }),
      $.Method.new({
        name: 'configline',
        do(c, step=1) {
          return $.HTML.t`<div>${c}: <input class="config-number" step=${step} type="number" min="0" value=${() => this[c]()} onchange=${e => this[c](+e.target.value)} /></div>`;
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          return [
            this.configline('n'),
            this.configline('l'),
            this.configline('t', 0.1),
          ];
        }
      }),
    ]
  });
  $.Class.new({
    name: 'Thread',
    slots: [
      $.Component,
      $.Var.new({ name: 'text' }),
      $.Var.new({ name: 'loom' }),
      $.Method.new({
        name: 'render',
        do() {
          return $.HTML.t`
          <div><button class="thread" onclick=${() => this.loom().weave(this).run()}>${this.text()}</button></div>
          `;
        }
      }),
    ]
  });
  $.Class.new({
    name: 'Loom',
    slots: [
      $.Component,
      $.Signal.new({ name: 'text' }),
      $.Signal.new({ name: 'history' }),
      $.Signal.new({ name: 'choices' }),
      $.Var.new({ name: 'client' }),
      $.Var.new({ name: 'config' }),
      $.After.new({
        name: 'init',
        do() {
          this.config($.LoomConfig.new());
          this.client($.V1Client.new());
          this.text('there once was a brilliant loomer');
          this.choices([]);
        }
      }),
      $.Method.new({
        name: 'spin',
        doc: 'generate a possible thread from the model',
        async: true,
        do: async function() {
          const res = await this.client().completion(this.text(), this.config());
          return $.Thread.new({
            text: res.choices[0].text,
            loom: this,
          });
        }
      }),
      $.Command.new({
        name: 'seek',
        doc: 'make new threads to search',
        async: true,
        run: async function() {
          this.choices([]);
          for (let i = 0; i < this.config().n(); i++) {
            this.choices([...this.choices(), await this.spin()]);
          }
        },
      }),
      $.Command.new({
        name: 'weave',
        run: function(c, t) {
          this.text(this.text() + t.text());
          this.log('woven', this.text());
          this.seek();
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          return $.HTML.t`
            <div class="loom">
              <div>
                ${() => this.config()}
              </div>
              <div>
                ${() => this.text()}
              </div>
              <div>
                ${() => this.choices()}
              </div>
              <button onclick=${() => this.seek()}>seek</button>
            </div>
          `;
        }
      })
    ]
  });
  $.Loom.new().mount();
}.module({ name: 'demo.loom', imports: [base, html] }).load();
