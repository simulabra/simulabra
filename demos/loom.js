// SIMULABRA HYPERLOOM

import html from "../src/html.js";
import { __, base } from "../src/base.js";

export default await function (_, $) {
  $.Class.new({ // declarative class definitions
    name: "OpenAIAPIClient",
    doc: "consume and configure an openai-compatible api",
    slots: [ // slot-based system like CLOS
      $.Component, // slot-based inheritance
      $.Signal.new({ // reactive signal slot
        name: "showSettings",
        doc: "show api settings",
        default: true, // default value
      }),
      $.Signal.new({
        name: "apiKey",
        doc: "api credential (100% not leaked)"
      }),
      $.Signal.new({
        name: "baseURL",
        doc: "the base of the openai-compatible api; hits ${this.baseURL()}/v1/completions",
        default: "https://api.openai.com"
      }),
      $.Signal.new({
        name: "model",
        doc: "which model to use with the completions endpoint",
        default: "davinci-002"
      }),
      $.Constant.new({ // constant slot, same across all instances of class
        name: "display",
        value: "generic openai-compatible api",
      }),
      $.Signal.new({
        name: "store",
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
          this.store($.ConfigStore.new());
          const lastId = localStorage.getItem("loom-config-selected");
          if (lastId) {
            this.loadId(lastId);
          }
        }
      }),
      $.Method.new({
        name: "loadId",
        do(id) {
          const config = this.store().get(id);
          if (config) {
            localStorage.setItem("loom-config-selected", id);
            const { baseURL, apiKey, model } = config;
            this.baseURL(baseURL);
            this.apiKey(apiKey);
            this.model(model);
          }
        }
      }),
      $.Method.new({
        name: "completion",
        async: true,
        do: async function completion(prompt, config = {}) {
          const body = {
            prompt,
            ...config
          };
          const headers = {
            "Content-Type": "application/json",
          };
          this.transformRequest(body, headers);
          const res = await fetch(`${this.baseURL()}/v1/completions`, {
            method: "POST",
            body: JSON.stringify(body),
            headers,
          });
          const json = await res.json();
          const text = json.choices[0].text;
          const logprobs = this.logprobs(json);
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
          return $.HTML.t`<div>${label} <input 
            id=${htmlId}
            type="text"
            placeholder=${placeholder}
            onchange=${e => this[id](document.getElementById(htmlId).value)}
            value=${() => this[id]()} /></div>`;
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $.HTML.t`<span>
            <button onclick=${() => this.toggleSettings()}>${() => !this.showSettings() ? "show" : "hide"} client settings</button>
              <div class="loom-col" hidden=${() => !this.showSettings()}>
                <div>${this.display()}</div>
                ${this.renderInput("baseURL", "eg https://api.openai.com", "base url")}
                ${this.renderInput("apiKey", "secret!", "api key")}
                ${this.renderInput("model", "eg davinci-002", "model")}
                ${() => this.store()}
              </div>
          </span>`;
        }
      }),
      $.Method.new({
        name: "logprobs",
        do(res) {
          const lp = res.choices[0].logprobs;
          if (!lp) {
            this.log("no logprobs on completion response", res);
            return null;
          }
          // llama.cpp server:
          if (lp.content && Array.isArray(lp.content) && lp.content[0]?.top_logprobs) {
            return lp.content[0].top_logprobs;
          }
          // OpenAI-compatible:
          const tl = lp.top_logprobs;
          if (Array.isArray(tl) && tl.length && tl[0] && typeof tl[0] === "object" && !Array.isArray(tl[0])) {
            return Object.entries(tl[0]).map(([token, logprob]) => ({ token, logprob }));
          }
          if (Array.isArray(lp) && lp.length && lp[0].token && typeof lp[0].logprob === "number") {
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
      $.Component,
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
          store[client.id()] = {
            baseURL: client.baseURL(),
            apiKey: client.apiKey(),
            model: client.model(),
          };
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
          const configRow = id => $.HTML.t`<div class="loom-row">
            ${id}
            <button onclick=${() => this.delete(id)}>delete</button>
            <button onclick=${() => parent.loadId(id)}>restore</button>
          </div>`;
          return $.HTML.t`<div>
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
      $.Component,
      $.Clone,
      $.Signal.new({
        name: "max_tokens",
        doc: "length of thread in tokens",
        default: 10,
      }),
      $.Signal.new({
        name: "temperature",
        doc: "generation temperature",
        default: 0.6,
      }),
      $.Method.new({
        name: "json",
        do() {
          return {
            temperature: this.temperature(),
            max_tokens: this.max_tokens(),
            logprobs: 20,
          };
        }
      }),
      $.Method.new({
        name: "configline",
        do(c, step=1) {
          return $.HTML.t`<div>${c}: <input class="config-number" step=${step} type="number" min="0" value=${() => this[c]()} onchange=${e => this[c](+e.target.value)} /></div>`;
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return [
            this.configline("max_tokens"),
            this.configline("temperature", 0.1),
          ];
        }
      }),
    ]
  });
  $.Class.new({
    name: "TextCompletion",
    slots: [
      $.Component,
      $.Clone,
      $.Signal.new({ name: "text", default: " " }),
      $.Method.new({
        name: "spanify",
        do() {
          const processed = this.text().replace(/\n/g, "|||\\n|||");
          const parts = processed.split("|||");
          return parts.map(p => {
            if (p === "\\n") {
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
    name: "Thread",
    slots: [
      $.TextCompletion,
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
          logprobs = logprobs.map(l => $.Logprob.new({
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
    name: "Logprob",
    slots: [
      $.TextCompletion,
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
    name: "Loom",
    slots: [
      $.Component,
      $.Signal.new({ name: "text" }),
      $.Signal.new({ name: "savedText", default: "" }),
      $.Signal.new({ name: "history" }),
      $.Signal.new({ name: "choices" }),
      $.Signal.new({ name: "logprobs" }),
      $.Signal.new({ name: "errorMsg", default: "" }),
      $.Signal.new({ name: "threads" }),
      $.Signal.new({ name: "loading", default: false }),
      $.Var.new({ name: "client" }),
      $.Var.new({ name: "localStorageKey", default: "LOOM_TEXT" }),
      $.After.new({
        name: "init",
        do() {
          this.client($.OpenAIAPIClient.new());
          this.text(localStorage.getItem(this.localStorageKey()) || "Once upon a time");
          this.savedText(this.text());
          const storedThreads = localStorage.getItem("LOOM_THREADS");
          if (storedThreads) {
            this.threads(JSON.parse(storedThreads).map(t => $.Thread.new({ loom: this, ...t })));
          } else {
            this.threads([
              this.thread({ max_tokens: 4, temperature: 1.0 }),
              this.thread({ max_tokens: 4, temperature: 1.0 }),
              this.thread({ max_tokens: 6, temperature: 0.9 }),
              this.thread({ max_tokens: 6, temperature: 0.8 }),
              this.thread({ max_tokens: 8, temperature: 0.7 }),
              this.thread({ max_tokens: 8, temperature: 0.6 }),
              this.thread({ max_tokens: 10, temperature: 0.5 }),
              this.thread({ max_tokens: 10, temperature: 0.5 }),
            ]);
          }
          this.choices([]);
          this.logprobs([]);
          this.history([]);
        }
      }),
      $.Method.new({
        name: "thread",
        do(config) {
          return $.Thread.new({ loom: this, config: $.ThreadConfig.new(config) });
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
          Promise.all(this.threads().map(t => t.spin()))
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
          return $.HTML.t`
            <div class="loom">
              <div class="loom-col">
                <textarea class="loom-textarea" onload=${e => e.target.scrollTop = e.target.scrollHeight}>${() => this.text()}</textarea>
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

  $.Loom.new().mount();
}.module({ name: "demo.loom", imports: [base, html] }).load();
