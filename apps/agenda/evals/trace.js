import { __, base } from 'simulabra';

const MODEL_PRICING = {
  'claude-sonnet-4':   { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  'claude-haiku-4':    { inputPerMTok: 0.80, outputPerMTok: 4.00 },
  'claude-opus-4':     { inputPerMTok: 15.00, outputPerMTok: 75.00 },
};

function lookupPricing(model) {
  for (const [prefix, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(prefix)) return pricing;
  }
  return null;
}

function computeCost(usage, model) {
  const pricing = lookupPricing(model);
  if (!pricing || !usage) return null;
  const inputCost = (usage.input_tokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.outputPerMTok;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

export default await async function (_, $) {
  class TraceCapture {
    constructor(client) {
      this._client = client;
      this.traces = [];
      this.totalInputTokens = 0;
      this.totalOutputTokens = 0;
      this.totalCost = 0;
    }

    get messages() {
      const self = this;
      return {
        async create(params) {
          const start = Date.now();
          const response = await self._client.messages.create(params);
          const usage = response.usage || {};
          const cost = computeCost(usage, response.model || '');

          self.totalInputTokens += usage.input_tokens || 0;
          self.totalOutputTokens += usage.output_tokens || 0;
          if (cost) self.totalCost += cost.totalCost;

          self.traces.push({
            timestamp: new Date().toISOString(),
            request: params,
            response,
            durationMs: Date.now() - start,
            usage: {
              inputTokens: usage.input_tokens || 0,
              outputTokens: usage.output_tokens || 0,
            },
            cost,
          });
          return response;
        }
      };
    }

    costSummary() {
      return {
        totalInputTokens: this.totalInputTokens,
        totalOutputTokens: this.totalOutputTokens,
        totalCost: this.totalCost,
      };
    }
  }

  $.Class.new({
    name: 'TraceCaptureFactory',
    doc: 'Factory for creating TraceCapture instances that wrap real Anthropic clients',
    slots: [
      $.Static.new({
        name: 'create',
        do(client) {
          return new TraceCapture(client);
        }
      }),
    ]
  });
}.module({
  name: 'eval.trace',
  imports: [base],
}).load();
