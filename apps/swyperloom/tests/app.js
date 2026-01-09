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

  function createMockServer(mockChoices = [' alpha', ' beta', ' gamma', ' delta']) {
    return Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/v1/completions') {
          const body = await req.json();
          const idx = Math.min(3, Math.floor((1 - body.temperature) * 10));
          return new Response(JSON.stringify({
            choices: [{
              text: mockChoices[idx % mockChoices.length],
              logprobs: {
                content: [{
                  top_logprobs: [
                    { token: ' the', logprob: -0.3 },
                    { token: ' a', logprob: -0.8 },
                    { token: ' an', logprob: -1.2 }
                  ]
                }]
              }
            }]
          }), { headers: { 'Content-Type': 'application/json' } });
        }
        const file = Bun.file(process.cwd() + url.pathname);
        if (await file.exists()) return new Response(file);
        return new Response('Not found', { status: 404 });
      }
    });
  }

  $test.BrowserCase.new({
    name: 'SwypeLoomMobileViewport',
    doc: 'Verifies app renders correctly in mobile viewport',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`, { waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        const viewport = this.page().viewportSize();
        this.assert(viewport.width <= 450, 'Should have mobile width (<=450)');
        this.assert(viewport.height >= 600, 'Should have reasonable mobile height (>=600)');

        const hasHorizontalScroll = await this.page().evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        this.assert(!hasHorizontalScroll, 'Should not have horizontal scroll');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'SwypeLoomLocalStorageLoad',
    doc: 'Verifies text loads from localStorage on init',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        const savedText = 'Previously saved story text';
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`);
        await this.page().evaluate((text) => {
          localStorage.setItem('SWYPELOOM_TEXT', text);
        }, savedText);

        await this.page().reload({ waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        const displayedText = await this.page().$eval('.main-text', el => el.textContent);
        this.assertEq(displayedText, savedText, 'Should load saved text from localStorage');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'SwypeToCornerSelects',
    doc: 'Swiping to a corner selects that choice and appends text',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`, { waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        await this.page().waitForFunction(() => {
          const choice = document.querySelector('.swype-choice.top-right .choice-text');
          return choice && choice.textContent && choice.textContent !== '...';
        }, { timeout: 5000 });

        const initialText = await this.page().$eval('.main-text', el => el.textContent);

        const swyper = await this.page().$('.swyper');
        const box = await swyper.boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await this.page().mouse.move(cx, cy);
        await this.page().mouse.down();
        await this.page().mouse.move(box.x + box.width - 20, box.y + 20, { steps: 10 });
        await this.page().mouse.up();

        await __.sleep(200);
        const finalText = await this.page().$eval('.main-text', el => el.textContent);
        this.assert(finalText.length > initialText.length, 'Text should grow after swipe selection');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ChoiceClickSelects',
    doc: 'Clicking a choice directly selects it',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`, { waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        await this.page().waitForFunction(() => {
          const choice = document.querySelector('.swype-choice.top-left .choice-text');
          return choice && choice.textContent && choice.textContent !== '...';
        }, { timeout: 5000 });

        const initialText = await this.page().$eval('.main-text', el => el.textContent);

        await this.page().click('.swype-choice.top-left');
        await __.sleep(100);

        const finalText = await this.page().$eval('.main-text', el => el.textContent);
        this.assert(finalText.length > initialText.length, 'Text should grow after click selection');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'UndoRevertsChange',
    doc: 'Undo button restores previous text state',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`, { waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        await this.page().waitForFunction(() => {
          const choice = document.querySelector('.swype-choice.top-left .choice-text');
          return choice && choice.textContent && choice.textContent !== '...';
        }, { timeout: 5000 });

        const initialText = await this.page().$eval('.main-text', el => el.textContent);

        await this.page().click('.swype-choice.top-left');
        await __.sleep(100);

        const afterSelectText = await this.page().$eval('.main-text', el => el.textContent);
        this.assert(afterSelectText.length > initialText.length, 'Text should have grown');

        const undoBtn = await this.page().$('.bottom-bar .bar-btn:nth-child(2)');
        await undoBtn.click();
        await __.sleep(100);

        const afterUndoText = await this.page().$eval('.main-text', el => el.textContent);
        this.assertEq(afterUndoText, initialText, 'Undo should restore original text');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'RedoRestoresUndone',
    doc: 'Redo button restores undone change',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`, { waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        await this.page().waitForFunction(() => {
          const choice = document.querySelector('.swype-choice.top-left .choice-text');
          return choice && choice.textContent && choice.textContent !== '...';
        }, { timeout: 5000 });

        await this.page().click('.swype-choice.top-left');
        await __.sleep(100);

        const afterSelectText = await this.page().$eval('.main-text', el => el.textContent);

        const undoBtn = await this.page().$('.bottom-bar .bar-btn:nth-child(2)');
        await undoBtn.click();
        await __.sleep(100);

        const redoBtn = await this.page().$('.bottom-bar .bar-btn:nth-child(3)');
        await redoBtn.click();
        await __.sleep(100);

        const afterRedoText = await this.page().$eval('.main-text', el => el.textContent);
        this.assertEq(afterRedoText, afterSelectText, 'Redo should restore the undone text');
      } finally {
        server.stop();
      }
    }
  });

}.module({
  name: 'test.swyperloom.app',
  imports: [base, test, llm],
}).load();
