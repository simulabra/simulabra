import base from './base.js';

export default await base.find('class', 'module').new({
  name: 'llm',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    $.class.new({
      name: 'llamacpp_completion_results',
      slots: [
        $.var.new({ name: 'output', default: '' }),
        $.var.new({ name: 'probs', default: () => [] }),
        $.method.new({
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
        $.var.new({ name: 'prompt' }),
        $.var.new({ name: 'server_url', default: 'http://100.64.172.3:3731' }),
        $.var.new({ name: 'n_predict', default: 4 }),
        $.var.new({ name: 'temperature', default: 5.0 }),
        $.var.new({ name: 'top_k', default: 200 }),
        $.var.new({ name: 'top_p', default: 1.00 }),
        $.var.new({ name: 'n_probs', default: 0 }),
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
                microstat: 2,
                // this seems to be breaking sampling with such a big number!!
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
        $.var.new({ name: 'prompt' }),
        $.var.new({ name: 'server_url', default: 'http://100.64.172.3:3731' }),
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

  }
}).load();
