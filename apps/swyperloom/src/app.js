import html from "simulabra/html";
import llm from "simulabra/llm";
import { __, base } from "simulabra";

export default await async function (_, $, $html, $llm) {

  $.Class.new({
    name: "TextDisplay",
    doc: "Ornate framed text display area for completions",
    slots: [
      $html.Component,
      $.Var.new({ name: "loom" }),
      $.Signal.new({ name: "preview", default: "" }),
      $.After.new({
        name: "init",
        do() {
          $.Effect.create(() => {
            this.loom().text();
            this.scrollToBottom();
          });
        }
      }),
      $.Method.new({
        name: "scrollToBottom",
        do() {
          requestAnimationFrame(() => {
            const el = document.querySelector('.text-content');
            if (el) el.scrollTop = el.scrollHeight;
          });
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="text-display">
              <div class="text-content" onclick=${() => this.loom().startEditing()}>
                <span class="main-text">${() => this.loom().text()}</span><span class="preview-text">${() => this.preview()}</span>
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "LogprobButton",
    doc: "Individual logprob token button",
    slots: [
      $html.Component,
      $.Var.new({ name: "entry" }),
      $.Var.new({ name: "loom" }),
      $.Method.new({
        name: "render",
        do() {
          const prob = this.entry().probability();
          let display = prob.toPrecision(2);
          if (display.length > 5) display = "<.01";
          return $html.HTML.t`
            <button class="logprob-btn" onclick=${() => this.loom().insertToken(this.entry().token())}>
              <span class="token">${this.entry().token()}</span>
              <span class="prob">${display}</span>
            </button>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "LogprobsBar",
    doc: "Horizontally scrollable bar of logprob tokens",
    slots: [
      $html.Component,
      $.Var.new({ name: "loom" }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="logprobs-bar">
              <div class="logprobs-scroll">
                ${() => {
                  const lps = this.loom().logprobs();
                  if (!lps || !lps.length) return $html.HTML.t`<span class="logprobs-empty">start swyping!</span>`;
                  return lps.map(entry => _.LogprobButton.new({ entry, loom: this.loom() }));
                }}
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "SwypeChoice",
    doc: "Corner choice in the swyper",
    slots: [
      $html.Component,
      $.Var.new({ name: "loom" }),
      $.Var.new({ name: "swyper" }),
      $.Var.new({ name: "position" }),
      $.Var.new({ name: "index" }),
      $.Method.new({
        name: "text",
        do() {
          const choices = this.loom().choices();
          return choices[this.index()] || "";
        }
      }),
      $.Method.new({
        name: "isActive",
        do() {
          return this.swyper().swyping() && this.swyper().activeCorner() === this.index();
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          const pos = this.position();
          return $html.HTML.t`
            <div class=${() => "swype-choice " + pos + (this.isActive() ? " active" : "")}
                 onclick=${() => this.loom().selectChoice(this.index())}>
              <div class="choice-text">${() => this.text() || "..."}</div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "Swyper",
    doc: "Pie menu interface with 4 corner choices",
    slots: [
      $html.Component,
      $.Var.new({ name: "loom" }),
      $.Signal.new({ name: "swyping", default: false }),
      $.Signal.new({ name: "activeCorner", default: null }),
      $.Signal.new({ name: "dialAngle", default: 0 }),
      $.Signal.new({ name: "startX", default: 0 }),
      $.Signal.new({ name: "startY", default: 0 }),
      $.Method.new({
        name: "handleTouchStart",
        do(e) {
          if (e.target.closest('.swype-choice')) return;
          const touch = e.touches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          this.startX(touch.clientX - rect.left);
          this.startY(touch.clientY - rect.top);
          this.swyping(true);
          e.preventDefault();
        }
      }),
      $.Method.new({
        name: "handleTouchMove",
        do(e) {
          if (!this.swyping()) return;
          e.preventDefault();
          const touch = e.touches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;

          if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
            this.activeCorner(null);
            this.loom().clearPreview();
            return;
          }

          const dx = x - this.startX();
          const dy = y - this.startY();
          const threshold = 50;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance >= threshold) {
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            this.dialAngle(angle);
          }

          if (distance < threshold) {
            this.activeCorner(null);
            this.loom().clearPreview();
            return;
          }

          // Raycast from start point in swipe direction to find which corner
          const width = rect.width;
          const height = rect.height;
          const sx = this.startX();
          const sy = this.startY();

          // Find t where ray hits each edge
          let tMin = Infinity;
          if (dx > 0) tMin = Math.min(tMin, (width - sx) / dx);
          if (dx < 0) tMin = Math.min(tMin, -sx / dx);
          if (dy > 0) tMin = Math.min(tMin, (height - sy) / dy);
          if (dy < 0) tMin = Math.min(tMin, -sy / dy);

          // Calculate intersection point
          const hitX = sx + tMin * dx;
          const hitY = sy + tMin * dy;

          // Determine corner based on which quadrant the hit point is in
          const isLeft = hitX < width / 2;
          const isUp = hitY < height / 2;
          let corner;
          if (isUp && isLeft) corner = 0;
          else if (isUp && !isLeft) corner = 1;
          else if (!isUp && isLeft) corner = 2;
          else corner = 3;

          this.activeCorner(corner);
          this.loom().previewChoice(corner);
        }
      }),
      $.Method.new({
        name: "handleTouchEnd",
        do(e) {
          if (!this.swyping()) return;
          e.preventDefault();
          const corner = this.activeCorner();
          this.swyping(false);
          this.activeCorner(null);

          if (corner !== null) {
            this.loom().selectChoice(corner);
          }
          this.loom().clearPreview();
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          const positions = ["top-left", "top-right", "bottom-left", "bottom-right"];
          return $html.HTML.t`
            <div class=${() => "swyper" + (this.swyping() ? " swyping" : "")}
                 ontouchstart=${e => this.handleTouchStart(e)}
                 ontouchmove=${e => this.handleTouchMove(e)}
                 ontouchend=${e => this.handleTouchEnd(e)}
                 ontouchcancel=${e => this.handleTouchEnd(e)}>
              ${positions.map((pos, i) => _.SwypeChoice.new({ loom: this.loom(), swyper: this, position: pos, index: i }))}
              <div class="swype-anchor" style=${() => `left: ${this.startX()}px; top: ${this.startY()}px; opacity: ${this.swyping() ? 1 : 0}`}>✕</div>
              <div class="swyper-dial" style=${() => `left: ${this.startX() - 50}px; top: ${this.startY() - 50}px; transform: rotate(${this.dialAngle() + 90}deg); opacity: ${this.swyping() ? 1 : 0}`}>
                <div class="dial-hand"></div>
              </div>
              <div class="swyper-status">
                ${() => this.loom().loading() ? "..." : ""}
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "BottomBar",
    doc: "Control bar with respin, undo/redo, image upload",
    slots: [
      $html.Component,
      $.Var.new({ name: "loom" }),
      $.Method.new({
        name: "handleImageSelect",
        do(e) {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            this.loom().client().setImageData(base64);
            this.loom().client().imageMode(true);
          };
          reader.readAsDataURL(file);
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="bottom-bar">
              <button class="bar-btn" onclick=${() => this.loom().respin()}>
                <span class="btn-icon">↻</span>
                <span class="btn-label">respin</span>
              </button>
              <button class="bar-btn" onclick=${() => this.loom().undo()}>
                <span class="btn-icon">↩</span>
                <span class="btn-label">undo</span>
              </button>
              <button class="bar-btn" onclick=${() => this.loom().redo()}>
                <span class="btn-icon">↪</span>
                <span class="btn-label">redo</span>
              </button>
              <label class="bar-btn">
                <span class="btn-icon">${() => this.loom().client().imageData() ? "🖼" : "📷"}</span>
                <span class="btn-label">image</span>
                <input type="file" accept="image/*" hidden onchange=${e => this.handleImageSelect(e)} />
              </label>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "TopBar",
    doc: "Header bar with title and menu",
    slots: [
      $html.Component,
      $.Var.new({ name: "loom" }),
      $.Signal.new({ name: "menuOpen", default: false }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="top-bar">
              <button class="menu-btn" onclick=${() => this.menuOpen(!this.menuOpen())}>☰</button>
              <h1 class="title">SWYPERLOOM</h1>
              <div class="spacer"></div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "EditModal",
    doc: "Modal for editing text",
    slots: [
      $html.Component,
      $.Var.new({ name: "loom" }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="edit-modal" hidden=${() => !this.loom().editing()}
                 onclick=${e => { if (e.target.classList.contains('edit-modal')) this.loom().stopEditing(); }}>
              <div class="edit-container">
                <textarea class="edit-textarea"
                          oninput=${e => this.loom().editText(e.target.value)}>${() => this.loom().text()}</textarea>
                <button class="edit-done" onclick=${() => this.loom().stopEditing()}>Done</button>
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "SwypeLoom",
    doc: "Main mobile loom application",
    slots: [
      $html.Component,
      $.Signal.new({ name: "text", default: "Once upon a time" }),
      $.Signal.new({ name: "choices", default: [] }),
      $.Signal.new({ name: "logprobs", default: [] }),
      $.Signal.new({ name: "loading", default: false }),
      $.Signal.new({ name: "editing", default: false }),
      $.Signal.new({ name: "preview", default: "" }),
      $.Var.new({ name: "client" }),
      $.Var.new({ name: "undoStack", default: () => [] }),
      $.Var.new({ name: "redoStack", default: () => [] }),
      $.Var.new({ name: "textDisplay" }),
      $.After.new({
        name: "init",
        do() {
          const client = $llm.LLMClient.new({
            baseURL: "http://localhost:3731",
            model: "",
            logprobs: 20,
            baseTemperature: 0.8,
          });
          this.client(client);

          const saved = localStorage.getItem("SWYPELOOM_TEXT");
          if (saved) this.text(saved);

          this.textDisplay(_.TextDisplay.new({ loom: this }));
          this.generateChoices();
        }
      }),
      $.Method.new({
        name: "saveText",
        do() {
          localStorage.setItem("SWYPELOOM_TEXT", this.text());
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
          this.generateChoices();
        }
      }),
      $.Method.new({
        name: "previewChoice",
        do(index) {
          const choice = this.choices()[index];
          if (choice) {
            this.preview(choice);
            this.textDisplay().preview(choice);
          }
        }
      }),
      $.Method.new({
        name: "clearPreview",
        do() {
          this.preview("");
          this.textDisplay().preview("");
        }
      }),
      $.Method.new({
        name: "selectChoice",
        do(index) {
          const choice = this.choices()[index];
          if (!choice) return;

          this.undoStack().push(this.text());
          this.redoStack().length = 0;
          this.text(this.text() + choice);
          this.saveText();
          this.generateChoices();
        }
      }),
      $.Method.new({
        name: "insertToken",
        do(token) {
          this.undoStack().push(this.text());
          this.redoStack().length = 0;
          this.text(this.text() + token);
          this.saveText();
          this.generateChoices();
        }
      }),
      $.Method.new({
        name: "undo",
        do() {
          if (!this.undoStack().length) return;
          this.redoStack().push(this.text());
          this.text(this.undoStack().pop());
          this.saveText();
          this.generateChoices();
        }
      }),
      $.Method.new({
        name: "redo",
        do() {
          if (!this.redoStack().length) return;
          this.undoStack().push(this.text());
          this.text(this.redoStack().pop());
          this.saveText();
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
          this.saveText();
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
        name: "css",
        do() {
          return `
            :root {
              --charcoal: #463C3C;
              --wood: #B89877;
              --sand: #E2C79D;
              --light-sand: #EEDAB8;
              --seashell: #FAE8F4;
              --sky: #92B6D5;
              --ocean: #5893A8;
              --dusk: #D8586A;
              --grass: #40A472;
              --seaweed: #487455;

              --box-shadow-args: 1px 1px 0 0 var(--charcoal),
                                -1px -1px 0 0 var(--wood),
                                -2px -2px     var(--wood),
                                -2px  0       var(--wood),
                                  0  -2px      var(--wood),
                                  2px  2px 0 0 var(--charcoal),
                                  0   2px 0 0  var(--charcoal),
                                  2px  0       var(--charcoal),
                                  2px -2px     var(--wood),
                                -2px  2px     var(--charcoal);

              --box-shadow-args-inset: inset  1px  1px 0   var(--wood),
                                      inset  0    1px 0   var(--wood),
                                      inset  1px  0   0   var(--wood),
                                      inset -1px -1px 0   var(--charcoal),
                                      inset  0   -1px 0   var(--charcoal),
                                      inset -1px  0   0   var(--charcoal);
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            ::selection {
              background: var(--ocean);
              color: var(--seashell);
            }

            body {
              font-family: Georgia, 'Times New Roman', serif;
              background: var(--sand);
              color: var(--charcoal);
              overflow: hidden;
              touch-action: none;
              user-select: none;
              -webkit-user-select: none;
            }

            .swypeloom {
              display: flex;
              flex-direction: column;
              height: 100dvh;
              max-width: 480px;
              margin: 0 auto;
              padding: 4px;
              gap: 4px;
            }

            /* Top Bar */
            .top-bar {
              display: flex;
              align-items: center;
              padding: 4px 8px;
              background: var(--wood);
              box-shadow: var(--box-shadow-args);
            }

            .menu-btn {
              background: var(--sand);
              border: 0;
              box-shadow: var(--box-shadow-args);
              color: var(--seaweed);
              font-size: 18px;
              padding: 4px 8px;
              cursor: pointer;
            }

            .menu-btn:active {
              background: var(--wood);
            }

            .title {
              flex: 1;
              text-align: center;
              font-size: 16px;
              font-weight: normal;
              font-style: italic;
              color: var(--seashell);
            }

            .spacer { width: 40px; }

            /* Text Display */
            .text-display {
              flex: 0 0 200px;
              display: flex;
              flex-direction: column;
            }

            .text-content {
              background: var(--light-sand);
              box-shadow: var(--box-shadow-args);
              padding: 8px;
              height: 200px;
              overflow-y: auto;
              font-size: 15px;
              line-height: 1.5;
              color: var(--charcoal);
              white-space: pre-wrap;
              word-break: break-word;
              cursor: pointer;
            }

            .text-content:active {
              box-shadow: var(--box-shadow-args), var(--box-shadow-args-inset);
            }

            .main-text {
              color: var(--charcoal);
            }

            .preview-text {
              color: var(--ocean);
              opacity: 0.7;
            }

            /* Logprobs Bar */
            .logprobs-bar {
              background: var(--wood);
              padding: 4px;
              box-shadow: var(--box-shadow-args);
            }

            .logprobs-scroll {
              display: flex;
              gap: 4px;
              overflow-x: auto;
              padding: 2px;
              scrollbar-width: none;
              -webkit-overflow-scrolling: touch;
            }

            .logprobs-scroll::-webkit-scrollbar { display: none; }

            .logprobs-empty {
              color: var(--seashell);
              font-size: 12px;
              font-style: italic;
              padding: 4px;
            }

            .logprob-btn {
              display: flex;
              flex-direction: column;
              align-items: center;
              background: var(--light-sand);
              border: 0;
              box-shadow: var(--box-shadow-args);
              padding: 4px 8px;
              color: var(--seaweed);
              cursor: pointer;
              flex-shrink: 0;
            }

            .logprob-btn:active {
              background: var(--sky);
            }

            .logprob-btn .token {
              font-family: monospace;
              font-size: 13px;
              white-space: pre;
            }

            .logprob-btn .prob {
              font-size: 9px;
              font-style: italic;
              color: var(--charcoal);
              opacity: 0.7;
            }

            /* Swyper */
            .swyper {
              flex: 1;
              position: relative;
              padding: 8px;
              background: var(--light-sand);
              box-shadow: var(--box-shadow-args);
              touch-action: none;
              min-height: 200px;
            }

            .swype-choice {
              position: absolute;
              width: 45%;
              display: flex;
              align-items: flex-start;
              justify-content: flex-start;
              padding: 4px;
              cursor: pointer;
            }

            .swype-choice.top-left { top: 8px; left: 8px; }
            .swype-choice.top-right { top: 8px; right: 8px; text-align: right; justify-content: flex-end; }
            .swype-choice.bottom-left { bottom: 8px; left: 8px; align-items: flex-end; }
            .swype-choice.bottom-right { bottom: 8px; right: 8px; align-items: flex-end; text-align: right; justify-content: flex-end; }

            .choice-text {
              font-size: 13px;
              line-height: 1.4;
              color: var(--charcoal);
              word-break: break-word;
              transition: opacity 0.1s ease-out;
            }

            .swyper.swyping .choice-text {
              opacity: 0.4;
            }

            .swyper.swyping .swype-choice.active .choice-text {
              opacity: 1;
            }

            .swype-anchor {
              position: absolute;
              transform: translate(-50%, -50%);
              font-size: 16px;
              font-weight: bold;
              color: var(--dusk);
              pointer-events: none;
              transition: opacity 0.1s ease-out;
              z-index: 10;
            }

            .swyper-dial {
              position: absolute;
              width: 100px;
              height: 100px;
              border-radius: 50%;
              background: var(--sand);
              pointer-events: none;
              transition: opacity 0.15s ease-out;
              transform-origin: center center;
            }

            .dial-hand {
              position: absolute;
              left: 50%;
              top: -100px;
              width: 0;
              height: 0;
              margin-left: -12px;
              border-left: 12px solid transparent;
              border-right: 12px solid transparent;
              border-bottom: 100px solid var(--sand);
            }

            .swyper-status {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 32px;
              color: var(--dusk);
              pointer-events: none;
            }

            /* Bottom Bar */
            .bottom-bar {
              display: flex;
              justify-content: space-around;
              padding: 4px;
              background: var(--wood);
              box-shadow: var(--box-shadow-args);
            }

            .bar-btn {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 2px;
              background: var(--sand);
              border: 0;
              box-shadow: var(--box-shadow-args);
              color: var(--seaweed);
              cursor: pointer;
              padding: 6px 12px;
            }

            .bar-btn:active {
              background: var(--wood);
            }

            .btn-icon {
              font-size: 16px;
            }

            .btn-label {
              font-size: 9px;
              text-transform: lowercase;
              font-style: italic;
            }

            /* Edit Modal */
            .edit-modal {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 16px;
              z-index: 100;
            }

            .edit-modal[hidden] { display: none; }

            .edit-container {
              width: 100%;
              max-width: 400px;
              background: var(--sand);
              box-shadow: var(--box-shadow-args);
              padding: 8px;
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .edit-textarea {
              width: 100%;
              height: 300px;
              background: var(--light-sand);
              border: 0;
              box-shadow: var(--box-shadow-args);
              padding: 8px;
              font-family: Georgia, serif;
              font-size: 15px;
              color: var(--charcoal);
              resize: none;
            }

            .edit-textarea:focus {
              outline: none;
              box-shadow: var(--box-shadow-args), var(--box-shadow-args-inset);
            }

            .edit-done {
              background: var(--grass);
              border: 0;
              box-shadow: var(--box-shadow-args);
              padding: 8px;
              color: var(--seashell);
              font-size: 14px;
              font-style: italic;
              cursor: pointer;
            }

            .edit-done:active {
              background: var(--seaweed);
            }

            [hidden] {
              display: none !important;
            }
          `;
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="swypeloom">
              ${_.TopBar.new({ loom: this })}
              ${this.textDisplay()}
              ${_.LogprobsBar.new({ loom: this })}
              ${_.Swyper.new({ loom: this })}
              ${_.BottomBar.new({ loom: this })}
              ${_.EditModal.new({ loom: this })}
            </div>
          `;
        }
      })
    ]
  });

  _.SwypeLoom.new().mount();

}.module({ name: "swyperloom", imports: [base, html, llm] }).load();
