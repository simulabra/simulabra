import { __, base } from '../src/base.js';
import test from '../src/test.js';
import llm from '../src/llm.js';

export default await async function (_, $, $test, $llm) {

  let originalFetch;
  let capturedRequests;
  let mockResponse;

  function setupFetchMock(response) {
    originalFetch = globalThis.fetch;
    capturedRequests = [];
    mockResponse = response;
    globalThis.fetch = async (url, opts) => {
      capturedRequests.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
      return {
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      };
    };
  }

  function setupFetchError(status, errorMessage) {
    originalFetch = globalThis.fetch;
    capturedRequests = [];
    globalThis.fetch = async (url, opts) => {
      capturedRequests.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
      return {
        ok: false,
        status,
        text: async () => JSON.stringify({ error: { message: errorMessage } }),
      };
    };
  }

  function restoreFetch() {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
      originalFetch = null;
    }
  }

  $test.Case.new({
    name: 'LogprobEntryProbability',
    doc: 'LogprobEntry converts logprob to probability',
    do() {
      const entry = $llm.LogprobEntry.new({ token: 'hello', logprob: Math.log(0.5) });
      const prob = entry.probability();
      this.assert(Math.abs(prob - 0.5) < 0.0001, `Expected ~0.5, got ${prob}`);
    }
  });

  $test.Case.new({
    name: 'LogprobParserOpenAIFormat',
    doc: 'Parses OpenAI-style top_logprobs object format',
    do() {
      const response = {
        choices: [{
          text: 'test',
          logprobs: {
            top_logprobs: [{ 'token1': -0.5, 'token2': -1.2 }]
          }
        }]
      };
      const parsed = $llm.LogprobParser.parse(response);
      this.assertEq(parsed.length, 2, 'Should parse 2 tokens');
      this.assertEq(parsed[0].token, 'token1');
      this.assertEq(parsed[0].logprob, -0.5);
    }
  });

  $test.Case.new({
    name: 'LogprobParserLlamaCppFormat',
    doc: 'Parses llama.cpp server logprobs format',
    do() {
      const response = {
        choices: [{
          logprobs: {
            content: [{
              top_logprobs: [
                { token: 'hello', logprob: -0.3 },
                { token: 'world', logprob: -0.8 }
              ]
            }]
          }
        }]
      };
      const parsed = $llm.LogprobParser.parse(response);
      this.assertEq(parsed.length, 2, 'Should parse 2 tokens');
      this.assertEq(parsed[0].token, 'hello');
    }
  });

  $test.Case.new({
    name: 'LogprobParserMultimodalFormat',
    doc: 'Parses multimodal API completion_probabilities format',
    do() {
      const response = {
        content: 'test output',
        completion_probabilities: [{
          top_logprobs: [
            { token: 'a', logprob: -0.1 },
            { token: 'b', logprob: -0.5 }
          ]
        }]
      };
      const parsed = $llm.LogprobParser.parse(response);
      this.assertEq(parsed.length, 2, 'Should parse 2 tokens');
      this.assertEq(parsed[0].token, 'a');
    }
  });

  $test.Case.new({
    name: 'LogprobParserArrayFormat',
    doc: 'Parses openrouter-style array format',
    do() {
      const response = {
        choices: [{
          text: 'test',
          logprobs: [
            { token: 'the', logprob: -0.2 },
            { token: 'a', logprob: -0.9 }
          ]
        }]
      };
      const parsed = $llm.LogprobParser.parse(response);
      this.assertEq(parsed.length, 2);
      this.assertEq(parsed[0].token, 'the');
    }
  });

  $test.Case.new({
    name: 'LogprobParserNullHandling',
    doc: 'Returns null for missing or invalid logprobs',
    do() {
      this.assertEq($llm.LogprobParser.parse({ choices: [{ text: 'test' }] }), null);
      this.assertEq($llm.LogprobParser.parse({ choices: [{ logprobs: null }] }), null);
    }
  });

  $test.Case.new({
    name: 'LogprobNormalization',
    doc: 'Normalize converts logprobs to probabilities that sum to 1',
    do() {
      const logprobs = [
        { token: 'a', logprob: Math.log(0.7) },
        { token: 'b', logprob: Math.log(0.3) }
      ];
      const normalized = $llm.LogprobParser.normalize(logprobs);
      const sum = normalized.reduce((acc, e) => acc + e.probability(), 0);
      this.assert(Math.abs(sum - 1.0) < 0.001, `Probabilities should sum to 1, got ${sum}`);
    }
  });

  $test.Case.new({
    name: 'LogprobNormalizationSorting',
    doc: 'Normalized logprobs are sorted by probability descending',
    do() {
      const logprobs = [
        { token: 'low', logprob: -2 },
        { token: 'high', logprob: -0.1 },
        { token: 'mid', logprob: -1 }
      ];
      const normalized = $llm.LogprobParser.normalize(logprobs);
      this.assertEq(normalized[0].token(), 'high', 'Highest probability first');
      this.assertEq(normalized[2].token(), 'low', 'Lowest probability last');
    }
  });

  $test.Case.new({
    name: 'LogprobNormalizationTokenReplace',
    doc: 'Ġ markers are replaced with spaces',
    do() {
      const logprobs = [{ token: 'Ġhello', logprob: -0.5 }];
      const normalized = $llm.LogprobParser.normalize(logprobs);
      this.assertEq(normalized[0].token(), ' hello');
    }
  });

  $test.Case.new({
    name: 'CompletionConfigJson',
    doc: 'CompletionConfig generates correct JSON for API request',
    do() {
      const config = $llm.CompletionConfig.new({
        max_tokens: 50,
        delta_temp: 0.2
      });
      const json = config.json(0.8);
      this.assertEq(json.max_tokens, 50);
      this.assertEq(json.temperature, 1.0);
    }
  });

  $test.Case.new({
    name: 'CompletionConfigClone',
    doc: 'CompletionConfig cloning creates independent copy',
    do() {
      const original = $llm.CompletionConfig.new({ max_tokens: 20 });
      const cloned = original.clone();
      cloned.max_tokens(30);
      this.assertEq(original.max_tokens(), 20, 'Original unchanged');
      this.assertEq(cloned.max_tokens(), 30, 'Clone has new value');
    }
  });

  $test.Case.new({
    name: 'LLMClientDefaults',
    doc: 'LLMClient has sensible defaults',
    do() {
      const client = $llm.LLMClient.new();
      this.assertEq(client.baseURL(), 'https://api.openai.com');
      this.assertEq(client.model(), 'davinci-002');
      this.assertEq(client.logprobs(), 20);
      this.assertEq(client.baseTemperature(), 0.8);
      this.assertEq(client.imageMode(), false);
      this.assertEq(client.imageData(), null);
    }
  });

  $test.Case.new({
    name: 'LLMClientId',
    doc: 'LLMClient generates unique id from URL and model',
    do() {
      const client = $llm.LLMClient.new({
        baseURL: 'https://api.example.com',
        model: 'test-model'
      });
      this.assertEq(client.id(), 'https://api.example.com(test-model)');
    }
  });

  $test.AsyncCase.new({
    name: 'LLMClientTextCompletion',
    doc: 'LLMClient makes correct request for text completions',
    async do() {
      setupFetchMock({
        choices: [{ text: 'completed text', logprobs: null }]
      });
      try {
        const client = $llm.LLMClient.new({
          baseURL: 'https://api.test.com',
          model: 'test-model',
          apiKey: 'test-key',
          logprobs: 5
        });
        const result = await client.completion('test prompt', { max_tokens: 10 });

        this.assertEq(capturedRequests.length, 1);
        this.assert(capturedRequests[0].url.includes('/v1/completions'), 'Uses v1/completions endpoint');
        this.assertEq(capturedRequests[0].body.prompt, 'test prompt');
        this.assertEq(capturedRequests[0].body.model, 'test-model');
        this.assertEq(capturedRequests[0].body.logprobs, 5);
        this.assertEq(capturedRequests[0].body.max_tokens, 10);
        this.assertEq(capturedRequests[0].headers.Authorization, 'Bearer test-key');
        this.assertEq(result.text, 'completed text');
      } finally {
        restoreFetch();
      }
    }
  });

  $test.AsyncCase.new({
    name: 'LLMClientImageModeEndpoint',
    doc: 'Image mode uses /completion endpoint',
    async do() {
      setupFetchMock({
        content: 'image described',
        completion_probabilities: []
      });
      try {
        const client = $llm.LLMClient.new({ baseURL: 'https://api.test.com' });
        client.imageMode(true);
        await client.completion('describe this');

        this.assert(capturedRequests[0].url.endsWith('/completion'), 'Uses /completion endpoint');
        this.assert(capturedRequests[0].body.prompt.prompt_string.includes('describe this'));
      } finally {
        restoreFetch();
      }
    }
  });

  $test.AsyncCase.new({
    name: 'LLMClientImageModeWithData',
    doc: 'Image mode with data includes multimodal_data',
    async do() {
      setupFetchMock({
        content: 'image described',
        completion_probabilities: []
      });
      try {
        const client = $llm.LLMClient.new({ baseURL: 'https://api.test.com' });
        client.imageMode(true);
        client.setImageData('base64encodeddata');
        await client.completion('describe this');

        this.assertEq(capturedRequests[0].body.prompt.multimodal_data[0], 'base64encodeddata');
      } finally {
        restoreFetch();
      }
    }
  });

  $test.AsyncCase.new({
    name: 'LLMClientImageModeWithoutData',
    doc: 'Image mode without data omits multimodal_data',
    async do() {
      setupFetchMock({
        content: 'no image',
        completion_probabilities: []
      });
      try {
        const client = $llm.LLMClient.new({ baseURL: 'https://api.test.com' });
        client.imageMode(true);
        await client.completion('test');

        this.assertEq(capturedRequests[0].body.prompt.multimodal_data, undefined);
      } finally {
        restoreFetch();
      }
    }
  });

  $test.AsyncCase.new({
    name: 'LLMClientImageDataManagement',
    doc: 'setImageData and clearImageData work correctly',
    async do() {
      const client = $llm.LLMClient.new();
      this.assertEq(client.imageData(), null);

      client.setImageData('testdata');
      this.assertEq(client.imageData(), 'testdata');

      client.clearImageData();
      this.assertEq(client.imageData(), null);
    }
  });

  $test.AsyncCase.new({
    name: 'LLMClientErrorHandling',
    doc: 'API errors are properly propagated',
    async do() {
      setupFetchError(401, 'Invalid API key');
      try {
        const client = $llm.LLMClient.new({ baseURL: 'https://api.test.com' });
        let caught = null;
        try {
          await client.completion('test');
        } catch (e) {
          caught = e;
        }
        this.assert(caught !== null, 'Should throw error');
        this.assert(caught.message.includes('401'), 'Error includes status');
        this.assert(caught.message.includes('Invalid API key'), 'Error includes message');
      } finally {
        restoreFetch();
      }
    }
  });

  $test.Case.new({
    name: 'LLMClientConfigurable',
    doc: 'LLMClient supports configJSON and configLoad',
    do() {
      const client = $llm.LLMClient.new({
        baseURL: 'https://custom.api.com',
        model: 'custom-model',
        logprobs: 10
      });
      const json = client.configJSON();

      const client2 = $llm.LLMClient.new();
      client2.configLoad(json);

      this.assertEq(client2.baseURL(), 'https://custom.api.com');
      this.assertEq(client2.model(), 'custom-model');
      this.assertEq(client2.logprobs(), 10);
    }
  });

}.module({
  name: 'test.llm',
  imports: [base, test, llm],
}).load();
