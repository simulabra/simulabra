// SIMULABRA POWERLOOM

import html from '../src/html.js';
import { __, base } from '../src/base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'V1Client',
    doc: 'wrapper for openai v1 api compatible apis',
    slots: [
      $.Component,
      $.Signal.new({ name: 'baseURL', default: 'http://localhost:3731' }),
      $.Signal.new({ name: 'key', default: '' }),
      $.Var.new({ name: 'localStorageKey', default: 'LOOM_' }),
      $.Signal.new({
        name: 'keymode',
        doc: 'show api key input',
        default: false,
      }),
      $.Method.new({
        name: 'togglekeymode',
        do() {
          this.keymode(!this.keymode());
        }
      }),
      $.After.new({
        name: 'init',
        do() {
          this.key(localStorage.getItem(this.localStorageKey() + 'KEY') || '');
          this.baseURL(localStorage.getItem(this.localStorageKey() + 'BASEURL') || '');
        }
      }),
      $.Method.new({
        name: 'update',
        do() {
          this.key(document.getElementById('key-input').value);
          localStorage.setItem(this.localStorageKey() + 'KEY', this.key());
          this.baseURL(document.getElementById('baseURL-input').value);
          localStorage.setItem(this.localStorageKey() + 'BASEURL', this.baseURL());
        }
      }),
      $.Method.new({
        name: 'completion',
        async: true,
        do: async function completion(prompt, config = {}) {
          const body = {
            prompt,
            logprobs: 20,
            ...config
          };
          const res = await fetch(`${this.baseURL()}/v1/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.key()}`,
            },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          return json;
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          const inp = (v) => $.HTML.t`<input id=${v + '-input'} type="text" placeholder=${v} value=${() => this[v]()} />`;
          return [
            $.HTML.t`<button onclick=${() => this.togglekeymode()}>${() => !this.keymode() ? 'show' : 'hide'} client settings</button>`,
            $.HTML.t`
              <div class="loom-col" hidden=${() => !this.keymode()}>
                <div>api key ${() => inp('key')}</div>
                <div>base url ${() => inp('baseURL')}</div>

                <button onclick=${() => this.update()}>update settings</button>
              </div>
            `,
          ];
        }
      }),
    ]
  });
  $.Class.new({
    name: 'LoomConfig',
    slots: [
      $.Component,
      $.Clone,
      $.Signal.new({
        name: 'max_tokens',
        doc: 'length of thread in tokens',
        default: 5,
      }),
      $.Signal.new({
        name: 'temperature',
        doc: 'generation temperature',
        default: 0.8,
      }),
      $.Signal.new({ 
        name: 'model', 
        doc: 'which model to loom with',
        default: 'meta-llama/Meta-Llama-3.1-405B' 
      }),
      $.Method.new({
        name: 'json',
        do() {
          return {
            temperature: this.temperature(),
            max_tokens: this.max_tokens(),
            model: this.model(),
          };
        }
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
            this.configline('max_tokens'),
            this.configline('temperature', 0.1),
          ];
        }
      }),
    ]
  });
  $.Class.new({
    name: 'Thread',
    slots: [
      $.Component,
      $.Clone,
      $.Signal.new({ name: 'text', default: ' ' }),
      $.Signal.new({ name: 'showConfig', default: false }),
      $.Var.new({ name: 'config', default: () => $.LoomConfig.new() }),
      $.Var.new({ name: 'loom' }),
      $.Command.new({
        name: 'weave',
        run() {
          return this.loom().weave(this.text());
        }
      }),
      $.Method.new({
        name: 'spawn',
        do() {
          this.loom().threads([...this.loom().threads(), this.clone()]);
        }
      }),
      $.Method.new({
        name: 'die',
        do() {
          this.loom().threads(this.loom().threads().filter(t => t !== this));
        }
      }),
      $.Method.new({
        name: 'normaliseLogprobs',
        do(logprobs) {
          let lptot = 0;
          for (const lp of logprobs) {
            lp.logprob = Math.exp(lp.logprob);
            lptot += lp.logprob;
          }
          for (const lp of logprobs) {
            lp.logprob = lp.logprob / lptot;
          }
          logprobs = logprobs.map(l => $.Logprob.new({
            text: l.token,
            logprob: l.logprob,
            loom: this.loom(),
          }));
          logprobs.sort((a, b) => b.logprob() - a.logprob());
          return logprobs;
        }
      }),
      $.Method.new({
        name: 'spin',
        doc: 'generate a possible thread from the model',
        async: true,
        do: async function() {
          this.text('');
          const res = await this.loom().client().completion(this.loom().text(), this.config().json());
          try {
            if (res.choices[0].logprobs.top_logprobs) {
              const logprobs = Object.entries(res.choices[0].logprobs.top_logprobs[0]).map(([k, v]) => ({ token: k, logprob: v }));
              this.loom().logprobs(this.normaliseLogprobs(logprobs));
            } else if (res.choices[0].logprobs.content) {
              const logprobs = res.choices[0].logprobs.content[0].top_logprobs;
              this.loom().logprobs(this.normaliseLogprobs(logprobs));
            } else {
              this.loom().logprobs($.HTML.t`<span class="logprobs-err">(not implemented for api type)</span>`);
            }
          } catch (e) {
            console.log(e);
            this.loom().logprobs($.HTML.t`<span class="logprobs-err">(error: ${e.toString()})</span>`);
          }
          this.text(res.choices[0].text);
        }
      }),
      $.Method.new({
        name: 'up',
        do() {
          const threads = this.loom().threads();
          const index = threads.indexOf(this);
          if (index > 0) {
            const newThreads = [...threads];
            [newThreads[index - 1], newThreads[index]] = [newThreads[index], newThreads[index - 1]];
            this.loom().threads(newThreads);
          }
        }
      }),
      $.Method.new({
        name: 'down',
        do() {
          const threads = this.loom().threads();
          const index = threads.indexOf(this);
          if (index < threads.length - 1) {
            const newThreads = [...threads];
            [newThreads[index], newThreads[index + 1]] = [newThreads[index + 1], newThreads[index]];
            this.loom().threads(newThreads);
          }
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          return $.HTML.t`
          <div class="thread">
            <span class="thread-handle"><button onclick=${() => this.showConfig(!this.showConfig())}>☰</button></span>
            <div class="loom-col">
              <button class="thread-text" onclick=${() => this.weave()}>${() => this.text()}</button>
              <div class="thread-config" hidden=${() => !this.showConfig()}>
                ${this.config()}
                <div class="loom-row">
                  <button onclick=${() => this.spin()}>spin</button>
                  <button onclick=${() => this.up()}>up</button>
                  <button onclick=${() => this.down()}>down</button>
                  <button onclick=${() => this.spawn()}>clone</button>
                  <button onclick=${() => this.die()}>die</button>
                </div>
              </div>
            </div>
          </div>
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
          this.loom().weave(this.text());
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          // const opacity = Math.tanh(this.logprob()) + 0.5;
          let p = this.logprob().toPrecision(2);
          if (p.length > 5) p = '<0.01';
          return $.HTML.t`
            <button class="logprob-button" onclick=${() => this.weave()}>
              <span class="logprob-token">"${this.text().replaceAll('\\', '\\\\')}"</span><span class="logprob">${p}</span>
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
      $.Signal.new({ name: 'savedText', default: '' }),
      $.Signal.new({ name: 'history' }),
      $.Signal.new({ name: 'choices' }),
      $.Signal.new({ name: 'logprobs' }),
      $.Signal.new({ name: 'errorMsg', default: '' }),
      $.Signal.new({ name: 'threads' }),
      $.Signal.new({ name: 'loading', default: false }),
      $.Signal.new({ name: 'editing', default: false }),
      $.Var.new({ name: 'client' }),
      $.Var.new({ name: 'localStorageKey', default: 'LOOM_TEXT' }),
      $.After.new({
        name: 'init',
        do() {
          this.client($.V1Client.new());
          this.text(localStorage.getItem(this.localStorageKey()) || ' - metaobject system\n - reactive signals\n -');
          this.savedText(this.text());
          const storedThreads = localStorage.getItem('LOOM_THREADS');
          if (storedThreads) {
            this.threads(JSON.parse(storedThreads).map(t => $.Thread.new(t)));
          } else {
            let threads = [];
            for (let i = 0; i < 8; i++) {
              threads.push($.Thread.new({
                loom: this, 
                config: $.LoomConfig.new({ 
                  temperature: 0.5 + i * 0.1,
                })
              }));
            }
            this.threads(threads);
          }
          this.choices([]);
          this.logprobs([]);
          this.history([]);
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
          this.errorMsg('');
          let threads = [];
          try {
            await Promise.all(this.threads().map(t => t.spin()));
          } catch (e) {
            console.log(e);
            this.errorMsg(e.toString());
          }
          this.loading(false);
        },
      }),
      $.Method.new({
        name: 'updateTextarea',
        do() {
          const textarea = document.querySelector('.loom-textarea');
          textarea.blur();
          textarea.value = this.text();
          textarea.scrollTop = textarea.scrollHeight;
        }
      }),
      $.Command.new({
        name: 'weave',
        run: function(ctx, text) {
          const oldtext = this.text();
          this.text(this.text() + text);
          localStorage.setItem('LOOM_TEXT', this.text());
          this.updateTextarea();
          this.seek();

          return function undo() {
            this.text(oldtext);
            this.updateTextarea();
            this.seek();
          }
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
          return $.HTML.t`<textarea class="loom-textarea" onload=${e => e.target.scrollTop = e.target.scrollHeight}>${() => this.text()}</textarea>`
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          return $.HTML.t`
            <div class="loom">
              <div class="loom-col">${() => this.loomText()}</div>
              <div class="loom-col">
                <div class="logprobs loom-col" hidden=${() => !this.logprobs()}>
                  <div class="section-label">logprobs</div>
                  <div class="loom-row">
                    ${() => this.logprobs()}
                  </div>
                </div>
                <div class="loom-col">
                  <div class="section-label">threads</div>
                  ${() => this.threads()}
                </div>
                  <div class="section-label">actions</div>
                <div class="loom-row">
                  <button class="seek-button" onclick=${() => this.seek()}>seek</button>
                  ${() => this.client()}
                  <span class="spinner" hidden=${() => !this.loading()}></span>
                  <span class="error">${() => this.errorMsg()}</span>
                </div>
                <div class="loom-row">
                </div>
              </div>
            </div>
          `;
        }
      })
    ]
  });
  $.Loom.new().mount();
}.module({ name: 'demo.loom', imports: [base, html] }).load();
