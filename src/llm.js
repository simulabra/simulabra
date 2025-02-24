import base from './base.js';

export default await function (_, $) {
  const __ = globalThis.SIMULABRA;

  $.Class.new({
    name: 'pyserver',
    slots: [
      $.Var.new({ name: 'serverUrl', default: 'http://100.64.172.3:3032' }),
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
          const res = await fetch(`${this.serverUrl()}/completion`, {
            method: 'POST',
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
          return $.PyserverCompletionResults.new(json);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'CompletionResults',
    slots: [
      $.Var.new({
        name: 'content',
        doc: 'the tokens sampled from the completion',
      }),
      $.Var.new({
        name: 'probs',
        doc: 'the logprobs of the tokens',
      }),
    ]
  });

  $.Class.new({
    name: 'PyserverCompletionResults',
    slots: [
      $.Var.new({ name: 'content' }),
      $.Var.new({ name: 'tops' }),
      $.Var.new({ name: 'tokens' }),
      $.Method.new({
        name: 'sumProb',
        do: function sumProb() {
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

  $.Class.new({
    name: 'LocalLlamaTokenizeCommand',
    slots: [
      $.Command,
      $.Var.new({ name: 'prompt' }),
      $.Var.new({ name: 'serverUrl', default: 'http://100.64.172.3:3731' }),
      $.Method.new({
        name: 'run',
        do: async function run() {
          const res = await fetch(`${this.serverUrl()}/tokenize`, {
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

  $.Class.new({
    name: 'LlamacppCompletionResults',
    slots: [
      $.CompletionResults,
      $.Method.new({
        name: 'sumProb',
        do: function sumProb() {
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

  $.Class.new({
    name: 'LocalLlamaCompletionCommand',
    slots: [
      $.Command,
      $.Var.new({ name: 'prompt' }),
      $.Var.new({ name: 'serverUrl', default: 'http://100.64.172.3:3731' }),
      $.Var.new({ name: 'nPredict', default: 4 }),
      $.Var.new({ name: 'temperature', default: 5.0 }),
      $.Var.new({ name: 'nProbs', default: 0 }),
      $.Var.new({ name: 'logitBias', default: [] }),
      $.Method.new({
        name: 'run',
        do: async function run() {
          const res = await fetch(`${this.serverUrl()}/completion`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt: this.prompt(),
              temperature: 0.3,
              // frequency_penalty: 0.5,
              min_p: 0.1,
              cache_prompt: true,
              n_probs: this.nProbs(),
              n_predict: this.nPredict(),
              logit_bias: this.logitBias(),
              stop: ['<|im_end|>', '</s>'],
            })
          });

          let t = await res.json();
          const completion = $.LlamacppCompletionResults.new({
            content: t.content,
            probs: t.completion_probabilities ?? []
          });
          return completion;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'LocalLlamaTokenizeCommand',
    slots: [
      $.Command,
      $.Var.new({ name: 'prompt' }),
      $.Var.new({ name: 'serverUrl', default: 'http://100.64.172.3:3731' }),
      $.Method.new({
        name: 'run',
        do: async function run() {
          const res = await fetch(`${this.serverUrl()}/tokenize`, {
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

  $.Class.new({
    name: 'BaseModel',
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

  $.Class.new({
    name: 'ChatMLModel',
    slots: [
      $.BaseModel,
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

  $.Class.new({
    name: 'MistralModel',
    slots: [
      $.BaseModel,
      $.Method.new({
        name: 'prompt',
        do: function prompt(user, output) {
          return `[INST]${user}[\INST]${output}`;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'AlpacaModel',
    slots: [
      $.BaseModel,
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

}.module({
  name: 'LLM',
  imports: [base],
}).load();
