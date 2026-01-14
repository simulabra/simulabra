import { __, base } from "simulabra";
import llm from "simulabra/llm";

export default await async function (_, $, $llm) {

  $.Class.new({
    name: "LoomStorage",
    doc: "Abstraction for persisting loom session data",
    slots: [
      $.Var.new({ name: "key", default: "SWYPELOOM_TEXT" }),

      $.Method.new({
        name: "save",
        do(text) {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(this.key(), text);
          }
        }
      }),

      $.Method.new({
        name: "load",
        do() {
          if (typeof localStorage !== "undefined") {
            return localStorage.getItem(this.key()) || "";
          }
          return "";
        }
      }),

      $.Method.new({
        name: "clear",
        do() {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem(this.key());
          }
        }
      })
    ]
  });

  $.Class.new({
    name: "ChoiceGenerator",
    doc: "Encapsulates LLM client and choice generation logic",
    slots: [
      $.Var.new({ name: "client" }),
      $.Var.new({ name: "configs", default: () => [] }),
      $.Signal.new({ name: "hasImage", default: false }),

      $.After.new({
        name: "init",
        do() {
          this.configs([
            $llm.CompletionConfig.new({ max_tokens: 15, delta_temp: 0.1 }),
            $llm.CompletionConfig.new({ max_tokens: 15, delta_temp: 0 }),
            $llm.CompletionConfig.new({ max_tokens: 15, delta_temp: -0.1 }),
            $llm.CompletionConfig.new({ max_tokens: 15, delta_temp: -0.2 }),
          ]);
        }
      }),

      $.Method.new({
        name: "generate",
        async: true,
        doc: "Generate 4 choices for the given prompt",
        do: async function(prompt) {
          const baseTemp = this.client().baseTemperature();
          const results = await Promise.all(
            this.configs().map(cfg =>
              this.client().completion(prompt, cfg.json(baseTemp))
            )
          );

          const choices = results.map(r => r.text);
          const logprobs = results[0].logprobs
            ? $llm.LogprobParser.normalize(results[0].logprobs)
            : [];

          return { choices, logprobs };
        }
      }),

      $.Method.new({
        name: "attachImage",
        do(base64) {
          this.client().setImageData(base64);
          this.client().imageMode(true);
          this.hasImage(true);
        }
      }),

      $.Method.new({
        name: "clearImage",
        do() {
          this.client().clearImageData();
          this.client().imageMode(false);
          this.hasImage(false);
        }
      })
    ]
  });

  $.Class.new({
    name: "SwypeSession",
    doc: "Pure model class for swyperloom session state and logic",
    slots: [
      $.History,
      $.HistorySignal.new({ name: "text", default: "" }),
      $.HistorySignal.new({ name: "choices", default: [] }),
      $.HistorySignal.new({ name: "logprobs", default: [] }),
      $.Signal.new({ name: "loading", default: false }),
      $.Signal.new({ name: "editing", default: false }),
      $.Signal.new({ name: "preview", default: "" }),
      $.Signal.new({ name: "settingsOpen", default: false }),
      $.Signal.new({ name: "serverURL", default: "" }),

      $.Var.new({ name: "generator" }),
      $.Var.new({ name: "storage" }),
      $.Var.new({ name: "generatorConfig" }),
      $.Var.new({ name: "urlStorageKey", default: "SWYPELOOM_SERVER_URL" }),

      $.After.new({
        name: "init",
        do() {
          const savedURL = this.loadServerURL();
          const defaultURL = this.generatorConfig()?.baseURL || "http://localhost:3731";
          const baseURL = savedURL || defaultURL;
          this.serverURL(baseURL);

          const config = {
            baseURL,
            model: this.generatorConfig()?.model || "",
            logprobs: this.generatorConfig()?.logprobs || 20,
            baseTemperature: this.generatorConfig()?.baseTemperature || 0.8,
          };
          const client = $llm.LLMClient.new(config);
          this.generator(_.ChoiceGenerator.new({ client }));
          if (!this.storage()) {
            this.storage(_.LoomStorage.new());
          }
          this.loadFromStorage();
        }
      }),

      $.After.new({
        name: "restoreSnapshot",
        do() {
          this.saveToStorage();
        }
      }),

      $.Method.new({
        name: "saveToStorage",
        do() {
          this.storage().save(this.text());
        }
      }),

      $.Method.new({
        name: "loadFromStorage",
        do() {
          const saved = this.storage().load();
          if (saved) this.text(saved);
        }
      }),

      $.Method.new({
        name: "generateChoices",
        async: true,
        do: async function() {
          this.loading(true);
          this.choices([]);

          try {
            const { choices, logprobs } = await this.generator().generate(this.text());
            this.choices(choices);
            this.logprobs(logprobs);
          } catch (e) {
            console.error("Generation error:", e);
          } finally {
            this.loading(false);
          }
        }
      }),

      $.Method.new({
        name: "respin",
        do() {
          this.pushUndo();
          this.generateChoices();
        }
      }),

      $.Method.new({
        name: "previewChoice",
        do(index) {
          const choice = this.choices()[index];
          if (choice) {
            this.preview(choice);
          }
        }
      }),

      $.Method.new({
        name: "clearPreview",
        do() {
          this.preview("");
        }
      }),

      $.Method.new({
        name: "tokenize",
        doc: "Split text into whitespace-preserving tokens",
        do(text) {
          if (!text) return [];
          const matches = text.match(/\s*\S+/g);
          return matches || [];
        }
      }),

      $.Method.new({
        name: "choiceTokens",
        do(index) {
          const choice = this.choices()[index];
          return this.tokenize(choice);
        }
      }),

      $.Method.new({
        name: "choicePrefix",
        do(index, tokenCount) {
          const tokens = this.choiceTokens(index);
          if (tokenCount <= 0 || tokens.length === 0) return "";
          const n = Math.min(tokenCount, tokens.length);
          return tokens.slice(0, n).join("");
        }
      }),

      $.Method.new({
        name: "previewChoicePrefix",
        do(index, tokenCount) {
          const prefix = this.choicePrefix(index, tokenCount);
          this.preview(prefix);
        }
      }),

      $.Method.new({
        name: "selectChoicePrefix",
        do(index, tokenCount) {
          const prefix = this.choicePrefix(index, tokenCount);
          if (!prefix) return false;
          this.pushUndo();
          this.text(this.text() + prefix);
          this.saveToStorage();
          this.generateChoices();
          return true;
        }
      }),

      $.Method.new({
        name: "selectChoice",
        do(index) {
          const choice = this.choices()[index];
          if (!choice) return false;
          this.pushUndo();
          this.text(this.text() + choice);
          this.saveToStorage();
          this.generateChoices();
          return true;
        }
      }),

      $.Method.new({
        name: "insertToken",
        do(token) {
          this.pushUndo();
          this.text(this.text() + token);
          this.saveToStorage();
          this.generateChoices();
        }
      }),

      $.Method.new({
        name: "startEditing",
        do() {
          this.editing(true);
        }
      }),

      $.Method.new({
        name: "stopEditing",
        do() {
          this.editing(false);
          this.pushUndo();
          this.saveToStorage();
          this.generateChoices();
        }
      }),

      $.Method.new({
        name: "editText",
        do(newText) {
          this.text(newText);
        }
      }),

      $.Method.new({
        name: "attachImage",
        doc: "Attach base64 image data and enable image mode",
        do(base64) {
          this.generator().attachImage(base64);
        }
      }),

      $.Method.new({
        name: "clearImage",
        do() {
          this.generator().clearImage();
        }
      }),

      $.Method.new({
        name: "loadServerURL",
        do() {
          if (typeof localStorage !== "undefined") {
            return localStorage.getItem(this.urlStorageKey()) || "";
          }
          return "";
        }
      }),

      $.Method.new({
        name: "saveServerURL",
        do(url) {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(this.urlStorageKey(), url);
          }
        }
      }),

      $.Method.new({
        name: "updateServerURL",
        do(url) {
          this.serverURL(url);
          this.saveServerURL(url);
          this.generator().client().baseURL(url);
        }
      }),

      $.Method.new({
        name: "openSettings",
        do() {
          this.settingsOpen(true);
        }
      }),

      $.Method.new({
        name: "closeSettings",
        do() {
          this.settingsOpen(false);
        }
      })
    ]
  });

}.module({ name: "swyperloom.session", imports: [base, llm] }).load();
