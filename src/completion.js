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
        $.var.new({ name: 'temperature', default: 0.7 }),
        $.var.new({ name: 'top_k', default: 200 }),
        $.var.new({ name: 'top_p', default: 0.95 }),
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
      name: 'cmd_prompt',
      slots: [
        $.var.new({ name: 'prompt', default: 'Simulabra was passed no prompt because' }),
        $.var.new({ name: 'count_tokens', default: false }),
        $.method.new({
          name: 'execute',
          do: async function execute() {
            for (let j = 0; j < 5; j++) {
              let res = '';
              let logit_bias = [];
              const start = +new Date();
              for (let i = 0; i < 10; i++) {
                const result = await ($.local_llama_completion_command.new({
                  server_url: "http://localhost:3731",
                  prompt: this.prompt() + res,
                  n_predict: 1,
                  logit_bias: logit_bias
                })).run();
                res += result;
                if (this.count_tokens()) {
                  const tokens = await ($.local_llama_tokenize_command.new({
                    server_url: "http://localhost:3731",
                    prompt: res
                  })).run();
                  this.log(`(${tokens.length} toks in ${completion_ms}ms)`, this.prompt());
                }
              }
              const tokens = await ($.local_llama_tokenize_command.new({
                server_url: "http://localhost:3731",
                prompt: res
              })).run();
              for (const tok of tokens) {
                const logit = logit_bias.find(l => l[0] === tok);
                if (logit) {
                  logit[1] -= 1.0;
                } else {
                  logit_bias.push([tok, -1.0]);
                }
              }
              const completion_ms = +new Date() - start;
              this.log(`(${completion_ms}ms)`, res);
            }
            process.exit(0);
          }
        }),
      ]
    });

    if (window.process && process?.argv[1].indexOf('completion.js') >= 0) {
      const cmd = $.cmd_prompt.new({ prompt: process.argv[2] });
      cmd.execute();
    }

    let completor_fetch_next_lock = null;
    $.class.new({
      name: 'completor_fetch_next_command',
      slots: [
        $.command,
        $.var.new({ name: 'target' }),
        $.var.new({ name: 'count' }),
        $.var.new({ name: 'n_predict' }),
        $.var.new({ name: 'server_host', default: "100.64.172.3" }),
        $.method.new({
          name: 'acquire_lock',
          do: function acquire_lock() {
            if (completor_fetch_next_lock === null) {
              let resolveLock;
              completor_fetch_next_lock = new Promise(resolve => resolveLock = resolve);

              return async () => {
                resolveLock();
                await completor_fetch_next_lock;
                completor_fetch_next_lock = null;
              }
            } else {
              return new Promise(async resolveOuter => {
                await completor_fetch_next_lock;
                resolveOuter(this.acquire_lock());
              });
            }
          }
        }),
        $.method.new({
          name: 'run',
          do: async function run(ctx) {
            const lock = await this.acquire_lock();
            try {
              let completions = [];
              const server_url = `http://${this.server_host()}:3731`;
              this.target().completion_candidates().reset();
              let logit_bias = [];
              let count = this.count() ?? this.target().count();
              let n_predict = this.n_predict() ?? this.target().n_predict();
              let temperature = 0.7;
              for (let i = 0; i < count; i++) {
                const completion = await $.local_llama_completion_command.new({
                  server_url: server_url,
                  prompt: this.target().prompt(),
                  logit_bias: logit_bias,
                  n_predict: n_predict,
                  temperature: temperature
                }).run();

                completions.push(completion);
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
                temperature += 0.2;
              }
            } finally {
              lock();
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
        $.var.new({ name: 'emphasized' }),
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
            this.emphasized(null);
            this.candidates([]);
          }
        }),
      ]
    });

    $.class.new({
      name: 'chatml_model',
      slots: [
        $.var.new({ name: 'system', default: 'You are a smart, creative, and helpful AI assistant.', }),
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
      name: 'completor',
      slots: [
        $.window,
        $.application,
        $.var.new({ name: 'completion_candidates' }),
        $.var.new({ name: 'prompt_format' }),
        $.var.new({ name: 'instruction', default: '' }),
        $.var.new({ name: 'instruction_textarea' }),
        $.var.new({ name: 'output', default: '' }),
        $.var.new({ name: 'preview', default: '' }),
        $.var.new({ name: 'count', default: 4 }),
        $.var.new({ name: 'n_predict', default: 20 }),
        $.var.new({ name: 'choices', default: [] }),
        $.after.new({
          name: 'init',
          do: function init() {
            this.completion_candidates($.completion_candidates.new({ parent: this }));
            this.prompt_format($.chatml_model.new());
            this.instruction_textarea($el.textarea({
              oninput: e => {
                this.log('change', this.instruction(), e.target.value);
                this.instruction(e.target.value, false);
              },
              onload: e => {
                e.target.value = this.instruction();
                setTimeout(() => {
                  e.target.scrollTop = e.target.scrollHeight;
                }, 0);
              },
              placeholder: 'instruction',
            }, this.instruction()));

            document.addEventListener('keydown', e => {
              this.log(e);
            });
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
          name: 'prompt',
          do: function prompt() {
            return this.prompt_format().prompt(this.instruction(), this.output());
          }
        }),
        $.method.new({
          name: 'render',
          do: function render() {
            let self = this;
            return $el.div({}, [
              this.instruction_textarea(),
              'count:',
              $el.input({
                type: 'number', value: this.count(), onchange: e => {
                  this.count(+e.target.value, false);
                  this.log('count', this.count());
                }
              }),
              'n_predict:',
              $el.input({
                type: 'number', value: this.n_predict(), onchange: e => {
                  this.n_predict(+e.target.value, false);
                }
              }),
              $.completor_fetch_next_link.new({ object: this, parent: this }),
              this.completion_candidates(),
              $el.span({ class: 'completor-output' }, this.output()),
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
`;
          }
        }),
      ]
    });

    document.body.appendChild($.completor.new().to_dom());
  }
}).load();
