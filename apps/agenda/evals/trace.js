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
  $.Class.new({
    name: 'TraceCapture',
    doc: 'Anthropic client wrapper that delegates all calls while recording interactions with cost tracking',
    slots: [
      $.Var.new({ name: 'client', doc: 'the real Anthropic SDK instance' }),
      $.Var.new({ name: 'traces', default: () => [] }),
      $.Var.new({ name: 'totalInputTokens', default: 0 }),
      $.Var.new({ name: 'totalOutputTokens', default: 0 }),
      $.Var.new({ name: 'totalCost', default: 0 }),
      $.After.new({
        name: 'init',
        doc: 'wire up the Anthropic-compatible messages interface',
        do() {
          const self = this;
          Object.defineProperty(this, 'messages', {
            value: {
              async create(params) {
                const start = Date.now();
                const response = await self.client().messages.create(params);
                const usage = response.usage || {};
                const cost = computeCost(usage, response.model || '');

                self.totalInputTokens(self.totalInputTokens() + (usage.input_tokens || 0));
                self.totalOutputTokens(self.totalOutputTokens() + (usage.output_tokens || 0));
                if (cost) self.totalCost(self.totalCost() + cost.totalCost);

                self.traces().push({
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
            },
            enumerable: true,
          });
        }
      }),
      $.Method.new({
        name: 'costSummary',
        doc: 'aggregate cost and token counts across all recorded traces',
        do() {
          return {
            totalInputTokens: this.totalInputTokens(),
            totalOutputTokens: this.totalOutputTokens(),
            totalCost: this.totalCost(),
          };
        }
      }),
    ]
  });
}.module({
  name: 'eval.trace',
  imports: [base],
}).load();
