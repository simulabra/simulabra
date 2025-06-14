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
            temperature: config.temp(),
            max_tokens: config.toklen(),
            logprobs: 50,
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
        name: 'numthreads',
        doc: 'number of threads',
        default: 4,
      }),
      $.Signal.new({
        name: 'toklen',
        doc: 'length of thread in tokens',
        default: 8,
      }),
      $.Signal.new({
        name: 'temp',
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
            this.configline('numthreads'),
            this.configline('toklen'),
            this.configline('temp', 0.1),
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
        name: 'weave',
        do() {
          const cmd = this.loom().weave(this);
        }
      }),
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
    name: 'Logprob',
    slots: [
      $.Component,
      $.Var.new({ name: 'text' }),
      $.Var.new({ name: 'logprob' }),
      $.Var.new({ name: 'loom' }),
      $.Method.new({
        name: 'weave',
        do() {
          const cmd = this.loom().weave(this);
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          // const opacity = Math.tanh(this.logprob()) + 0.5;
          return $.HTML.t`
          <button class="thread" onclick=${() => this.loom().weave(this).run()}>
            <div class="logprob-token">"${this.text().replaceAll('\\', '\\\\')}"</div><span class="logprob">${this.logprob().toPrecision(2)}</span>
          </button>
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
      $.Signal.new({ name: 'logprobs' }),
      $.Signal.new({ name: 'loading', default: false }),
      $.Signal.new({ name: 'editing', default: false }),
      $.Var.new({ name: 'client' }),
      $.Var.new({ name: 'config' }),
      $.After.new({
        name: 'init',
        do() {
          this.config($.LoomConfig.new());
          this.client($.V1Client.new());
          this.text('A text loom is');
          this.choices([]);
          this.logprobs([]);
          this.history([]);
        }
      }),
      $.Method.new({
        name: 'spin',
        doc: 'generate a possible thread from the model',
        async: true,
        do: async function() {
          const res = await this.client().completion(this.text(), this.config());
          if (this.logprobs().length === 0) {
            const logprobs = res.choices[0].logprobs.content[0].top_logprobs;
            let lptot = 0;
            for (const lp of logprobs) {
              lp.logprob = Math.exp(lp.logprob);
              lptot += lp.logprob;
            }
            for (const lp of logprobs) {
              lp.logprob = lp.logprob / lptot;
            }
            this.logprobs(logprobs.map(l => $.Logprob.new({
              text: l.token,
              logprob: l.logprob,
              loom: this,
            })));

            this.logprobs().sort((a, b) => b.logprob() - a.logprob());
          }
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
          this.text(document.querySelector('.loom-textarea').value);
          this.choices([]);
          this.logprobs([]);
          this.loading(true);
          for (let i = 0; i < this.config().numthreads(); i++) {
            const thread = await this.spin();
            this.choices([...this.choices(), thread]);
          }
          this.loading(false);
        },
      }),
      $.Command.new({
        name: 'weave',
        run: function(c, t) {
          document.querySelector('.loom-textarea').blur();
          this.text(this.text() + t.text());
          document.querySelector('.loom-textarea').value = this.text();
          this.seek();
        }
      }),
      $.Method.new({
        name: 'runcommand',
        do(cmd) {
          cmd.run(this);
          this.history([...this.history(), cmd]);
        }
      }),
      $.Method.new({
        name: 'loomText',
        do() {
          return $.HTML.t`<textarea class="loom-textarea">${() => this.text()}</textarea>`
        }
      }),
      $.Method.new({
        name: 'toggleEditing',
        do() {
          if (this.editing()) {
            this.text(document.querySelector('.loom-textarea').value);
          }
          this.editing(!this.editing());
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
              <button onclick=${() => this.toggleEditing()}>${() => this.editing() ? 'stop' : 'start'} editing</button>
              <button class="seek" onclick=${() => this.seek()}>seek</button>
              ${() => (this.loading() ? $.HTML.t`<div class="spinner"></div>` : [])}
              ${() => this.loomText()}
              <div>
                ${() => this.choices()}
              </div>
              <div class="logprobs">
<div>logprobs (top 50)</div>
                ${() => this.logprobs()}
              </div>
            </div>
          `;
        }
      })
    ]
  });
  $.Loom.new().mount();
}.module({ name: 'demo.loom', imports: [base, html] }).load();
