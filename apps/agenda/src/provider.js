import { __, base } from 'simulabra';
import Anthropic from '@anthropic-ai/sdk';

function toOpenAITools(tools) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

function toOpenAIMessages(system, messages) {
  const out = [];
  if (system) {
    out.push({ role: 'system', content: system });
  }
  for (const msg of messages) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        out.push({ role: 'user', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const textParts = [];
        for (const block of msg.content) {
          if (block.type === 'text' || typeof block === 'string') {
            textParts.push(typeof block === 'string' ? block : block.text);
          } else if (block.type === 'tool_result') {
            out.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
            });
          }
        }
        if (textParts.length > 0) {
          out.push({ role: 'user', content: textParts.join('\n') });
        }
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        out.push({ role: 'assistant', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const textParts = [];
        const toolCalls = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            textParts.push(block.text);
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            });
          }
        }
        const assistantMsg = { role: 'assistant' };
        if (textParts.length > 0) {
          assistantMsg.content = textParts.join('\n');
        } else {
          assistantMsg.content = null;
        }
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls;
        }
        out.push(assistantMsg);
      }
    }
  }
  return out;
}

function toOpenAI(params) {
  const { system, messages, tools, model, max_tokens, temperature, ...rest } = params;
  const result = {
    model,
    max_tokens,
    messages: toOpenAIMessages(system, messages),
  };
  const openAITools = toOpenAITools(tools);
  if (openAITools) {
    result.tools = openAITools;
  }
  if (temperature !== undefined) {
    result.temperature = temperature;
  }
  return result;
}

function fromOpenAI(response) {
  const choice = response.choices?.[0];
  if (!choice) {
    throw new Error('No choices in OpenAI response');
  }

  const content = [];
  const msg = choice.message;

  if (msg.content) {
    content.push({ type: 'text', text: msg.content });
  }

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      let input;
      try {
        input = JSON.parse(tc.function.arguments);
      } catch {
        input = {};
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input,
      });
    }
  }

  if (content.length === 0) {
    content.push({ type: 'text', text: '' });
  }

  let stopReason;
  if (choice.finish_reason === 'tool_calls') {
    stopReason = 'tool_use';
  } else if (choice.finish_reason === 'length') {
    stopReason = 'max_tokens';
  } else {
    stopReason = 'end_turn';
  }

  const usage = response.usage ? {
    input_tokens: response.usage.prompt_tokens || 0,
    output_tokens: response.usage.completion_tokens || 0,
    cost: response.usage.cost ?? null,
  } : { input_tokens: 0, output_tokens: 0, cost: null };

  return {
    id: response.id || 'msg_openai',
    type: 'message',
    role: 'assistant',
    content,
    model: response.model || '',
    stop_reason: stopReason,
    usage,
  };
}

export { toOpenAI, fromOpenAI, toOpenAIMessages, toOpenAITools };

const PROVIDER_URLS = {
  openrouter: 'https://openrouter.ai/api/v1',
};

export default await async function (_, $) {
  $.Class.new({
    name: 'ProviderAdapter',
    doc: 'Adapter presenting Anthropic SDK interface over OpenAI-compatible APIs',
    slots: [
      $.Var.new({
        name: 'provider',
        doc: 'anthropic, openrouter, or a base URL',
        default: 'anthropic',
      }),
      $.Var.new({
        name: 'model',
        default: 'claude-sonnet-4-20250514',
      }),
      $.Var.new({
        name: 'apiKey',
      }),
      $.Var.new({
        name: 'baseUrl',
        doc: 'computed from provider or set directly',
      }),
      $.Var.new({
        name: 'anthropicClient',
        doc: 'real Anthropic SDK instance when provider is anthropic',
      }),

      $.After.new({
        name: 'init',
        do() {
          if (this.provider() === 'anthropic') {
            this.anthropicClient(new Anthropic({ apiKey: this.apiKey() }));
          } else if (!this.baseUrl()) {
            const url = PROVIDER_URLS[this.provider()];
            if (url) {
              this.baseUrl(url);
            } else {
              this.baseUrl(this.provider());
            }
          }

          const self = this;
          Object.defineProperty(this, 'messages', {
            value: {
              create(params) {
                return self.create(params);
              }
            },
            enumerable: true,
          });
        }
      }),

      $.Method.new({
        name: 'create',
        doc: 'Anthropic-compatible messages.create — delegates or translates',
        async do(params) {
          if (this.provider() === 'anthropic') {
            return this.anthropicClient().messages.create(params);
          }

          const openAIParams = toOpenAI(params);
          const url = `${this.baseUrl()}/chat/completions`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey()}`,
            },
            body: JSON.stringify(openAIParams),
          });

          if (!response.ok) {
            const body = await response.text();
            throw new Error(`Provider API error ${response.status}: ${body}`);
          }

          const json = await response.json();
          return fromOpenAI(json);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ProviderConfig',
    doc: 'Reads provider configuration from environment variables',
    slots: [
      $.Method.new({
        name: 'fromEnv',
        doc: 'create a ProviderAdapter from environment variables',
        do() {
          const provider = process.env.AGENDA_PROVIDER || 'anthropic';
          const model = process.env.AGENDA_MODEL || 'claude-sonnet-4-20250514';
          const apiKey = process.env.AGENDA_PROVIDER_KEY
            || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : null)
            || process.env.AGENDA_CLAUDE_KEY
            || process.env.ANTHROPIC_API_KEY;

          return _.ProviderAdapter.new({ provider, model, apiKey });
        }
      }),
    ]
  });
}.module({
  name: 'provider',
  imports: [base],
}).load();
