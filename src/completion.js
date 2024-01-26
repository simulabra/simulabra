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
      name: 'context_var',
      slots: [
        $.var,
      ]
    });

    $.class.new({
      name: 'fetch_context',
      slots: [
        $.var.new({ name: 'context' }),
        $.var.new({ name: 'count' }),
        $.var.new({ name: 'temperature' }),
        $.var.new({ name: 'n_predict' }),
      ]
    });

    $.class.new({
      name: 'completor_fetch_next_command',
      slots: [
        $.command,
        $.var.new({ name: 'count' }),
        $.var.new({ name: 'temperature' }),
        $.var.new({ name: 'n_predict' }),
        $.var.new({ name: 'n_probs' }),
        $.var.new({ name: 'repeat_penalty', default: 0.3 }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            ctx.completion_candidates().reset();
            let logit_bias = [];
            const prompt = ctx.prompt();
            function valid() {
              return ctx.prompt() === prompt;
            }
            let count = this.count() ?? ctx.count();
            let n_predict = this.n_predict() ?? ctx.n_predict();
            let temperature = this.temperature() ?? ctx.temperature();;
            let n_probs = this.n_probs() ?? ctx.n_probs();;
            const probs = await $.local_llama_completion_command.new({
              prompt,
              n_probs,
              n_predict: 1,
            }).run();
            ctx.probs(probs.probs()[0].probs.map(p => $.token_prob.new({ object: ctx, parent: ctx, ...p })));
            for (let i = 0; i < count; i++) {
              if (!valid()) {
                return;
              }
              const completion = await $.local_llama_completion_command.new({
                prompt,
                logit_bias,
                n_predict,
                temperature
              }).run();

              if (completion.output() !== '' && valid()) {
                ctx.completion_candidates().add(completion);
                const tokens = await $.local_llama_tokenize_command.new({
                  prompt: completion.output()
                }).run();
                for (const tok of tokens) {
                  const logit = logit_bias.find(l => l[0] === tok);
                  if (logit) {
                    logit[1] -= this.repeat_penalty();
                  } else {
                    logit_bias.push([tok, -this.repeat_penalty()]);
                  }
                }
              }
              temperature += 0.2;
            }
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_insert_command',
      slots: [
        $.command,
        $.var.new({ name: 'text' }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            ctx.insert(this.text());
            await $.completor_fetch_next_command.new().run(ctx);
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_fetch_next_link',
      slots: [
        $.link,
        $.method.new({
          name: 'link_text',
          do: function link_text() {
            return 'think!';
          }
        }),
        $.method.new({
          name: 'subtext',
          do: function subtext() {
            return '[ ]';
          }
        }),
        $.method.new({
          name: 'command',
          do: function command() {
            return $.completor_fetch_next_command.new();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_complete_command',
      slots: [
        $.command,
        $.var.new({
          name: 'length',
          default: 100,
        }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            let n_predict = ctx.n_predict();
            const chunks = this.length() / n_predict;
            let temperature = ctx.temperature();;
            const chunk = async (depth = 0) => {
              if (depth > chunks) {
                this.log('hit chunky ceiling!');
                return;
              }
              const completion = await $.local_llama_completion_command.new({
                prompt: ctx.prompt(),
                n_predict,
                temperature,
              }).run();
              if (completion.output() !== '') {
                ctx.insert(completion.output());
                return chunk(depth + 1);
              }
            }

            await chunk();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_complete_link',
      slots: [
        $.link,
        $.method.new({
          name: 'link_text',
          do: function link_text() {
            return 'complete';
          }
        }),
        $.method.new({
          name: 'subtext',
          do: function subtext() {
            return '[RET]';
          }
        }),
        $.method.new({
          name: 'command',
          do: function command() {
            return $.completor_complete_command.new();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_clear_command',
      slots: [
        $.command,
        $.method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.clear();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_clear_link',
      slots: [
        $.link,
        $.method.new({
          name: 'link_text',
          do: function link_text() {
            return 'clear';
          }
        }),
        $.method.new({
          name: 'subtext',
          do: function subtext() {
            return 'Esc';
          }
        }),
        $.method.new({
          name: 'command',
          do: function command() {
            return $.completor_clear_command.new();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_add_link',
      slots: [
        $.link,
        $.var.new({ name: 'choice' }),
        $.var.new({ name: 'text' }),
        $.var.new({ name: 'emphasize' }),
        $.method.new({
          name: 'link_text',
          do: function link_text() {
            return this.text();
          }
        }),
        $.method.new({
          name: 'subtext',
          do: function subtext() {
            return this.choice();
          }
        }),
        $.method.new({
          name: 'command',
          do: function command() {
            return $.completor_insert_command.new({ text: this.text() });
          }
        }),
        $.method.new({
          name: 'hover',
          do: function hover() {
            completor.preview(this.text());
          }
        }),
        $.method.new({
          name: 'unhover',
          do: function unhover() {
            completor.preview('');
          }
        }),
      ]
    });

    $.class.new({
      name: 'completion_candidates',
      slots: [
        $.component,
        $.var.new({ name: 'candidates', default: [] }),
        $.method.new({
          name: 'render',
          do: function render() {
            const candidatesElements = this.candidates().map((cc, i) => {
              return $el.div({}, $.completor_add_link.new({
                object: this.parent(),
                text: cc.output(),
                choice: i + 1,
                parent: this,
              }));
            });

            return $el.div({}, ...candidatesElements);
          }
        }),
        $.method.new({
          name: 'add',
          do: function add(it) {
            this.candidates([...this.candidates(), it]);
          }
        }),
        $.method.new({
          name: 'reset',
          do: function reset() {
            this.candidates([]);
          }
        }),
      ]
    });

    $.class.new({
      name: 'token_prob',
    },
      $.link,
      $.var.new({ name: 'tok_str' }),
      $.var.new({ name: 'prob' }),
      $.method.new({
        name: 'link_text',
        do: function link_text() {
          return this.tok_str();
        }
      }),
      $.method.new({
        name: 'subtext',
        do: function subtext() {
          return this.prob().toPrecision(2);
        }
      }),
      $.method.new({
        name: 'command',
        do: function command() {
          this.log('issue command');
          return $.completor_insert_command.new({ text: this.tok_str() });
        }
      }),
      $.method.new({
        name: 'hover',
        do: function hover() {
          completor.preview(this.tok_str());
        }
      }),
      $.method.new({
        name: 'unhover',
        do: function unhover() {
          completor.preview('');
        }
      }),
    );

    $.class.new({
      name: 'base_model',
      slots: [
        $.method.new({
          name: 'system',
          do: function system() {
            return 'You are an intelligent assistant.';
          }
        }),
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output) {
            return `${user}${output}`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'chatml_model',
      slots: [
        $.base_model,
        $.var.new({ name: 'system', default: 'You are an intelligent assistant.', }),
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output, system) {
            return `<|im_start|>system
${system}
<|im_end|>
<|im_start|>user
${user}
<|im_end|>
<|im_start|>assistant
${output}`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'mistral_model',
      slots: [
        $.base_model,
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output) {
            return `[INST]${user}[\INST]${output}`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'alpaca_model',
      slots: [
        $.base_model,
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output, system) {
            return `${system}
### Instruction:
${user}
### Response:
${output}`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_instruction_focus_command',
      slots: [
        $.command,
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            ctx.instruction().focus();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_unfocus_command',
      slots: [
        $.command,
        $.method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.instruction().blur();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_set_n_predict_command',
      slots: [
        $.command,
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.n_predict(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_set_count_command',
      slots: [
        $.command,
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.count(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_set_temperature_command',
      slots: [
        $.command,
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'run',
          do: function run(ctx) {
            ctx.temperature(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'instruction_input',
      slots: [
        $.toggly_input,
        $.before.new({
          name: 'blur',
          do: function blur() {
            if (this.active()) {
              completor.save();
            }
          }
        })
      ]
    })

    $.class.new({
      name: 'completor',
      slots: [
        $.window,
        $.application,
        $.var.new({ name: 'completion_candidates' }),
        $.var.new({ name: 'prompt_format' }),
        $.var.new({
          name: 'instruction',
          default() { return $.instruction_input.new({ name: 'instruction', parent: this }); }
        }),
        $.var.new({ name: 'count', default: 5 }),
        $.var.new({ name: 'temperature', default: 2.0 }),
        $.var.new({ name: 'n_predict', default: 4 }),
        $.var.new({ name: 'n_probs', default: 50 }),
        $.var.new({ name: 'choices', default: [] }),
        $.var.new({ name: 'probs', default: [] }),
        $.event.new({
          name: 'update',
          do: function update(e) {
            if (e._var.name() === 'count') {
              document.querySelector('.completion_candidates').style['min-height'] = `${this.count() * 1.5}em`;
            }
          }
        }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.completion_candidates($.completion_candidates.new({ parent: this }));
            const model = localStorage.getItem('selected_model') ?? 'chatml';
            this.set_model(model);
            const instruction = localStorage.getItem('instruction_value') ?? '';
            this.instruction().set(instruction);

            document.addEventListener('keydown', e => {
              if (!(this.instruction().active() || e.ctrlKey)) {
                const cmd = this.key_command(e.key, e);
                cmd?.dispatchTo(this);
              } else {
                if (e.key === 'Escape') {
                  this.dispatchEvent({
                    type: 'command',
                    target: $.completor_unfocus_command.new(),
                  });
                }
              }
            });
          }
        }),
        $.method.new({
          name: 'key_command',
          do: function key_command(key, e) {
            if (key === 'i') {
              e.preventDefault();
              return $.completor_instruction_focus_command.new();
            } else if (key === ' ') {
              return $.completor_fetch_next_command.new();
            } else if (key === '[') {
              return $.completor_set_n_predict_command.new({ value: this.n_predict() - 1 });
            } else if (key === ']') {
              return $.completor_set_n_predict_command.new({ value: this.n_predict() + 1 });
            } else if (key === '<') {
              return $.completor_set_temperature_command.new({ value: this.temperature() - 1 });
            } else if (key === '>') {
              return $.completor_set_temperature_command.new({ value: this.temperature() + 1 });
            } else if (key === ',') {
              return $.completor_set_count_command.new({ value: this.count() - 1 });
            } else if (key === '.') {
              return $.completor_set_count_command.new({ value: this.count() + 1 });
            } else if (key === 'Escape') {
              return $.completor_clear_command.new();
            } else if (key === 'Enter') {
              return $.completor_complete_command.new();
            } else if (!isNaN(+key)) {
              const text = this.completion_candidates().candidates()[+key - 1]?.output();
              if (text !== undefined) {
                return $.completor_insert_command.new({ text });
              } else {
                return null;
              }
            } else {
              this.log('no match', key);
              return null;
            }
          }
        }),
        $.method.new({
          name: 'window_title',
          do: function window_title() {
            return 'imagine anything';
          }
        }),
        $.method.new({
          name: 'preview',
          do: function preview(text) {
            this.instruction().preview(text);
          }
        }),
        $.method.new({
          name: 'insert',
          do: function insert(it) {
            this.choices().push(it);
            this.instruction().blur();
            this.instruction().set(this.instruction().value() + it);
            this.preview('');
            this.save();
          }
        }),
        $.method.new({
          name: 'clear',
          do: function clear() {
            this.instruction().set('');
          }
        }),
        $.method.new({
          name: 'save',
          do: function save() {
            localStorage.setItem('instruction_value', this.instruction().value());
          }
        }),
        $.method.new({
          name: 'fetch_next',
          do: function fetch_next() {
            return $.completor_fetch_next_command.new().run(this);
          }
        }),
        $.method.new({
          name: 'prompt',
          do: function prompt() {
            return this.instruction().value();
          }
        }),
        $.method.new({
          name: 'set_model',
          do: function set_model(modelName) {
            localStorage.setItem('selected_model', modelName);
            this.prompt_format($[modelName + '_model'].new());
          }
        }),
        $.method.new({
          name: 'model_option',
          do: function model_option(name, selectedName) {
            return $el.option({ value: name, selected: name + '_model' === selectedName }, name);
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $el.div({},
              this.instruction(),
              // $el.select({
              //   onchange: (e) => {
              //     this.set_model(e.target.value);
              //   }
              // }, [
              //   ...['chatml', 'mistral', 'zephyr', 'alpaca', 'base'].map(modelName => {
              //     return this.model_option(modelName, this.prompt_format().class().name());
              //   }),
              // ]),
              $.number_input.new({
                name: 'count',
                parent: this,
                command: $.completor_set_count_command,
              }),
              $.number_input.new({
                name: 'temperature',
                parent: this,
                command: $.completor_set_temperature_command,
              }),
              $.number_input.new({
                name: 'n_predict',
                parent: this,
                command: $.completor_set_n_predict_command,
              }),
              $el.div({}),
              $.completor_fetch_next_link.new({ object: this, parent: this }),
              ' ',
              $.completor_complete_link.new({ object: this, parent: this }),
              ' ',
              $.completor_clear_link.new({ object: this, parent: this }),
              $el.div({ class: 'prob-box' }, ...this.probs()),
              this.completion_candidates(),
            );
          }
        }),
        $.method.new({
          name: 'css',
          do: function css() {
            return `
.completor-link-pre {
  color: var(--secondary-2);
}

.completor-link-pre-emphasize {
  color: var(--secondary-2);
}

.completed-true {
  text-decoration: line-through;
}

.completor-output {
  white-space: pre;
}

.completor-preview {
  color: var(--foreground-1);
  font-style: italic;
}

.completion_candidates {
  min-height: 4.5em;
  display: block;
}

.token_prob {
  border: 1px solid var(--primary);
  padding: 2px;
  margin: 2px;
  line-height: 200%;
  background: var(--background-text);
}

.prob_sub {
  font-size: 0.5em;
  color: var(--foreground-1);
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
