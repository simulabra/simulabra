import { __, base } from 'simulabra';
import test from 'simulabra/test';
import provider, { toOpenAI, fromOpenAI, toOpenAITools, toOpenAIMessages } from '../src/provider.js';

export default await async function (_, $, $test, $provider) {
  $test.Case.new({
    name: 'ToOpenAITools',
    doc: 'Anthropic tool defs translate to OpenAI function format',
    do() {
      const anthropicTools = [
        {
          name: 'create_task',
          description: 'Create a task',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              priority: { type: 'number' },
            },
            required: ['title'],
          },
        }
      ];

      const result = toOpenAITools(anthropicTools);

      this.assertEq(result.length, 1, 'one tool');
      this.assertEq(result[0].type, 'function', 'type is function');
      this.assertEq(result[0].function.name, 'create_task', 'name preserved');
      this.assertEq(result[0].function.description, 'Create a task', 'description preserved');
      this.assertEq(result[0].function.parameters.type, 'object', 'schema preserved');
      this.assertEq(result[0].function.parameters.required[0], 'title', 'required preserved');
    }
  });

  $test.Case.new({
    name: 'ToOpenAIToolsEmpty',
    doc: 'Empty or missing tools returns undefined',
    do() {
      this.assertEq(toOpenAITools(null), undefined);
      this.assertEq(toOpenAITools([]), undefined);
    }
  });

  $test.Case.new({
    name: 'ToOpenAISystemPrompt',
    doc: 'System string becomes a system message at the start',
    do() {
      const result = toOpenAI({
        model: 'test-model',
        max_tokens: 100,
        system: 'you are helpful',
        messages: [{ role: 'user', content: 'hello' }],
      });

      this.assertEq(result.messages[0].role, 'system');
      this.assertEq(result.messages[0].content, 'you are helpful');
      this.assertEq(result.messages[1].role, 'user');
      this.assertEq(result.messages[1].content, 'hello');
      this.assertEq(result.model, 'test-model');
      this.assertEq(result.max_tokens, 100);
    }
  });

  $test.Case.new({
    name: 'ToOpenAINoSystem',
    doc: 'No system prompt means no system message',
    do() {
      const result = toOpenAI({
        model: 'test',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
      });

      this.assertEq(result.messages.length, 1);
      this.assertEq(result.messages[0].role, 'user');
    }
  });

  $test.Case.new({
    name: 'ToOpenAIToolUseMessages',
    doc: 'Assistant tool_use blocks become OpenAI tool_calls field',
    do() {
      const messages = [
        { role: 'user', content: 'make a task' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Creating task.' },
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'create_task',
              input: { title: 'test task', priority: 3 },
            },
          ],
        },
      ];

      const result = toOpenAIMessages(null, messages);

      this.assertEq(result.length, 2);
      const assistant = result[1];
      this.assertEq(assistant.role, 'assistant');
      this.assertEq(assistant.content, 'Creating task.');
      this.assertEq(assistant.tool_calls.length, 1);
      this.assertEq(assistant.tool_calls[0].id, 'toolu_123');
      this.assertEq(assistant.tool_calls[0].type, 'function');
      this.assertEq(assistant.tool_calls[0].function.name, 'create_task');
      this.assertEq(
        assistant.tool_calls[0].function.arguments,
        JSON.stringify({ title: 'test task', priority: 3 })
      );
    }
  });

  $test.Case.new({
    name: 'ToOpenAIToolResultMessages',
    doc: 'User tool_result blocks become separate tool messages',
    do() {
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
              content: '{"success": true}',
            },
          ],
        },
      ];

      const result = toOpenAIMessages(null, messages);

      this.assertEq(result.length, 1);
      this.assertEq(result[0].role, 'tool');
      this.assertEq(result[0].tool_call_id, 'toolu_123');
      this.assertEq(result[0].content, '{"success": true}');
    }
  });

  $test.Case.new({
    name: 'ToOpenAIToolOnlyAssistant',
    doc: 'Assistant with only tool_use (no text) sets content to null',
    do() {
      const messages = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_456',
              name: 'list_tasks',
              input: {},
            },
          ],
        },
      ];

      const result = toOpenAIMessages(null, messages);
      const assistant = result[0];
      this.assertEq(assistant.content, null);
      this.assertEq(assistant.tool_calls.length, 1);
    }
  });

  $test.Case.new({
    name: 'FromOpenAITextResponse',
    doc: 'Simple text response translates to Anthropic content blocks',
    do() {
      const openAIResponse = {
        id: 'chatcmpl-abc',
        model: 'moonshotai/kimi-k2.5',
        choices: [{
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      };

      const result = fromOpenAI(openAIResponse);

      this.assertEq(result.role, 'assistant');
      this.assertEq(result.content.length, 1);
      this.assertEq(result.content[0].type, 'text');
      this.assertEq(result.content[0].text, 'Hello!');
      this.assertEq(result.stop_reason, 'end_turn');
      this.assertEq(result.usage.input_tokens, 10);
      this.assertEq(result.usage.output_tokens, 5);
      this.assertEq(result.model, 'moonshotai/kimi-k2.5');
    }
  });

  $test.Case.new({
    name: 'FromOpenAIToolCallResponse',
    doc: 'Tool calls translate to Anthropic tool_use content blocks',
    do() {
      const openAIResponse = {
        id: 'chatcmpl-xyz',
        model: 'test-model',
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_abc',
                type: 'function',
                function: {
                  name: 'create_task',
                  arguments: '{"title":"buy milk","priority":2}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 50, completion_tokens: 20 },
      };

      const result = fromOpenAI(openAIResponse);

      this.assertEq(result.stop_reason, 'tool_use');
      this.assertEq(result.content.length, 1);
      const toolBlock = result.content[0];
      this.assertEq(toolBlock.type, 'tool_use');
      this.assertEq(toolBlock.id, 'call_abc');
      this.assertEq(toolBlock.name, 'create_task');
      this.assertEq(toolBlock.input.title, 'buy milk');
      this.assertEq(toolBlock.input.priority, 2);
    }
  });

  $test.Case.new({
    name: 'FromOpenAITextAndToolCalls',
    doc: 'Mixed text + tool_calls produces both content block types',
    do() {
      const openAIResponse = {
        id: 'chatcmpl-mix',
        model: 'test-model',
        choices: [{
          message: {
            role: 'assistant',
            content: 'Sure, creating that.',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'create_log',
                  arguments: '{"content":"test log"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 30, completion_tokens: 15 },
      };

      const result = fromOpenAI(openAIResponse);

      this.assertEq(result.content.length, 2);
      this.assertEq(result.content[0].type, 'text');
      this.assertEq(result.content[0].text, 'Sure, creating that.');
      this.assertEq(result.content[1].type, 'tool_use');
      this.assertEq(result.content[1].name, 'create_log');
    }
  });

  $test.Case.new({
    name: 'FromOpenAILengthStopReason',
    doc: 'finish_reason length maps to max_tokens stop_reason',
    do() {
      const openAIResponse = {
        id: 'chatcmpl-len',
        model: 'test',
        choices: [{
          message: { role: 'assistant', content: 'truncated...' },
          finish_reason: 'length',
        }],
        usage: { prompt_tokens: 5, completion_tokens: 100 },
      };

      const result = fromOpenAI(openAIResponse);
      this.assertEq(result.stop_reason, 'max_tokens');
    }
  });

  $test.Case.new({
    name: 'FromOpenAIEmptyContent',
    doc: 'Null content with no tool_calls produces empty text block',
    do() {
      const openAIResponse = {
        id: 'chatcmpl-empty',
        model: 'test',
        choices: [{
          message: { role: 'assistant', content: null },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 1, completion_tokens: 0 },
      };

      const result = fromOpenAI(openAIResponse);
      this.assertEq(result.content.length, 1);
      this.assertEq(result.content[0].type, 'text');
      this.assertEq(result.content[0].text, '');
    }
  });

  $test.Case.new({
    name: 'FromOpenAIProviderCost',
    doc: 'Provider-reported cost in usage.cost is passed through',
    do() {
      const openAIResponse = {
        id: 'chatcmpl-cost',
        model: 'moonshotai/kimi-k2.5',
        choices: [{
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, cost: 0.0023 },
      };

      const result = fromOpenAI(openAIResponse);
      this.assertEq(result.usage.cost, 0.0023, 'provider cost passed through');
      this.assertEq(result.usage.input_tokens, 100);
      this.assertEq(result.usage.output_tokens, 50);
    }
  });

  $test.Case.new({
    name: 'FromOpenAINoCost',
    doc: 'Missing usage.cost is null (falls back to model pricing lookup)',
    do() {
      const openAIResponse = {
        id: 'chatcmpl-nocost',
        model: 'test',
        choices: [{
          message: { role: 'assistant', content: 'Hi' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      };

      const result = fromOpenAI(openAIResponse);
      this.assertEq(result.usage.cost, null, 'no provider cost');
    }
  });

  $test.Case.new({
    name: 'FromOpenAIBadArguments',
    doc: 'Malformed JSON in tool arguments gracefully defaults to empty object',
    do() {
      const openAIResponse = {
        id: 'chatcmpl-bad',
        model: 'test',
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_bad',
              type: 'function',
              function: { name: 'search', arguments: '{broken json' },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      };

      const result = fromOpenAI(openAIResponse);
      const toolBlock = result.content[0];
      this.assertEq(toolBlock.type, 'tool_use');
      this.assertEq(Object.keys(toolBlock.input).length, 0, 'bad JSON defaults to empty object');
    }
  });

  $test.Case.new({
    name: 'ProviderAdapterAnthropicInit',
    doc: 'Anthropic provider creates an internal Anthropic client',
    do() {
      const adapter = $provider.ProviderAdapter.new({
        provider: 'anthropic',
        apiKey: 'test-key',
      });
      this.assert(adapter.anthropicClient(), 'should have an Anthropic client');
      this.assert(adapter.messages, 'should have messages interface');
      this.assert(typeof adapter.messages.create === 'function', 'messages.create should be a function');
    }
  });

  $test.Case.new({
    name: 'ProviderAdapterOpenRouterInit',
    doc: 'OpenRouter provider sets correct base URL',
    do() {
      const adapter = $provider.ProviderAdapter.new({
        provider: 'openrouter',
        model: 'moonshotai/kimi-k2.5',
        apiKey: 'or-key',
      });
      this.assertEq(adapter.baseUrl(), 'https://openrouter.ai/api/v1');
      this.assertEq(adapter.anthropicClient(), undefined);
      this.assert(adapter.messages, 'should have messages interface');
    }
  });

  $test.Case.new({
    name: 'ProviderAdapterCustomURL',
    doc: 'Unknown provider string is treated as a base URL',
    do() {
      const adapter = $provider.ProviderAdapter.new({
        provider: 'http://localhost:8080/v1',
        apiKey: 'local-key',
      });
      this.assertEq(adapter.baseUrl(), 'http://localhost:8080/v1');
    }
  });

  $test.Case.new({
    name: 'RoundtripToolConversation',
    doc: 'Full Anthropic → OpenAI → Anthropic roundtrip preserves structure',
    do() {
      const anthropicRequest = {
        model: 'test-model',
        max_tokens: 1024,
        system: 'you are helpful',
        tools: [{
          name: 'create_task',
          description: 'Create a task',
          input_schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
        }],
        messages: [
          { role: 'user', content: 'make a task called test' },
          {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'toolu_1', name: 'create_task', input: { title: 'test' } },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 'toolu_1', content: '{"success":true}' },
            ],
          },
        ],
      };

      const openAI = toOpenAI(anthropicRequest);

      this.assertEq(openAI.messages[0].role, 'system');
      this.assertEq(openAI.messages[1].role, 'user');
      this.assertEq(openAI.messages[2].role, 'assistant');
      this.assert(openAI.messages[2].tool_calls, 'assistant has tool_calls');
      this.assertEq(openAI.messages[3].role, 'tool');
      this.assertEq(openAI.messages[3].tool_call_id, 'toolu_1');
      this.assertEq(openAI.tools[0].type, 'function');
      this.assertEq(openAI.tools[0].function.parameters.type, 'object');
    }
  });

  $test.Case.new({
    name: 'ProviderConfigFromEnv',
    doc: 'ProviderConfig.fromEnv reads env vars correctly',
    do() {
      const origProvider = process.env.AGENDA_PROVIDER;
      const origModel = process.env.AGENDA_MODEL;
      const origKey = process.env.AGENDA_PROVIDER_KEY;

      try {
        process.env.AGENDA_PROVIDER = 'openrouter';
        process.env.AGENDA_MODEL = 'moonshotai/kimi-k2.5';
        process.env.AGENDA_PROVIDER_KEY = 'test-or-key';

        const adapter = $provider.ProviderConfig.new().fromEnv();

        this.assertEq(adapter.provider(), 'openrouter');
        this.assertEq(adapter.model(), 'moonshotai/kimi-k2.5');
        this.assertEq(adapter.apiKey(), 'test-or-key');
        this.assertEq(adapter.baseUrl(), 'https://openrouter.ai/api/v1');
      } finally {
        if (origProvider !== undefined) process.env.AGENDA_PROVIDER = origProvider;
        else delete process.env.AGENDA_PROVIDER;
        if (origModel !== undefined) process.env.AGENDA_MODEL = origModel;
        else delete process.env.AGENDA_MODEL;
        if (origKey !== undefined) process.env.AGENDA_PROVIDER_KEY = origKey;
        else delete process.env.AGENDA_PROVIDER_KEY;
      }
    }
  });
}.module({
  name: 'test.provider',
  imports: [base, test, provider],
}).load();
