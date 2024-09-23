import base from './base.js';
import html from './html.js';
import llm from './llm.js';

export default await base.find('class', 'module').new({
  name: 'completion',
  imports: [base, html, llm],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;
    const $el = $.html_element.proxy();

    $.class.new({
      name: 'ContextVar',
      slots: [
        $.Var,
      ]
    });

    $.class.new({
      name: 'FetchContext',
      slots: [
        $.Var.new({ name: 'context' }),
        $.Var.new({ name: 'count' }),
        $.Var.new({ name: 'temperature' }),
        $.Var.new({ name: 'nPredict' }),
      ]
    });

    // the new style?
    // $.class.new('FetchContext', {
    //   slots: [
    //     $.Var.new('context'),
    //     $.Var.new('count'),
    //     $.Method.fn(async function run(ctx) {
    //     }),
    //   ]
    // });

    $.class.new({
      name: 'CompletorFetchNextCommand',
      slots: [
        $.command,
        $.Var.new({ name: 'count' }),
        $.Var.new({ name: 'temperature' }),
        $.Var.new({ name: 'nPredict' }),
        $.Var.new({ name: 'nProbs' }),
        $.Var.new({ name: 'control' }),
        $.Var.new({ name: 'repeatPenalty', default: 0.3 }),
        $.Method.new({
          name: 'run',
          do: async function run(ctx) {
            ctx.completionCandidates().reset();
            let logit_bias = [];
            const prompt = ctx.prompt();
            function valid() {
              return ctx.prompt() === prompt;
            }
            let count = this.count() ?? ctx.count();
            let nPredict = this.nPredict() ?? ctx.nPredict();
            let temperature = this.temperature() ?? ctx.temperature();
            let nProbs = this.nProbs() ?? ctx.nProbs();
            let control = this.control() ?? ctx.control();
            for (let i = 0; i < count; i++) {
              if (!valid()) {
                return;
              }
              const completion = await ctx.pyserver().completion({
                prompt,
                nPredict,
                temperature,
                nProbs,
                control,
              });
              if (i === 0 && completion.tops()) {
                ctx.probs(Object.entries(completion.tops()).map(([tokStr, prob]) => $.TokenProb.new({ object: ctx, parent: ctx, tokStr, prob })));
              }

              if (completion.content() !== '' && valid()) {
                ctx.completionCandidates().add(completion);
                for (let tok of completion.tokens()) {
                  const logit = logit_bias.find(l => l[0] === tok);
                  if (logit) {
                    logit[1] -= this.repeatPenalty();
                  } else {
                    logit_bias.push([tok, -this.repeatPenalty()]);
                  }
                }
              }
              // temperature += 0.2;
            }
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorInsertCommand',
      slots: [
        $.command,
        $.Var.new({ name: 'text' }),
        $.Method.new({
          name: 'run',
          do: async function run(ctx) {
            ctx.insert(this.text());
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorFetchNextLink',
      slots: [
        $.link,
        $.Method.new({
          name: 'linkText',
          do: function linkText() {
            return 'think!';
          }
        }),
        $.Method.new({
          name: 'subtext',
          do: function subtext() {
            return 'Spc';
          }
        }),
        $.Method.new({
          name: 'command',
          do: function command() {
            return $.CompletorFetchNextCommand.new();
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorCompleteCommand',
      slots: [
        $.command,
        $.Var.new({
          name: 'length',
          default: 100,
        }),
        $.Method.new({
          name: 'run',
          do: async function run(ctx) {
            let nPredict = ctx.nPredict();
            const chunks = this.length() / nPredict;
            let temperature = ctx.temperature();;
            const chunk = async (depth = 0) => {
              if (depth > chunks) {
                this.log('hit chunky ceiling!');
                return;
              }
              const prompt = ctx.prompt();
              const completion = await ctx.pyserver().completion({
                prompt,
                nPredict,
                temperature,
              });
              if (completion.content() !== '') {
                ctx.insert(completion.content());
                return chunk(depth + 1);
              }
            }

            await chunk();
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorCompleteLink',
      slots: [
        $.link,
        $.Method.new({
          name: 'linkText',
          do: function linkText() {
            return 'complete';
          }
        }),
        $.Method.new({
          name: 'subtext',
          do: function subtext() {
            return 'Ret';
          }
        }),
        $.Method.new({
          name: 'command',
          do: function command() {
            return $.CompletorCompleteCommand.new();
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorClearCommand',
      slots: [
        $.command,
        $.Method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.clear();
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorClearLink',
      slots: [
        $.link,
        $.Method.new({
          name: 'linkText',
          do: function linkText() {
            return 'clear';
          }
        }),
        $.Method.new({
          name: 'command',
          do: function command() {
            return $.CompletorClearCommand.new();
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorAddLink',
      slots: [
        $.link,
        $.Var.new({ name: 'choice' }),
        $.Var.new({ name: 'text' }),
        $.Var.new({ name: 'emphasize' }),
        $.Method.new({
          name: 'linkText',
          do: function linkText() {
            return this.text();
          }
        }),
        $.Method.new({
          name: 'subtext',
          do: function subtext() {
            return this.choice();
          }
        }),
        $.Method.new({
          name: 'command',
          do: function command() {
            return $.CompletorInsertCommand.new({ text: this.text() });
          }
        }),
        $.Method.new({
          name: 'hover',
          do: function hover() {
            completor.preview(this.text());
          }
        }),
        $.Method.new({
          name: 'unhover',
          do: function unhover() {
            completor.preview('');
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletionCandidates',
      slots: [
        $.component,
        $.Var.new({ name: 'candidates', default: [] }),
        $.Method.new({
          name: 'render',
          do: function render() {
            const candidatesElements = this.candidates().map((cc, i) => {
              return $el.div({}, $.CompletorAddLink.new({
                object: this.parent(),
                text: cc.content(),
                choice: i + 1,
                parent: this,
              }));
            });

            return $el.div({ class: 'CompletionCandidates_list' }, ...candidatesElements);
          }
        }),
        $.Method.new({
          name: 'add',
          do: function add(it) {
            this.candidates([...this.candidates(), it]);
            const child = $el.div({}, $.CompletorAddLink.new({
              object: this.parent(),
              text: it.content(),
              choice: this.candidates().length,
              parent: this,
            }));
            this.element().querySelector('.CompletionCandidates_list').appendChild(child.to_dom());
          }
        }),
        $.Method.new({
          name: 'reset',
          do: function reset() {
            this.candidates([]);
            this.element().querySelector('.CompletionCandidates_list').innerHTML = '';
          }
        }),
      ]
    });

    $.class.new({
      name: 'history_moment',
      slots: [
        $.Var.new({ name: 'action', default: '' }),
        $.Var.new({ name: 'text', default: '' }),
      ]
    });

    $.class.new({
      name: 'CompletorGotoHistoryCommand',
      slots: [
        $.command,
        $.Var.new({ name: 'moment' }),
        $.Method.new({
          name: 'run',
          do: async function run(ctx) {
            ctx.instruction().set(this.moment().text());
            await $.CompletorFetchNextCommand.new().run(ctx);
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorGotoHistoryLink',
      slots: [
        $.link,
        $.Var.new({ name: 'moment' }),
        $.Method.new({
          name: 'linkText',
          do: function linkText() {
            return this.moment().action();
          }
        }),
        $.Method.new({
          name: 'subtext',
          do: function subtext() {
            return '';
          }
        }),
        $.Method.new({
          name: 'command',
          do: function command() {
            return $.CompletorGotoHistoryCommand.new({ moment: this.moment() });
          }
        }),
        $.Method.new({
          name: 'hover',
          do: function hover() {
            completor.preview(this.moment().text(), true);
          }
        }),
        $.Method.new({
          name: 'unhover',
          do: function unhover() {
            completor.preview('');
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletionHistory',
      slots: [
        $.component,
        $.Var.new({ name: 'history', default: [] }),
        $.Method.new({
          name: 'render',
          do: function render() {
            const historyElements = this.history().slice().reverse().map((cc, i) => {
              return $el.div({}, $.CompletorGotoHistoryLink.new({
                object: this.parent(),
                moment: cc,
                parent: this,
              }));
            });

            return $el.div({}, $el.div({}, 'history'), ...historyElements);
          }
        }),
        $.Method.new({
          name: 'add',
          do: function add(it) {
            this.history([...this.history(), it]);
          }
        }),
        $.Method.new({
          name: 'reset',
          do: function reset() {
            this.history([]);
          }
        }),
      ]
    });

    $.class.new(
      {
        name: 'TokenProb',
      },
      $.link,
      $.Var.new({ name: 'tokStr' }),
      $.Var.new({ name: 'prob' }),
      $.Method.new({
        name: 'fontSize',
        do: function fontSize() {
          return 1 + this.prob() * 1.7;
        }
      }),
      $.Method.new({
        name: 'linkText',
        do: function linkText() {
          return this.tokStr();
        }
      }),
      $.Method.new({
        name: 'subtext',
        do: function subtext() {
          const opacity = Math.tanh(this.prob()) + 0.5;
          return $el.span({ style: `opacity: ${opacity}` }, this.prob().toPrecision(2));
        }
      }),
      $.Method.new({
        name: 'command',
        do: function command() {
          this.log('issue command');
          return $.CompletorInsertCommand.new({ text: this.tokStr() });
        }
      }),
      $.after.new({
        name: 'hover',
        do: function hover() {
          completor.preview(this.tokStr());
        }
      }),
      $.Method.new({
        name: 'unhover',
        do: function unhover() {
          completor.preview('');
        }
      }),
      $.after.new({
        name: 'load',
        do: function load(e) {
          this.log(e, this.element());
          this.element().style['font-size'] = `${this.fontSize()}em`;
        }
      }),
    );

    $.class.new({
      name: 'CompletorInstructionFocusCommand',
      slots: [
        $.command,
        $.Method.new({
          name: 'run',
          do: async function run(ctx) {
            ctx.instruction().focus();
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorUnfocusCommand',
      slots: [
        $.command,
        $.Method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.instruction().blur();
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorSetNPredictCommand',
      slots: [
        $.command,
        $.Var.new({ name: 'value' }),
        $.Method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.nPredict(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorSetCountCommand',
      slots: [
        $.command,
        $.Var.new({ name: 'value' }),
        $.Method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.count(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorSetTemperatureCommand',
      slots: [
        $.command,
        $.Var.new({ name: 'value' }),
        $.Method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.temperature(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'CompletorSetControlCommand',
      slots: [
        $.command,
        $.Var.new({ name: 'value' }),
        $.Method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.control(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'InstructionInput',
      slots: [
        $.TogglyInput,
        $.Var.new({ name: 'beforeEditingState' }),
        $.after.new({
          name: 'load',
          do: function load__after() {
            return;
            document.getElementById(this.input().inputID()).addEventListener('blur', e => {
              if (this.active()) {
                this.leave_editing();
                completor.fetch_next();
              }
            });
          }
        }),
        $.after.new({
          name: 'focus',
          do: function focus__after() {
            this.beforeEditingState(this.value(), false);
          }
        }),
        $.Method.new({
          name: 'leave_editing',
          do: function leave_editing() {
            this.active(false, false);
            completor.save();
            if (this.value() !== this.beforeEditingState()) {
              completor.add_history('edited', this.value());
            }
          }
        }),
        $.before.new({
          name: 'blur',
          do: function blur() {
            if (this.active()) {
              this.leave_editing();
            }
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor',
      slots: [
        $.window,
        $.application,
        $.Var.new({
          name: 'instruction',
          default() { return $.InstructionInput.new({ name: 'instruction', parent: this }); }
        }),
        $.Var.new({ name: 'completionCandidates' }),
        $.Var.new({ name: 'count', default: 5 }),
        $.Var.new({ name: 'temperature', default: 0.6 }),
        $.Var.new({ name: 'control', default: 5.0 }),
        $.Var.new({ name: 'nPredict', default: 8 }),
        $.Var.new({ name: 'nProbs', default: 50 }),
        $.Var.new({ name: 'choices', default: [] }),
        $.Var.new({ name: 'history', default() { return $.CompletionHistory.new({ parent: this }) } }),
        $.Var.new({ name: 'probs', default: [] }),
        $.Var.new({ name: 'pyserver' }),
        $.event.new({
          name: 'update',
          do: function update(e) {
            if (e._Var.name() === 'count') {
              document.querySelector('.CompletionCandidates').style['min-height'] = `${this.count() * 1.5}em`;
            }
          }
        }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.completionCandidates($.CompletionCandidates.new({ parent: this }));
            const model = localStorage.getItem('selected_model') ?? 'chatml';
            this.set_model(model);
            const instruction = localStorage.getItem('instruction_value') ?? '';
            this.instruction().set(instruction);
            this.add_history('loaded', instruction);
            this.pyserver($.pyserver.new());

            document.addEventListener('keydown', e => {
              if (!(this.instruction().active() || e.ctrlKey)) {
                const cmd = this.key_command(e.key, e);
                cmd?.dispatchTo(this);
              } else {
                if (e.key === 'Escape') {
                  this.dispatchEvent({
                    type: 'command',
                    target: $.CompletorUnfocusCommand.new(),
                  });
                }
              }
            });
          }
        }),
        $.after.new({
          name: 'probs',
          do: function probs__after(value) {
            if (value) {
              const el = this.element().querySelector('.prob-box');
              el.innerHTML = '';
              for (const prob of value) {
                el.appendChild(prob.to_dom());
              }
            }
          }
        }),
        $.Method.new({
          name: 'key_command',
          do: function key_command(key, e) {
            if (key === 'i') {
              e.preventDefault();
              return $.CompletorInstructionFocusCommand.new();
            } else if (key === ' ') {
              e.preventDefault();
              return $.CompletorFetchNextCommand.new();
            } else if (key === '[') {
              return $.CompletorSetNPredictCommand.new({ value: this.nPredict() - 1 });
            } else if (key === ']') {
              return $.CompletorSetNPredictCommand.new({ value: this.nPredict() + 1 });
            } else if (key === ',') {
              return $.CompletorSetTemperatureCommand.new({ value: this.temperature() - 0.1 });
            } else if (key === '.') {
              return $.CompletorSetTemperatureCommand.new({ value: this.temperature() + 0.1 });
            // } else if (key === ',') {
            //   return $.CompletorSetCountCommand.new({ value: this.count() - 1 });
            // } else if (key === '.') {
            //   return $.CompletorSetCountCommand.new({ value: this.count() + 1 });
            } else if (key === '{') {
              return $.CompletorSetControlCommand.new({ value: this.control() - 0.1 });
            } else if (key === '}') {
              return $.CompletorSetControlCommand.new({ value: this.control() + 0.1 });
            } else if (key === 'Enter') {
              return $.CompletorCompleteCommand.new();
            } else if (!isNaN(+key)) {
              const text = this.completionCandidates().candidates()[+key - 1]?.content();
              if (text !== undefined) {
                return $.CompletorInsertCommand.new({ text });
              } else {
                return null;
              }
            } else {
              this.log('no match', key);
              return null;
            }
          }
        }),
        $.Method.new({
          name: 'window_title',
          do: function window_title() {
            return 'imagine anything';
          }
        }),
        $.Method.new({
          name: 'preview',
          do: function preview(text, hide) {
            this.instruction().preview(text, hide);
          }
        }),
        $.Method.new({
          name: 'add_history',
          do: function add_history(action, text) {
            this.history().add($.history_moment.new({
              action,
              text
            }));
            this.log('history', this.history());
          }
        }),
        $.Method.new({
          name: 'insert',
          do: function insert(it) {
            this.choices().push(it);
            this.instruction().blur();
            this.instruction().set(this.instruction().value() + it);
            this.preview('');
            this.save();
            this.add_history(`insert:${it}`, this.instruction().value());
            this.fetch_next();
          }
        }),
        $.Method.new({
          name: 'clear',
          do: function clear() {
            this.instruction().set('');
          }
        }),
        $.Method.new({
          name: 'save',
          do: function save() {
            localStorage.setItem('instruction_value', this.instruction().value());
          }
        }),
        $.Method.new({
          name: 'fetch_next',
          do: function fetch_next() {
            return $.CompletorFetchNextCommand.new().run(this);
          }
        }),
        $.Method.new({
          name: 'prompt',
          do: function prompt() {
            return this.instruction().value();
          }
        }),
        $.Method.new({
          name: 'set_model',
          do: function set_model(modelName) {
            localStorage.setItem('selected_model', modelName);
            // this.prompt_format($[modelName + '_model'].new());
          }
        }),
        $.Method.new({
          name: 'model_option',
          do: function model_option(name, selectedName) {
            return $el.option({ value: name, selected: name + '_model' === selectedName }, name);
          }
        }),
        $.Method.new({
          name: 'render',
          do: function render() {
            return $el.div(
              { class: 'completor-container' },
              $el.div(
                { class: 'column' },
                $.number_input.new({
                  name: 'temperature',
                  parent: this,
                  bind: 'temperature',
                  command: $.CompletorSetTemperatureCommand,
                  step: 0.1,
                }),
                $.number_input.new({
                  name: 'tokens',
                  parent: this,
                  bind: 'nPredict',
                  command: $.CompletorSetNPredictCommand,
                }),
                $.number_input.new({
                  name: 'control',
                  parent: this,
                  bind: 'control',
                  command: $.CompletorSetControlCommand,
                  step: 0.1,
                }),
                $el.div({}),
                $.CompletorFetchNextLink.new({ object: this, parent: this }),
                ' ',
                $.CompletorCompleteLink.new({ object: this, parent: this }),
                ' ',
                $.CompletorClearLink.new({ object: this, parent: this }),
                $el.div({ class: 'prob-box' }, ...this.probs()),
                this.completionCandidates(),
                this.history(),
              ),
              $el.div(
                { class: 'column' },
                this.instruction(),
              ),
            );
          }
        }),
        $.Method.new({
          name: 'css',
          do: function css() {
            return `
.completor-link-pre {
  color: Var(--secondary-2);
}

.completor-link-pre-emphasize {
  color: Var(--secondary-2);
}

.completed-true {
  text-decoration: line-through;
}

.completor-output {
  white-space: pre;
}

.completor-preview {
  color: Var(--foreground-1);
  font-style: italic;
}

.completor-container {
  display: flex;
  max-width: 1200px;
}

.column {
  flex: 1;
  padding: 4px;
}

.CompletionCandidates {
  min-height: 4.5em;
  display: block;
}

.TokenProb {
  padding: 2px;
  margin: 4px;
  background: Var(--background);
  box-shadow: Var(--box-shadow-args);
  display: inline-block;
}
.TokenProb:hover {
  background: Var(--background-secondary);
  cursor: pointer;
}

.CompletorAddLink {
  padding: 2px;
  margin: 4px;
  background: Var(--background);
  display: inline-block;
  box-shadow: Var(--box-shadow-args);
}
.CompletorAddLink:hover {
  background: Var(--background-secondary);
  cursor: pointer;
}

.prob_sub {
  font-size: 0.5em;
  color: Var(--foreground-1);
}

.prob-box {
  break-inside: avoid;
}

#input-instruction {
  height: 20vh;
}

input[type="number"] {
  width: 3rem;
}
`;
          }
        }),
      ]
    });

    let completor = $.completor.new();
    document.body.appendChild(completor.to_dom());
  }
}).load();
