// SIMULABRA HYPERLOOM

import html from '../src/html.js';
import { __, base } from '../src/base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'V1Client',
    doc: 'wrapper for openai v1 api compatible apis',
    slots: [
      $.Component,
      $.Signal.new({ name: 'selectedProvider' }),
      $.Var.new({ name: 'providers' }),
      $.After.new({
        name: 'init',
        do() {
          this.providers([
            $.LlamaCPPServerProvider.new(),
            $.HyperbolicProvider.new(),
            $.GenericOpenAIAPIProvider.new(),
          ]);
          const savedProvider = this.providers().find(p => p.class().name() === localStorage.getItem('LOOM_PROVIDER'));
          if (savedProvider) {
            this.selectedProvider(savedProvider);
          } else {
            this.selectedProvider(this.providers()[0]);
          }
        }
      }),
      $.Signal.new({
        name: 'showSettings',
        doc: 'show api settings',
        default: true,
      }),
      $.Method.new({
        name: 'toggleSettings',
        do() {
          this.showSettings(!this.showSettings());
        }
      }),
      $.Method.new({
        name: 'switchConfig',
        do() {
          const idx = this.providers().indexOf(this.selectedProvider());
          this.selectedProvider(this.providers()[(idx + 1) % this.providers().length]);
          localStorage.setItem('LOOM_PROVIDER', this.selectedProvider().class().name());
        }
      }),
      $.Method.new({
        name: 'completion',
        async: true,
        do: async function completion(prompt, config = {}) {
          const res = await this.selectedProvider().completion(prompt, config);
          const text = res.choices[0].text;
          const logprobs = this.selectedProvider().logprobs(res);
          return { text, logprobs };
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          return [
            $.HTML.t`<button onclick=${() => this.toggleSettings()}>${() => !this.showSettings() ? 'show' : 'hide'} client settings</button>`,
            $.HTML.t`<button onclick=${() => this.switchConfig()}>switch provider</button>`,
            $.HTML.t`
              <div class="loom-col" hidden=${() => !this.showSettings()}>
                ${() => this.selectedProvider().render()}
                <button onclick=${() => this.selectedProvider().save()}>save settings</button>
              </div>
            `,
          ];
        }
      }),
    ]
  });

  $.Class.new({
    name: 'APIProvider',
    doc: "if only every API were the same, we wouldn't need this class",
    slots: [
      $.After.new({
        name: 'init',
        do() {
          this.loadFromLocalStorage();
        }
      }),
      $.Method.new({
        name: 'transformRequest',
        do(body, headers) {}
      }),
      $.Method.new({
        name: 'completion',
        async: true,
        do: async function completion(prompt, config = {}) {
          const body = {
            prompt,
            ...config
          };
          const headers = {
            'Content-Type': 'application/json',
          };
          this.transformRequest(body, headers);
          const res = await fetch(`${this.baseURL()}/v1/completions`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers,
          });
          const json = await res.json();
          return json;
        }
      }),
      $.Method.new({
        name: 'savedSlots',
        do() {
          return [];
        }
      }),
      $.Method.new({
        name: 'loadFromLocalStorage',
        do() {
          for (let savedSlot of this.savedSlots()) {
            this[savedSlot](localStorage.getItem(this.localStorageKey(savedSlot)));
          }
        }
      }),
      $.Method.new({
        name: 'save',
        do() {
          for (const savedSlot of this.savedSlots()) {
            localStorage.setItem(this.localStorageKey(savedSlot), this[savedSlot]());
          }
        }
      }),
      $.Method.new({
        name: 'localStorageKey',
        do(key) {
          return 'LOOM_' + this.class().name().toUpperCase() + '_' + key.toUpperCase();
        }
      }),
      $.Method.new({
        name: 'renderInput',
        do(id, placeholder, label) {
          const htmlId = id + 'input';
          return $.HTML.t`<div>${label} <input 
            id=${htmlId}
            type="text"
            placeholder=${placeholder}
            onchange=${e => this[id](document.getElementById(htmlId).value)}
            value=${() => this[id]()} /></div>`;
        }
      }),
      $.Method.new({
        name: 'render',
        do() {
          return $.HTML.t`<div>${this.display()}</div>
            ${this.customfields()}`;
        }
      })
    ]
  });

  $.Class.new({
    name: 'LlamaCPPServerProvider',
    slots: [
      $.APIProvider,
      $.Constant.new({
        name: 'savedSlots',
        value: ['baseURL'],
      }),
      $.Constant.new({
        name: 'display',
        value: 'llama.cpp server',
      }),
      $.Signal.new({
        name: 'baseURL',
        doc: "the base of the openai-compatible api; hits ${this.baseURL()}/v1/completions",
        default: 'http://localhost:3731'
      }),
      $.Method.new({
        name: 'logprobs',
        do(res) {
          return res.choices[0].logprobs.content[0].top_logprobs;
        }
      }),
      $.Method.new({
        name: 'customfields',
        do() {
          return this.renderInput('baseURL', 'eg http://localhost:3731', 'base url');
        }
      })
    ]
  });

  $.Class.new({
    name: 'HyperbolicProvider',
    slots: [
      $.APIProvider,
      $.Signal.new({
        name: 'apiKey',
        doc: 'api credential (100% not leaked)'
      }),
      $.Constant.new({
        name: 'savedSlots',
        value: ['apiKey'],
      }),
      $.Constant.new({
        name: 'display',
        value: 'hyperbolic 405b',
      }),
      $.Constant.new({
        name: 'baseURL',
        value: 'https://api.hyperbolic.xyz',
      }),
      $.Method.new({
        name: 'logprobs',
        do(res) {
          return Object.entries(res.choices[0].logprobs.top_logprobs[0])
            .map(([k, v]) => ({ token: k, logprob: v }));
        }
      }),
      $.Method.new({
        name: 'transformRequest',
        do(body, headers) {
          body.model = 'meta-llama/Meta-Llama-3.1-405B';
          headers.Authorization = `Bearer ${this.apiKey()}`;
        }
      }),
      $.Method.new({
        name: 'customfields',
        do() {
          return this.renderInput('apiKey', 'secret credential', 'api key');
        }
      })
    ]
  });
  $.Class.new({
    name: 'GenericOpenAIAPIProvider',
    slots: [
      $.APIProvider,
      $.Signal.new({
        name: 'apiKey',
        doc: 'api credential (100% not leaked)'
      }),
      $.Signal.new({
        name: 'baseURL',
        doc: "the base of the openai-compatible api; hits ${this.baseURL()}/v1/completions",
        default: 'http://localhost:3731'
      }),
      $.Signal.new({
        name: 'model',
        doc: "which model to use with the completions endpoint",
        default: 'gpt-4-base'
      }),
      $.Constant.new({
        name: 'savedSlots',
        value: ['baseURL', 'apiKey', 'model'],
      }),
      $.Constant.new({
        name: 'display',
        value: 'generic openai-compatible api',
      }),
      $.Method.new({
        name: 'logprobs',
        do(res) {
          return Object.entries(res.choices[0].logprobs.top_logprobs[0])
            .map(([k, v]) => ({ token: k, logprob: v }));
        }
      }),
      $.Method.new({
        name: 'transformRequest',
        do(body, headers) {
          body.model = this.model();
          headers.Authorization = `Bearer ${this.apiKey()}`;
        }
      }),
      $.Method.new({
        name: 'customfields',
        do() {
          return $.HTML.t`<span>
            ${this.renderInput('baseURL', 'eg https://api.openai.com', 'base url')}
            ${this.renderInput('apiKey', 'secret!', 'api key')}
            ${this.renderInput('model', 'eg davinci-002', 'model')}
          </span>`
        }
      })
    ]
  });

  $.Class.new({
    name: 'ThreadConfig',
    slots: [
      $.Component,
      $.Clone,
      $.Signal.new({
        name: 'max_tokens',
        doc: 'length of thread in tokens',
        default: 8,
      }),
      $.Signal.new({
        name: 'temperature',
        doc: 'generation temperature',
        default: 0.8,
      }),
      $.Method.new({
        name: 'json',
        do() {
          return {
            temperature: this.temperature(),
            max_tokens: this.max_tokens(),
            logprobs: 20,
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
    name: 'TextCompletion',
    slots: [
      $.Component,
      $.Clone,
      $.Signal.new({ name: 'text', default: ' ' }),
      $.Method.new({
        name: 'spanify',
        do() {
          const processed = this.text().replace(/\n/g, '|||\\n|||');
          const parts = processed.split('|||');
          return parts.map(p => {
            if (p === '\\n') {
              return $.HTML.t`<span class="escape-char">${p}</span>`;
            } else {
              return p;
            }
          });
        }
      }),
    ]
  });
  $.Class.new({
    name: 'Thread',
    slots: [
      $.TextCompletion,
      $.Signal.new({ name: 'showConfig', default: false }),
      $.Var.new({ name: 'config' }),
      $.Var.new({ name: 'loom' }),
      $.Method.new({
        name: 'runcommand',
        do(cmd) {
          return this.loom().runcommand(cmd);
        }
      }),
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
            text: l.token.replace(/Ġ/g, ' '),
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
          this.loom().logprobs(null);
          try {
            const { text, logprobs } = await this.loom().client().completion(this.loom().text(), this.config().json());
            this.text(text);
            if (logprobs) {
              this.loom().logprobs(this.normaliseLogprobs(logprobs));
            } else {
              this.loom().logprobs($.HTML.t`<span class="logprobs-err">(not implemented for api type)</span>`);
            }
          } catch (e) {
            console.log(e);
            if (!this.loom().logprobs()) {
              this.loom().logprobs($.HTML.t`<span class="logprobs-err">(error: ${e.toString()})</span>`);
            }
          }
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
            <button class="thread-handle" onclick=${() => this.showConfig(!this.showConfig())}>☰</button>
            <div class="loom-col">
              <button class="thread-text" onclick=${() => this.weave()}>${() => this.spanify()}</button>
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
      $.TextCompletion,
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
              <span class="logprob-token">${() => this.spanify()}</span><span class="logprob">${p}</span>
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
          this.text(localStorage.getItem(this.localStorageKey()) || 'Once upon a time');
          this.savedText(this.text());
          const storedThreads = localStorage.getItem('LOOM_THREADS');
          if (storedThreads) {
            this.threads(JSON.parse(storedThreads).map(t => $.Thread.new({ loom: this, ...t })));
          } else {
            let threads = [];
            for (let i = 0; i < 8; i++) {
              threads.push($.Thread.new({
                loom: this, 
                config: $.ThreadConfig.new()
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
        run() {
          this.text(document.querySelector('.loom-textarea').value);
          this.choices([]);
          this.logprobs([]);
          this.loading(true);
          this.errorMsg('');
          let threads = [];
          Promise.all(this.threads().map(t => t.spin()))
            .finally(() => this.loading(false))
            .catch(e => {
              console.log(e);
              this.errorMsg(e.toString() + e.stack);
            });
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
      $.Var.new({
        name: 'undostack',
        default: () => [],
      }),
      $.Method.new({
        name: 'runcommand',
        do(cmd) {
          const undo = cmd.command().run().apply(cmd.parent(), [cmd, ...cmd.args()]);
          console.log('runcommand', undo, cmd);
          if (undo) {
            this.undostack().push(undo);
          }
          this.history([...this.history(), cmd]);
        }
      }),
      $.Method.new({
        name: 'undo',
        async do() {
          const undo = this.undostack().pop();
          console.log('undo', undo);
          if (undo) {
            return (await undo).apply(this);
          }
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
                  <button onclick=${() => this.undo()}>undo</button>
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
