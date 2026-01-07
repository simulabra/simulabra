import { __, base } from "./base.js";

export default await async function (_, $) {

  $.Class.new({
    name: "LogprobEntry",
    doc: "normalized logprob token with probability",
    slots: [
      $.Var.new({ name: "token" }),
      $.Var.new({ name: "logprob" }),
      $.Method.new({
        name: "probability",
        do() {
          return Math.exp(this.logprob());
        }
      })
    ]
  });

  $.Class.new({
    name: "LogprobParser",
    doc: "static utility for parsing different API logprob response formats",
    slots: [
      $.Static.new({
        name: "parse",
        doc: "parse logprobs from various API response formats",
        do(res) {
          if (!res.choices) {
            if (res.completion_probabilities?.[0]?.top_logprobs) {
              return res.completion_probabilities[0].top_logprobs;
            }
            return null;
          }

          const lp = res.choices[0].logprobs;
          if (!lp) return null;

          if (lp.content && Array.isArray(lp.content) && lp.content[0]?.top_logprobs) {
            return lp.content[0].top_logprobs;
          }

          const tl = lp.top_logprobs;
          if (Array.isArray(tl) && tl.length && tl[0] && typeof tl[0] === "object" && !Array.isArray(tl[0])) {
            return Object.entries(tl[0]).map(([token, logprob]) => ({ token, logprob }));
          }

          if (Array.isArray(lp) && lp.length && lp[0].token && typeof lp[0].logprob === "number") {
            return lp;
          }

          return null;
        }
      }),
      $.Static.new({
        name: "normalize",
        doc: "normalize logprobs to probabilities and sort descending",
        do(logprobs) {
          if (!logprobs || !logprobs.length) return [];

          let total = 0;
          const probs = logprobs.map(lp => {
            const prob = Math.exp(lp.logprob);
            total += prob;
            return { token: lp.token, prob };
          });

          const entries = probs.map(p => _.LogprobEntry.new({
            token: p.token.replace(/Ġ/g, " "),
            logprob: Math.log(p.prob / total)
          }));

          entries.sort((a, b) => b.probability() - a.probability());
          return entries;
        }
      })
    ]
  });

  $.Class.new({
    name: "CompletionConfig",
    doc: "configuration for a completion request",
    slots: [
      $.Clone,
      $.Signal.new({
        name: "max_tokens",
        default: 10,
      }),
      $.Signal.new({
        name: "delta_temp",
        doc: "offset from base temperature",
        default: 0,
      }),
      $.Method.new({
        name: "json",
        doc: "produce config object for API request",
        do(baseTemp) {
          return {
            temperature: baseTemp + this.delta_temp(),
            max_tokens: this.max_tokens(),
          };
        }
      })
    ]
  });

  $.Class.new({
    name: "LLMClient",
    doc: "pure LLM client for OpenAI-compatible APIs",
    slots: [
      $.Configurable,
      $.ConfigSignal.new({
        name: "apiKey",
        doc: "API credential",
      }),
      $.ConfigSignal.new({
        name: "baseURL",
        doc: "base URL of the OpenAI-compatible API",
        default: "https://api.openai.com",
      }),
      $.ConfigSignal.new({
        name: "model",
        doc: "model to use for completions",
        default: "davinci-002",
      }),
      $.ConfigSignal.new({
        name: "logprobs",
        doc: "number of log probabilities to return",
        default: 20,
      }),
      $.ConfigSignal.new({
        name: "baseTemperature",
        doc: "base temperature for generation",
        default: 0.8,
      }),
      $.ConfigSignal.new({
        name: "sequential",
        doc: "run threads sequentially instead of in parallel",
        default: false,
      }),
      $.Signal.new({
        name: "imageData",
        doc: "base64-encoded image data for multimodal prompts",
        default: null,
      }),
      $.Signal.new({
        name: "imageMode",
        doc: "whether image mode is enabled (controls upload visibility)",
        default: false,
      }),
      $.Method.new({
        name: "id",
        do() {
          return `${this.baseURL()}(${this.model()})`;
        }
      }),
      $.Method.new({
        name: "transformRequest",
        doc: "add model and authorization to request",
        do(body, headers) {
          if (this.model()) {
            body.model = this.model();
          }
          if (this.apiKey()) {
            headers.Authorization = `Bearer ${this.apiKey()}`;
          }
        }
      }),
      $.Method.new({
        name: "completion",
        doc: "make a completion request to the API",
        async: true,
        do: async function(prompt, config = {}) {
          const headers = {
            "Content-Type": "application/json",
          };
          let endpoint, body;

          if (this.imageMode()) {
            endpoint = `${this.baseURL()}/completion`;
            const promptObj = { prompt_string: `<__media__>\n\n${prompt}` };
            if (this.imageData()) {
              promptObj.multimodal_data = [this.imageData()];
            }
            body = {
              prompt: promptObj,
              logprobs: this.logprobs(),
              ...config
            };
          } else {
            endpoint = `${this.baseURL()}/v1/completions`;
            body = {
              prompt,
              logprobs: this.logprobs(),
              ...config
            };
            this.transformRequest(body, headers);
          }

          const res = await fetch(endpoint, {
            method: "POST",
            body: JSON.stringify(body),
            headers,
          });

          if (!res.ok) {
            const errorBody = await res.text();
            let errorMsg;
            try {
              const errorJson = JSON.parse(errorBody);
              errorMsg = errorJson.error?.message || errorJson.message || errorBody;
            } catch {
              errorMsg = errorBody;
            }
            throw new Error(`API ${res.status}: ${errorMsg}`);
          }

          const json = await res.json();
          const text = this.imageMode() ? json.content : json.choices[0].text;
          const logprobs = _.LogprobParser.parse(json);

          return { text, logprobs };
        }
      }),
      $.Method.new({
        name: "setImageData",
        doc: "set base64-encoded image data",
        do(base64) {
          this.imageData(base64);
        }
      }),
      $.Method.new({
        name: "clearImageData",
        doc: "clear image data",
        do() {
          this.imageData(null);
        }
      })
    ]
  });

}.module({
  name: "llm",
  imports: [base],
}).load();
