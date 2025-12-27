// SIMULABRA HYPERLOOM

import html from "../src/html.js";
import { __, base } from "../src/base.js";

export default await async function (_, $, $html) {
  $.Class.new({
    name: "OpenAIAPIClient",
    doc: "consume and configure an openai-compatible api",
    slots: [
      $html.Component,
      $.Configurable,
      $.Signal.new({
        name: "showSettings",
        doc: "show api settings",
        default: true,
      }),
      $.ConfigSignal.new({
        name: "apiKey",
        doc: "api credential (100% not leaked)"
      }),
      $.ConfigSignal.new({
        name: "baseURL",
        doc: "the base of the openai-compatible api; hits ${this.baseURL()}/v1/completions",
        default: "https://api.openai.com"
      }),
      $.ConfigSignal.new({
        name: "model",
        doc: "which model to use with the completions endpoint",
        default: "davinci-002"
      }),
      $.ConfigSignal.new({
        name: "sequential",
        doc: "run threads sequentially instead of in parallel",
        default: false,
      }),
      $.ConfigSignal.new({
        name: "logprobs",
        doc: "number of log probabilities to return",
        default: 20,
      }),
      $.ConfigSignal.new({
        name: "baseTemperature",
        doc: "base temperature for generation, threads add an offset",
        default: 0.8,
      }),
      $.Constant.new({
        name: "display",
        value: "generic openai-compatible api",
      }),
      $.Signal.new({
        name: "store",
      }),
      $.Signal.new({
        name: "imageData",
        doc: "base64-encoded image data for multimodal prompts",
        default: null,
      }),
      $.Method.new({
        name: "toggleSettings",
        do() {
          this.showSettings(!this.showSettings()); // variable assignment as method call; triggers effect
        }
      }),
      $.After.new({ // CLOS-style method combination
        name: "init",
        do() {
          this.store(_.ConfigStore.new());
          const lastId = localStorage.getItem("loom-config-selected");
          if (lastId) {
            this.loadId(lastId);
          }
        }
      }),
      $.Method.new({
        name: "loadId",
        do(id) {
          const data = this.store().get(id);
          if (data) {
            localStorage.setItem("loom-config-selected", id);
            this.configLoad(data);
          }
        }
      }),
      $.Method.new({
        name: "completion",
        async: true,
        do: async function completion(prompt, config = {}) {
          const headers = {
            "Content-Type": "application/json",
          };
          let endpoint, body;
          if (this.imageData()) {
            endpoint = `${this.baseURL()}/completion`;
            body = {
              prompt: {
                prompt_string: `<__media__>\n\n${prompt}`,
                multimodal_data: [this.imageData()]
              },
              logprobs: this.logprobs(),
              ...config
            };
          } else {
            endpoint = `${this.baseURL()}/v1/completions`;
            body = {
              prompt,
              logprobs: this.logprobs(),
              ...config
            };
            this.transformRequest(body, headers);
          }
          const res = await fetch(endpoint, {
            method: "POST",
            body: JSON.stringify(body),
            headers,
          });
          const json = await res.json();
          const text = this.imageData() ? json.content : json.choices[0].text;
          const logprobs = this.parseLogprobs(json);
          return { text, logprobs };
        }
      }),
      $.Method.new({
        name: 'id',
        do() {
          return `${this.baseURL()}(${this.model()})`;
        }
      }),
      $.Method.new({
        name: "renderInput",
        do(id, placeholder, label) {
          const htmlId = id + "input";
          return $html.HTML.t`<div>${label} <input 
            id=${htmlId}
            type="text"
            placeholder=${placeholder}
            onchange=${e => this[id](document.getElementById(htmlId).value)}
            value=${() => this[id]()} /></div>`;
        }
      }),
      $.Method.new({
        name: "renderCheckbox",
        do(id, label) {
          const htmlId = id + "checkbox";
          return $html.HTML.t`<div><label>${label} <input
            id=${htmlId}
            type="checkbox"
            onchange=${e => this[id](document.getElementById(htmlId).checked)}
            checked=${() => this[id]()} /></label></div>`;
        }
      }),
      $.Method.new({
        name: "renderNumberInput",
        do(id, label, step=1) {
          return $html.HTML.t`<div>${label} <input
            type="number"
            min="0"
            step=${step}
            onchange=${e => this[id](+e.target.value)}
            value=${() => this[id]()} /></div>`;
        }
      }),
      $.Method.new({
        name: "handleImageSelect",
        do(e) {
          const file = e.target.files[0];
          if (!file) {
            this.imageData(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            this.imageData(base64);
          };
          reader.readAsDataURL(file);
        }
      }),
      $.Method.new({
        name: "renderImagePicker",
        do() {
          return $html.HTML.t`<div class="loom-col">
            <label class="button">upload image<input
              type="file"
              accept="image/*"
              hidden
              onchange=${e => this.handleImageSelect(e)} /></label>
            <div hidden=${() => !this.imageData()}>
              <img class="image-preview" src=${() => this.imageData() ? 'data:image/jpeg;base64,' + this.imageData() : ''} />
              <button onclick=${() => this.imageData(null)}>clear image</button>
            </div>
          </div>`;
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`<span>
            <button onclick=${() => this.toggleSettings()}>${() => !this.showSettings() ? "show" : "hide"} client settings</button>
              <div class="loom-col" hidden=${() => !this.showSettings()}>
                <div>${this.display()}</div>
                ${this.renderInput("baseURL", "eg https://api.openai.com", "base url")}
                ${this.renderInput("apiKey", "secret!", "api key")}
                ${this.renderInput("model", "eg davinci-002", "model")}
                ${this.renderNumberInput("logprobs", "logprobs")}
                ${this.renderNumberInput("baseTemperature", "base temp", 0.1)}
                ${this.renderCheckbox("sequential", "run threads sequentially")}
                ${this.renderImagePicker()}
                ${() => this.store()}
              </div>
          </span>`;
        }
      }),
      $.Method.new({
        name: "parseLogprobs",
        do(res) {
          if (!res.choices) {
            return res.completion_probabilities[0].top_logprobs;
          }

          const lp = res.choices[0].logprobs;
          if (/*llama.cpp server - openai*/lp.content && Array.isArray(lp.content) && lp.content[0]?.top_logprobs) {
            return lp.content[0].top_logprobs;
          }
          const tl = lp.top_logprobs;
          if (/*openai-compatible*/Array.isArray(tl) && tl.length && tl[0] && typeof tl[0] === "object" && !Array.isArray(tl[0])) {
            return Object.entries(tl[0]).map(([token, logprob]) => ({ token, logprob }));
          }
          if (/*openrouter?*/Array.isArray(lp) && lp.length && lp[0].token && typeof lp[0].logprob === "number") {
            return lp;
          }
          return null;
        }
      }),
      $.Method.new({
        name: "transformRequest",
        do(body, headers) {
          if (this.model()) {
            body.model = this.model();
          }
          if (this.apiKey()) {
            headers.Authorization = `Bearer ${this.apiKey()}`;
          }
        }
      }),
    ]
  });

  $.Class.new({
    name: "ConfigStore",
    doc: "manages saved configs in localStorage",
    slots: [
      $html.Component,
      $.After.new({
        name: 'init',
        do() {
          this.configIDs(Object.keys(this.fetchStore()));
        }
      }),
      $.Signal.new({
        name: 'id',
      }),
      $.Method.new({
        name: "fetchStore",
        do() {
          return JSON.parse(localStorage.getItem("loom-config-store") || "{}");
        }
      }),
      $.Method.new({
        name: "get",
        do(id) {
          return this.fetchStore()[id];
        }
      }),
      $.Method.new({
        name: "delete",
        do(id) {
          let store = this.fetchStore();
          delete store[id];
          this.updateStore(store);
        }
      }),
      $.Method.new({
        name: "save",
        do(client) {
          let store = this.fetchStore();
          store[client.id()] = client.configJSON();
          localStorage.setItem("loom-config-selected", client.id());
          this.updateStore(store);
        }
      }),
      $.Method.new({
        name: 'updateStore',
        do(store) {
          localStorage.setItem("loom-config-store", JSON.stringify(store));
          this.configIDs(Object.keys(store));
        }
      }),
      $.Signal.new({
        name: "configIDs",
        doc: "list of config ids that can be loaded",
        default: [],
      }),
      $.Method.new({
        name: "render",
        do(parent) {
          const configRow = id => $html.HTML.t`<div class="loom-row">
            ${id}
            <button onclick=${() => this.delete(id)}>delete</button>
            <button onclick=${() => parent.loadId(id)}>restore</button>
          </div>`;
          return $html.HTML.t`<div>
            <button onclick=${() => this.save(parent)}>save settings</button>
            ${() => this.configIDs().map(id => configRow(id))}
          </div>`;
        }
      }),
    ]
  });

  $.Class.new({
    name: "ThreadConfig",
    slots: [
      $html.Component,
      $.Clone,
      $.Signal.new({
        name: "max_tokens",
        doc: "length of thread in tokens",
        default: 10,
      }),
      $.Signal.new({
        name: "delta_temp",
        doc: "offset from base temperature (-0.3 to +0.3 typical)",
        default: 0,
      }),
      $.Method.new({
        name: "json",
        do(baseTemp) {
          return {
            temperature: baseTemp + this.delta_temp(),
            max_tokens: this.max_tokens(),
          };
        }
      }),
      $.Method.new({
        name: "configline",
        do(c, step=1, min=0) {
          return $html.HTML.t`<div>${c}: <input class="config-number" step=${step} type="number" min=${min} value=${() => this[c]()} onchange=${e => this[c](+e.target.value)} /></div>`;
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return [
            this.configline("max_tokens"),
            this.configline("delta_temp", 0.1, -1),
          ];
        }
      }),
    ]
  });

  $.Class.new({
    name: "TextCompletion",
    slots: [
      $html.Component,
      $.Clone,
      $.Signal.new({ name: "text", default: " " }),
      $.Method.new({
        name: "spanify",
        do() {
          const processed = this.text().replace(/\n/g, "|||\\n|||");
          const parts = processed.split("|||");
          return parts.map(p => {
            if (p === "\\n") {
              return $html.HTML.t`<span class="escape-char">${p}</span>`;
            } else {
              return p;
            }
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: "Thread",
    slots: [
      _.TextCompletion,
      $.Signal.new({ name: "showConfig", default: false }),
      $.Var.new({ name: "config" }),
      $.Var.new({ name: "loom" }),
      $.Method.new({
        name: "runcommand",
        do(cmd) {
          return this.loom().runcommand(cmd);
        }
      }),
      $.Command.new({
        name: "clear",
        run() {
          const oldtext = this.text();
          this.text("");
          return () => this.text(oldtext);
        }
      }),
      $.Command.new({
        name: "weave",
        run() {
          return this.loom().weave(this.text());
        }
      }),
      $.Method.new({
        name: "spawn",
        do() {
          this.loom().threads([...this.loom().threads(), this.clone()]);
        }
      }),
      $.Method.new({
        name: "die",
        do() {
          this.loom().threads(this.loom().threads().filter(t => t !== this));
        }
      }),
      $.Method.new({
        name: "normaliseLogprobs",
        do(logprobs) {
          let lptot = 0;
          for (const lp of logprobs) {
            lp.logprob = Math.exp(lp.logprob);
            lptot += lp.logprob;
          }
          for (const lp of logprobs) {
            lp.logprob = lp.logprob / lptot;
          }
          logprobs = logprobs.map(l => _.Logprob.new({
            text: l.token.replace(/Ġ/g, " "),
            logprob: l.logprob,
            loom: this.loom(),
          }));
          logprobs.sort((a, b) => b.logprob() - a.logprob());
          return logprobs;
        }
      }),
      $.Method.new({
        name: "spin",
        doc: "generate a possible thread from the model",
        async: true,
        do: async function() {
          this.text("");
          try {
            const baseTemp = this.loom().client().baseTemperature();
            const { text, logprobs } = await this.loom().client().completion(this.loom().text(), this.config().json(baseTemp));
            this.text(text);
            console.log(logprobs);
            if (logprobs) {
              this.loom().logprobs(this.normaliseLogprobs(logprobs));
            } else {
              this.loom().logprobs($html.HTML.t`<span class="logprobs-err">(not implemented for api type)</span>`);
            }
          } catch (e) {
            console.log(e);
            if (!this.loom().logprobs()) {
              this.loom().logprobs($html.HTML.t`<span class="logprobs-err">(error: ${e.toString()})</span>`);
            }
          }
        }
      }),
      $.Method.new({
        name: "up",
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
        name: "down",
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
        name: "render",
        do() {
          const threadNumber = () => this.loom().threads().indexOf(this) + 1;
          return $html.HTML.t`
          <div class="thread">
            <button class="thread-handle" onclick=${() => this.showConfig(!this.showConfig())}>☰</button>
            <span class="thread-number">${threadNumber}</span>
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
    name: "Logprob",
    slots: [
      _.TextCompletion,
      $.Var.new({ name: "logprob" }),
      $.Var.new({ name: "loom" }),
      $.Method.new({
        name: "weave",
        do() {
          this.loom().weave(this.text());
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          // const opacity = Math.tanh(this.logprob()) + 0.5;
          let p = this.logprob().toPrecision(2);
          if (p.length > 5) p = "<0.01";
          return $html.HTML.t`
            <button class="logprob-button" onclick=${() => this.weave()}>
              <span class="logprob-token">${() => this.spanify()}</span><span class="logprob">${p}</span>
            </button>
          `;
        }
      }),
    ]
  });

  $.Class.new({
    name: "Loom",
    slots: [
      $html.Component,
      $.Signal.new({ name: "text" }),
      $.Signal.new({ name: "savedText", default: "" }),
      $.Signal.new({ name: "history" }),
      $.Signal.new({ name: "choices" }),
      $.Signal.new({ name: "logprobs" }),
      $.Signal.new({ name: "errorMsg", default: "" }),
      $.Signal.new({ name: "threads" }),
      $.Signal.new({ name: "loading", default: false }),
      $.Signal.new({ name: "cursor", default: { x: 0, y: 0 } }),
      $.Var.new({ name: "client" }),
      $.Var.new({ name: "localStorageKey", default: "LOOM_TEXT" }),
      $.After.new({
        name: "init",
        do() {
          const client = _.OpenAIAPIClient.new();
          client.loom = this;
          this.client(client);
          this.text(localStorage.getItem(this.localStorageKey()) || "Once upon a time");
          this.savedText(this.text());
          const storedThreads = localStorage.getItem("LOOM_THREADS");
          if (storedThreads) {
            this.threads(JSON.parse(storedThreads).map(t => _.Thread.new({ loom: this, ...t })));
          } else {
            this.threads([
              this.thread({ max_tokens: 6, delta_temp: 0.2 }),
              this.thread({ max_tokens: 7, delta_temp: 0.2 }),
              this.thread({ max_tokens: 8, delta_temp: 0.1 }),
              this.thread({ max_tokens: 9, delta_temp: 0 }),
              this.thread({ max_tokens: 10, delta_temp: -0.1 }),
              this.thread({ max_tokens: 11, delta_temp: -0.2 }),
              this.thread({ max_tokens: 12, delta_temp: -0.2 }),
              this.thread({ max_tokens: 13, delta_temp: -0.2 }),
            ]);
          }
          this.choices([]);
          this.logprobs([]);
          this.history([]);
          document.addEventListener('keydown', e => {
            const textarea = document.querySelector(".loom-textarea");
            if (document.activeElement === textarea) {
              if (e.key === 'Escape') {
                e.preventDefault();
                textarea.blur();
              }
              return;
            }
            if (document.activeElement?.tagName === 'INPUT') {
              return;
            }
            const key = e.key;
            if (key >= '1' && key <= '9') {
              const index = parseInt(key) - 1;
              const threads = this.threads();
              if (threads[index] && threads[index].text()) {
                e.preventDefault();
                threads[index].weave();
              }
            } else if (key === ' ') {
              e.preventDefault();
              this.seek();
            } else if (key === 'i') {
              e.preventDefault();
              textarea.focus();
              textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
          });
        }
      }),
      $.Method.new({
        name: "thread",
        do(config) {
          return _.Thread.new({ loom: this, config: _.ThreadConfig.new(config) });
        }
      }),
      $.Method.new({
        name: "clearThreads",
        do() {
          for (const thread of this.threads()) {
            thread.text("");
          }
          this.logprobs(null);
        }
      }),
      $.Method.new({
        name: "spinThreads",
        async: true,
        do: async function() {
          this.clearThreads();
          if (this.client().sequential()) {
            for (const thread of this.threads()) {
              await thread.spin();
            }
          } else {
            return Promise.all(this.threads().map(t => t.spin()));
          }
        }
      }),
      $.Command.new({
        name: "seek",
        doc: "make new threads to search",
        run() {
          this.text(document.querySelector(".loom-textarea").value);
          this.choices([]);
          this.logprobs([]);
          this.loading(true);
          this.errorMsg("");
          let threads = [];
          this.spinThreads()
            .finally(() => this.loading(false))
            .catch(e => {
              console.log(e);
              this.errorMsg(e.toString() + e.stack);
            });
        },
      }),
      $.Method.new({
        name: "updateTextarea",
        do() {
          const textarea = document.querySelector(".loom-textarea");
          textarea.blur();
          textarea.value = this.text();
          textarea.scrollTop = textarea.scrollHeight;
        }
      }),
      $.Method.new({
        name: "updateCursorPosition",
        do() {
          const textarea = document.querySelector(".loom-textarea");
          const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
          const lines = textBeforeCursor.split('\n');
          const lastLine = lines[lines.length - 1];
          const style = getComputedStyle(textarea);
          const span = document.createElement('span');
          span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font}`;
          span.textContent = lastLine;
          document.body.appendChild(span);
          const rect = textarea.getBoundingClientRect();
          const x = rect.left + span.offsetWidth + 4;
          const y = rect.top + parseInt(style.paddingTop) + (lines.length - 1) * (parseInt(style.lineHeight) || 20);
          this.cursor({ x, y });
          document.body.removeChild(span);
        }
      }),
      $.Command.new({
        name: "weave",
        run: function(ctx, text) {
          const oldtext = this.text();
          this.text(this.text() + text);
          localStorage.setItem("LOOM_TEXT", this.text());
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
        name: "undostack",
        default: () => [],
      }),
      $.Method.new({
        name: "runcommand",
        do(cmd) {
          const undo = cmd.command().run().apply(cmd.parent(), [cmd, ...cmd.args()]);
          if (undo) {
            this.undostack().push(undo);
          }
          this.history([...this.history(), cmd]);
        }
      }),
      $.Method.new({
        name: "undo",
        async do() {
          const undo = this.undostack().pop();
          if (undo) {
            return (await undo).apply(this);
          }
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          let debounceTimer;
          const textchange = e => {
            console.log('textchange');
            this.text(document.querySelector(".loom-textarea").value);
            localStorage.setItem("LOOM_TEXT", this.text());
            this.clearThreads();
            this.updateCursorPosition();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              if (this.text().charAt(this.text().length - 1) === " ") {
                this.text(this.text().slice(0, -1));
              }
              this.seek();
            }, 1000);
          }
          const cursorchange = e => {
            this.updateCursorPosition();
          }
          return $html.HTML.t`
            <div class="loom">
              <div class="loom-col loom-textarea-container">
                <textarea
                  class="loom-textarea"
                  onload=${e => e.target.scrollTop = e.target.scrollHeight}
                  oninput=${textchange}
                  onclick=${cursorchange}
                  onkeyup=${cursorchange}
                  onselect=${cursorchange}>${() => this.text()}</textarea>
                <span class="cursor-spinner" hidden=${() => !this.loading()} style=${() => `left: ${this.cursor().x}px; top: ${this.cursor().y}px;`}></span>
              </div>
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
                  <span class="spinner" hidden=${() => !this.loading()}></span>
                  <span class="error">${() => this.errorMsg()}</span>
                </div>
                <div class="loom-row">
                  ${() => this.client()}
                </div>
              </div>
            </div>
          `;
        }
      })
    ]
  });

  _.Loom.new().mount();
}.module({ name: "demo.loom", imports: [base, html] }).load();
