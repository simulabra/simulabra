import html from '../src/html.js';
import { __, base } from '../src/base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'V1Client',
    doc: 'wrapper for openai v1 api compatible apis',
    slots: [
      $.Var.new({ name: 'baseURL', default: 'http://localhost:3731' }),
      $.Var.new({ name: 'key', default: 'skfake' }),
      $.Var.new({ name: 'localStorageKey', default: 'LOOM_API_KEY' }),
      $.Var.new({ name: 'model', default: 'meta-llama/llama-3.1-405b' }),
      $.After.new({
        name: 'init',
        do() {
          this.key(localStorage.getItem(this.localStorageKey()) || '');
        }
      }),
      $.Method.new({
        name: 'changekey',
        do(key) {
          this.key(key);
          localStorage.setItem(this.localStorageKey(), this.key());
        }
      }),
      $.Method.new({
        name: 'completion',
        async: true,
        do: async function completion(prompt, config) {
          const options = {
            model: this.model(),
            prompt,
            input: prompt,
            temperature: config.temp(),
            max_tokens: config.toklen(),
            top_logprobs: 50,
            provider: {
              only: ['hyperbolic/bf16'],
            },
          };
          const res = await fetch(`${this.baseURL()}/v1/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.key()}`,
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
      $.Var.new({ name: 'loom' }),
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
      $.Signal.new({
        name: 'keymode',
        doc: 'show api key input',
        default: false,
      }),
      $.Method.new({
        name: 'togglekeymode',
        do() {
          if (this.keymode()) {
            this.loom().client().changekey(document.querySelector("#api-key-input").value);
          }
          this.keymode(!this.keymode());
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          return [
            $.HTML.t`<button onclick=${() => this.togglekeymode()}>enter key</button>`,
            this.keymode() ? $.HTML.t`<input id="api-key-input" type="text" placeholder="api key" value=${() => this.loom().client().key()} />` : '',
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
          <div class="thread" onclick=${() => this.loom().weave(this).run()}>${this.text()}</div>
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
          let p = this.logprob().toPrecision(2);
          if (p.length > 5) p = '<0.01';
          return $.HTML.t`
          <span class="thread" onclick=${() => this.loom().weave(this).run()}>
            <span class="logprob-token">"${this.text().replaceAll('\\', '\\\\')}"</span><span class="logprob">${p}</span>
          </span>
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
          this.config($.LoomConfig.new({ loom: this }));
          this.client($.V1Client.new({
            baseURL: 'https://openrouter.ai/api',
          }));
          this.text('one hundred thousand miles per hour');
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
          if (res.choices[0].logprobs) {
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
