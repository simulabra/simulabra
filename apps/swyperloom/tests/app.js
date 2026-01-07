import { __, base } from 'simulabra';
import test from 'simulabra/test';
import llm from 'simulabra/llm';

export default await async function (_, $, $test, $llm) {
  $test.Case.new({
    name: 'LogprobParserNormalize',
    doc: 'Verifies logprob normalization works correctly',
    do() {
      const logprobs = [
        { token: 'hello', logprob: -0.5 },
        { token: 'world', logprob: -1.0 },
        { token: 'test', logprob: -2.0 },
      ];

      const normalized = $llm.LogprobParser.normalize(logprobs);

      this.assertEq(normalized.length, 3, 'Should have 3 entries');
      this.assert(normalized[0].probability() >= normalized[1].probability(), 'Should be sorted descending');
    }
  });

  $test.Case.new({
    name: 'LLMClientCreation',
    doc: 'Verifies LLM client can be created with config',
    do() {
      const client = $llm.LLMClient.new({
        baseURL: 'http://localhost:3731',
        model: 'test-model',
        logprobs: 20,
        baseTemperature: 0.8,
      });

      this.assertEq(client.baseURL(), 'http://localhost:3731');
      this.assertEq(client.logprobs(), 20);
      this.assertEq(client.baseTemperature(), 0.8);
    }
  });

  $test.Case.new({
    name: 'CompletionConfigJSON',
    doc: 'Verifies completion config produces correct JSON',
    do() {
      const config = $llm.CompletionConfig.new({
        max_tokens: 15,
        delta_temp: 0.1,
      });

      const json = config.json(0.8);

      this.assertEq(json.max_tokens, 15);
      this.assertEq(json.temperature, 0.9);
    }
  });

  $test.BrowserCase.new({
    name: 'SwypeLoomPageLoads',
    doc: 'Verifies the SwypeLoom app loads with expected elements',
    isMobile: true,
    async do() {
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          const url = new URL(req.url);
          const path = url.pathname;
          const file = Bun.file(process.cwd() + path);
          if (await file.exists()) {
            return new Response(file);
          }
          console.error('Not found:', path);
          return new Response('Not found', { status: 404 });
        }
      });
      try {
        const url = `http://localhost:${server.port}/apps/swyperloom/index.html`;
        const errors = [];
        this.page().on('pageerror', err => errors.push(err.message));
        this.page().on('console', msg => {
          if (msg.type() === 'error') errors.push(msg.text());
        });
        await this.page().goto(url, { waitUntil: 'networkidle' });
        if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });
        await this.page().waitForSelector('.top-bar', { timeout: 1000 });
        await this.page().waitForSelector('.text-display', { timeout: 1000 });
        await this.page().waitForSelector('.text-content', { timeout: 1000 });
        await this.page().waitForSelector('.logprobs-bar', { timeout: 1000 });
        await this.page().waitForSelector('.swyper', { timeout: 1000 });
        await this.page().waitForSelector('.swype-choice', { timeout: 1000 });
        await this.page().waitForSelector('.bottom-bar', { timeout: 1000 });
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'SwypeLoomEditModalOpens',
    doc: 'Verifies clicking text opens edit modal',
    isMobile: true,
    async do() {
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          const url = new URL(req.url);
          const path = url.pathname;
          const file = Bun.file(process.cwd() + path);
          if (await file.exists()) {
            return new Response(file);
          }
          return new Response('Not found', { status: 404 });
        }
      });
      try {
        const url = `http://localhost:${server.port}/apps/swyperloom/index.html`;
        await this.page().goto(url, { waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        await this.page().click('.text-content');
        await this.page().waitForSelector('.edit-modal:not([hidden])', { timeout: 1000 });

        const textarea = await this.page().$('.edit-textarea');
        this.assert(textarea !== null, 'Edit textarea should be visible');
      } finally {
        server.stop();
      }
    }
  });

}.module({
  name: 'test.swyperloom.app',
  imports: [base, test, llm],
}).load();
