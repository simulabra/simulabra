import base from './base.js';
import html from './html.js';

export default await base.find('class', 'module').new({
  name: 'completion',
  imports: [base, html],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;
    const $el = $.html_element.proxy();

    // TODO: queue these so only one is running on the backend at the time, add load balancer, or make own API
    // to prevent llama.cpp server segfaulting
    $.class.new({
      name: 'local_llama_completion_command',
      slots: [
        $.command,
        $.var.new({ name: 'prompt' }),
        $.var.new({ name: 'server_url', default: 'http://localhost:3731' }),
        $.var.new({ name: 'n_predict', default: 4 }),
        $.var.new({ name: 'temperature', default: 5.0 }),
        $.var.new({ name: 'top_k', default: 200 }),
        $.var.new({ name: 'top_p', default: 1.00 }),
        $.var.new({ name: 'logit_bias', default: [] }),
        $.method.new({
          name: 'run',
          do: async function run() {
            const res = await fetch(`${this.server_url()}/completion`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                prompt: this.prompt(),
                temperature: this.temperature(),
                top_k: this.top_k(),
                top_p: this.top_p(),
                n_predict: this.n_predict(),
                stream: true,
                logit_bias: this.logit_bias(),
                stop: ['<|im_end|>'],
              })
            });

            let t = await res.text();
            let out = '';

            t.split('\n').forEach(l => {
              if (l.startsWith('data: ')) {
                const message = JSON.parse(l.substring(6));
                out += message.content;
              }
            });
            return out;
          }
        }),
      ]
    });

    $.class.new({
      name: 'local_llama_tokenize_command',
      slots: [
        $.command,
        $.var.new({ name: 'prompt' }),
        $.var.new({ name: 'server_url', default: 'http://localhost:3731' }),
        $.method.new({
          name: 'run',
          do: async function run() {
            const res = await fetch(`${this.server_url()}/tokenize`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                content: this.prompt(),
              })
            });

            if (!res.ok) {
              console.error('Error:', res.status, res.statusText);
              return;
            }

            let result = await res.json();
            return result.tokens;
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_fetch_next_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.var.new({ name: 'count' }),
        $.var.new({ name: 'temperature' }),
        $.var.new({ name: 'n_predict' }),
        $.var.new({ name: 'server_host', default: "100.64.172.3" }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            let completions = [];
            const server_url = `http://${this.server_host()}:3731`;
            this.target().completion_candidates().reset();
            let logit_bias = [];
            let count = this.count() ?? this.target().count();
            let n_predict = this.n_predict() ?? this.target().n_predict();
            let temperature = this.temperature() ?? this.target().temperature();;
            for (let i = 0; i < count; i++) {
              const completion = await $.local_llama_completion_command.new({
                server_url,
                prompt: this.target().prompt(),
                logit_bias,
                n_predict,
                temperature
              }).run();

              completions.push(completion);
              if (completion !== '') {
                this.target().completion_candidates().add(completion);
                const tokens = await $.local_llama_tokenize_command.new({
                  server_url: server_url,
                  prompt: completion
                }).run();
                for (const tok of tokens) {
                  const logit = logit_bias.find(l => l[0] === tok);
                  if (logit) {
                    logit[1] -= 1.0;
                  } else {
                    logit_bias.push([tok, -1.0]);
                  }
                }
              }
              temperature += 0.2;
            }
          }
        }),
        $.method.new({
          name: 'description',
          do: function description() {
            return `<${this.title()} target={${this.target().title()}} />`;
          }
        })
      ]
    });

    $.class.new({
      name: 'completor_insert_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.var.new({ name: 'text' }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            this.target().insert(this.text());
            await $.completor_fetch_next_command.new({ target: this.target() }).run(ctx);
          }
        }),
        $.method.new({
          name: 'description',
          do: function description() {
            return `<${this.title()} target=${this.target().title()} text='${this.text()}' />`;
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
          name: 'command',
          do: function command() {
            return $.completor_fetch_next_command.new({ target: this.object() });
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_clear_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            this.target().clear();
          }
        }),
        $.method.new({
          name: 'description',
          do: function description() {
            return `<${this.title()} target=${this.target().title()} />`;
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
          name: 'command',
          do: function command() {
            return $.completor_clear_command.new({ target: this.object() });
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
            return `${this.choice() ?? '?'}: ${this.text()}`;
          }
        }),
        $.method.new({
          name: 'command',
          do: function command() {
            return $.completor_insert_command.new({ target: this.object(), text: this.text() });
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
            const self = this;
            let hovering = false;
            const candidatesElements = this.candidates().map((cc, i) =>
              $el.div({}, $.completor_add_link.new({
                object: this.parent(),
                text: cc,
                choice: i + 1,
                parent: this,
                properties: {
                  onmouseover: e => {
                    if (!hovering) {
                      hovering = true;
                      e.preventDefault();
                      this.parent().preview(cc);
                    }
                  },
                  onmouseleave: e => {
                    e.preventDefault();
                    this.parent().preview('');
                    hovering = false;
                  },
                }
              }))
            );
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
      name: 'chatml_model',
      slots: [
        $.var.new({ name: 'system', default: 'Assist the user however you can.', }),
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output) {
            return `<|im_start|>system
${this.system()}
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
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output) {
            return `[INST]${user}[\INST]${output}`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'zephyr_model',
      slots: [
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output) {
            return `<|system|>
You are a helpful, intelligent assistant.</s>
<|user|>
${user}
</s>
<|assistant|>
${output}`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'alpaca_model',
      slots: [
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output) {
            return `You are a helpful, intelligent agent.
### Instruction:
${user}
### Response:
${output}`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'base_model',
      slots: [
        $.method.new({
          name: 'prompt',
          do: function prompt(user, output) {
            return `${user}${output}`;
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
            document.getElementById('instruction-input').focus();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_unfocus_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            this.target().instruction().blur();
            this.target().system().blur();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_set_n_predict_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            this.target().n_predict(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_set_count_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            this.target().count(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor_set_temperature_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.var.new({ name: 'value' }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            this.target().temperature(this.value());
          }
        }),
      ]
    });

    $.class.new({
      name: 'number_input',
      slots: [
        $.component,
        $.var.new({ name: 'element' }),
        $.var.new({ name: 'value' }),
        $.var.new({ name: 'command' }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.value(this.parent()[this.name()](), false);
            this.element($el.input({
              type: 'number',
              value: this.value(),
              onchange: e => {
                this.value(+e.target.value, false);
                this.command().new({ target: this.parent(), value: this.value() }).dispatchTo(this);
              }
            }), false);
          }
        }),
        $.method.new({
          name: 'render',
          do: function render(ctx) {
            return $el.div({}, this.name(), this.element());
          }
        }),
      ]
    });

    $.class.new({
      name: 'input',
      slots: [
        $.component,
        $.var.new({ name: 'value', default: '' }),
        $.var.new({ name: 'textarea' }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.textarea($el.textarea({
              id: this.inputID(),
              oninput: e => {
                this.value(e.target.value, false);
              },
              onload: e => {
                e.target.value = this.value();
                setTimeout(() => {
                  e.target.scrollTop = e.target.scrollHeight;
                }, 0);
              },
              placeholder: this.placeholder(),
            }, this.value()));
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return this.textarea();
          }
        }),
        $.method.new({
          name: 'inputID',
          do: function inputID() {
            return `input-${this.name()}`;
          }
        }),
        $.method.new({
          name: 'active',
          do: function active() {
            return document.getElementById(this.inputID()) === document.activeElement;
          }
        }),
        $.method.new({
          name: 'placeholder',
          do: function placeholder() {
            return `${this.name()}...`;
          }
        }),
        $.method.new({
          name: 'blur',
          do: function blur() {
            document.getElementById(this.inputID()).blur();
          }
        }),
      ]
    });

    $.class.new({
      name: 'completor',
      slots: [
        $.window,
        $.application,
        $.var.new({ name: 'completion_candidates' }),
        $.var.new({ name: 'prompt_format' }),
        $.var.new({
          name: 'instruction',
          default: () => $.input.new({ name: 'instruction', parent: this })
        }),
        $.var.new({
          name: 'system',
          default: () => $.input.new({ name: 'system', parent: this })
        }),
        $.var.new({ name: 'output', default: '' }),
        $.var.new({ name: 'preview', default: '' }),
        $.var.new({ name: 'count', default: 3 }),
        $.var.new({ name: 'temperature', default: 0.5 }),
        $.var.new({ name: 'n_predict', default: 8 }),
        $.var.new({ name: 'choices', default: [] }),
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
            this.prompt_format($.chatml_model.new());

            document.addEventListener('keydown', e => {
              if (!(this.instruction().active() || this.system().active())) {
                const cmd = this.key_command(e.key, e);
                cmd?.dispatchTo(this);
              } else {
                if (e.key === 'Escape') {
                  this.dispatchEvent({
                    type: 'command',
                    target: $.completor_unfocus_command.new({ target: this }),
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
              return $.completor_fetch_next_command.new({ target: this });
            } else if (key === '[') {
              return $.completor_set_n_predict_command.new({ target: this, value: this.n_predict() - 1 });
            } else if (key === ']') {
              return $.completor_set_n_predict_command.new({ target: this, value: this.n_predict() + 1 });
            } else if (key === '<') {
              return $.completor_set_temperature_command.new({ target: this, value: this.temperature() - 1 });
            } else if (key === '>') {
              return $.completor_set_temperature_command.new({ target: this, value: this.temperature() + 1 });
            } else if (key === ',') {
              return $.completor_set_count_command.new({ target: this, value: this.count() - 1 });
            } else if (key === '.') {
              return $.completor_set_count_command.new({ target: this, value: this.count() + 1 });
            } else if (key === 'c') {
              return $.completor_clear_command.new({ target: this });
            } else if (['1', '2', '3', '4'].includes(key)) {
              const text = this.completion_candidates().candidates()[+key - 1];
              if (text !== undefined) {
                return $.completor_insert_command.new({ target: this, text });
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
          name: 'insert',
          do: function insert(it) {
            this.choices().push(it);
            this.output(this.output() + it);
          }
        }),
        $.method.new({
          name: 'clear',
          do: function clear() {
            this.output('');
            if (this.instruction().value() !== '') {
              this.fetch_next();
            }
          }
        }),
        $.method.new({
          name: 'fetch_next',
          do: function fetch_next() {
            return $.completor_fetch_next_command.new({ target: this, parent: this }).run();
          }
        }),
        $.method.new({
          name: 'prompt',
          do: function prompt() {
            return this.prompt_format().prompt(this.instruction().value(), this.output());
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            return $el.div({}, [
              this.system(),
              this.instruction(),
              $.number_input.new({
                name: 'count',
                parent: this,
                command: $.completor_set_count_command,
              }).render(),
              $.number_input.new({
                name: 'temperature',
                parent: this,
                command: $.completor_set_temperature_command,
              }).render(),
              $.number_input.new({
                name: 'n_predict',
                parent: this,
                command: $.completor_set_n_predict_command,
              }).render(),
              $.completor_fetch_next_link.new({ object: this, parent: this }),
              ' ',
              $.completor_clear_link.new({ object: this, parent: this }),
              this.completion_candidates(),
              $el.span({
                class: 'completor-output',
                // oncontextmenu: e => {
                //   this.log('right click?');
                //   e.preventDefault();
                // }
              }, this.output()),
              $el.span({ class: 'completor-output completor-preview' }, this.preview()),
            ]);
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
`;
          }
        }),
      ]
    });

    document.body.appendChild($.completor.new().to_dom());
  }
}).load();
