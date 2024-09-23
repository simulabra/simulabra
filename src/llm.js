import base from './base.js';

export default await base.find('class', 'module').new({
  name: 'llm',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.class.new({
      name: 'pyserver',
      slots: [
        $.Var.new({ name: 'server_url', default: 'http://100.64.172.3:3032' }),
        $.Method.new({
          name: 'completion',
          do: async function completion({
            prompt,
            n_predict = 4,
            temperature = 0.6,
            min_p = 0.05,
            n_probs = 10,
            logit_bias = [],
            stop = ['</s>', '<eos>'],
            control = 5,
          }) {
            const res = await fetch(`${this.server_url()}/completion`, {
              Method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                prompt,
                temperature,
                min_p,
                n_probs,
                n_predict,
                stop,
                control,
              })
            });
            const json = await res.json();
            return $.pyserver_completion_results.new(json);
          }
        }),
      ]
    });

    $.class.new({
      name: 'pyserver_completion_results',
      slots: [
        $.Var.new({ name: 'content' }),
        $.Var.new({ name: 'tops' }),
        $.Var.new({ name: 'tokens' }),
        $.Method.new({
          name: 'sum_prob',
          do: function sum_prob() {
            let sum = 0.0;
            for (const p of this.probs()) {
              const tok = p.content;
              const prob = p.probs.find(pp => pp.tok_str === tok);
              if (prob) {
                sum += prob.prob;
              }
            }
            return sum;
          }
        })
      ]
    });

    $.class.new({
      name: 'local_llama_tokenize_command',
      slots: [
        $.command,
        $.Var.new({ name: 'prompt' }),
        $.Var.new({ name: 'server_url', default: 'http://100.64.172.3:3731' }),
        $.Method.new({
          name: 'run',
          do: async function run() {
            const res = await fetch(`${this.server_url()}/tokenize`, {
              Method: 'POST',
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
      name: 'llamacpp_completion_results',
      slots: [
        $.Var.new({ name: 'output', default: '' }),
        $.Var.new({ name: 'probs', default: () => [] }),
        $.Method.new({
          name: 'sum_prob',
          do: function sum_prob() {
            let sum = 0.0;
            for (const p of this.probs()) {
              const tok = p.content;
              const prob = p.probs.find(pp => pp.tok_str === tok);
              if (prob) {
                sum += prob.prob;
              }
            }
            return sum;
          }
        })
      ]
    });

    $.class.new({
      name: 'local_llama_completion_command',
      slots: [
        $.command,
        $.Var.new({ name: 'prompt' }),
        $.Var.new({ name: 'server_url', default: 'http://100.64.172.3:3731' }),
        $.Var.new({ name: 'n_predict', default: 4 }),
        $.Var.new({ name: 'temperature', default: 5.0 }),
        $.Var.new({ name: 'top_k', default: 200 }),
        $.Var.new({ name: 'top_p', default: 1.00 }),
        $.Var.new({ name: 'n_probs', default: 0 }),
        $.Var.new({ name: 'logit_bias', default: [] }),
        $.Method.new({
          name: 'run',
          do: async function run() {
            const res = await fetch(`${this.server_url()}/completion`, {
              Method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                prompt: this.prompt(),
                temperature: 0.3,
                // frequency_penalty: 0.5,
                min_p: 0.1,
                cache_prompt: true,
                n_probs: this.n_probs(),
                n_predict: this.n_predict(),
                logit_bias: this.logit_bias(),
                stop: ['<|im_end|>', '</s>'],
              })
            });

            let t = await res.json();
            const completion = $.llamacpp_completion_results.new({
              output: t.content,
              probs: t.completion_probabilities ?? []
            });
            return completion;
          }
        }),
      ]
    });

    $.class.new({
      name: 'local_llama_tokenize_command',
      slots: [
        $.command,
        $.Var.new({ name: 'prompt' }),
        $.Var.new({ name: 'server_url', default: 'http://100.64.172.3:3731' }),
        $.Method.new({
          name: 'run',
          do: async function run() {
            const res = await fetch(`${this.server_url()}/tokenize`, {
              Method: 'POST',
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
      name: 'base_model',
      slots: [
        $.Method.new({
          name: 'system',
          do: function system() {
            return 'You are an intelligent assistant.';
          }
        }),
        $.Method.new({
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
        $.Var.new({ name: 'system', default: 'You are an intelligent assistant.', }),
        $.Method.new({
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
        $.Method.new({
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
        $.Method.new({
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

  }
}).load();
