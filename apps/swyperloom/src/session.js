import { __, base } from "simulabra";
import llm from "simulabra/llm";

export default await async function (_, $, $llm) {

  $.Class.new({
    name: "SwypeSession",
    doc: "Pure model class for swyperloom session state and logic",
    slots: [
      $.Signal.new({ name: "text", default: "" }),
      $.Signal.new({ name: "choices", default: [] }),
      $.Signal.new({ name: "logprobs", default: [] }),
      $.Signal.new({ name: "loading", default: false }),
      $.Signal.new({ name: "editing", default: false }),
      $.Signal.new({ name: "preview", default: "" }),
      $.Signal.new({ name: "hasImage", default: false }),

      $.Var.new({ name: "client" }),
      $.Var.new({ name: "undoStack", default: () => [] }),
      $.Var.new({ name: "redoStack", default: () => [] }),
      $.Var.new({ name: "storageKey", default: "SWYPELOOM_TEXT" }),
      $.Var.new({ name: "clientConfig" }),

      $.After.new({
        name: "init",
        do() {
          const config = this.clientConfig() || {
            baseURL: "http://localhost:3731",
            model: "",
            logprobs: 20,
            baseTemperature: 0.8,
          };
          this.client($llm.LLMClient.new(config));
          this.loadFromStorage();
        }
      }),

      $.Method.new({
        name: "saveToStorage",
        do() {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(this.storageKey(), this.text());
          }
        }
      }),

      $.Method.new({
        name: "loadFromStorage",
        do() {
          if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem(this.storageKey());
            if (saved) this.text(saved);
          }
        }
      }),

      $.Method.new({
        name: "snapshot",
        do() {
          return {
            text: this.text(),
            choices: this.choices().slice(),
            logprobs: this.logprobs().slice()
          };
        }
      }),

      $.Method.new({
        name: "restoreSnapshot",
        do(snap) {
          this.text(snap.text);
          this.choices(snap.choices);
          this.logprobs(snap.logprobs);
          this.saveToStorage();
        }
      }),

      $.Method.new({
        name: "pushUndo",
        do() {
          this.undoStack().push(this.snapshot());
          this.redoStack().length = 0;
        }
      }),

      $.Method.new({
        name: "undo",
        do() {
          if (!this.undoStack().length) return false;
          this.redoStack().push(this.snapshot());
          this.restoreSnapshot(this.undoStack().pop());
          return true;
        }
      }),

      $.Method.new({
        name: "redo",
        do() {
          if (!this.redoStack().length) return false;
          this.undoStack().push(this.snapshot());
          this.restoreSnapshot(this.redoStack().pop());
          return true;
        }
      }),

      $.Method.new({
        name: "canUndo",
        do() {
          return this.undoStack().length > 0;
        }
      }),

      $.Method.new({
        name: "canRedo",
        do() {
          return this.redoStack().length > 0;
        }
      }),

      $.Method.new({
        name: "generateChoices",
        async: true,
        do: async function() {
          this.loading(true);
          this.choices([]);

          const configs = [
            { max_tokens: 15, temperature: 0.9 },
            { max_tokens: 15, temperature: 0.8 },
            { max_tokens: 15, temperature: 0.7 },
            { max_tokens: 15, temperature: 0.6 },
          ];

          try {
            const results = await Promise.all(
              configs.map(cfg => this.client().completion(this.text(), cfg))
            );

            this.choices(results.map(r => r.text));

            if (results[0].logprobs) {
              this.logprobs($llm.LogprobParser.normalize(results[0].logprobs));
            }
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

}.module({ name: "swyperloom.session", imports: [base, llm] }).load();
