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
    const server = Bun.serve({
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
    return server;
  }

  async function setupApiIntercept(page, mockChoices = [' alpha', ' beta', ' gamma', ' delta']) {
    await page.route('**/localhost:3731/v1/completions', async route => {
      const body = JSON.parse(route.request().postData());
      const idx = Math.min(3, Math.floor((1 - body.temperature) * 10));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
        })
      });
    });
  }

  $test.BrowserCase.new({
    name: 'SwypeLoomMobileViewport',
    doc: 'Verifies app renders correctly in mobile viewport',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await setupApiIntercept(this.page());
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
        await setupApiIntercept(this.page());
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
        await setupApiIntercept(this.page());
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
        await setupApiIntercept(this.page());
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
        await setupApiIntercept(this.page());
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
        await setupApiIntercept(this.page());
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

  $test.BrowserCase.new({
    name: 'PreviewScrollsToBottom',
    doc: 'Text display scrolls to bottom when preview changes during swipe',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await setupApiIntercept(this.page());
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`, { waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        // Wait for choices to load (same as other tests)
        await this.page().waitForFunction(() => {
          const choice = document.querySelector('.swype-choice.top-right .choice-text');
          return choice && choice.textContent && choice.textContent !== '...';
        }, { timeout: 5000 });

        // Programmatically add long text and set preview
        await this.page().evaluate(() => {
          const mainText = document.querySelector('.main-text');
          const previewText = document.querySelector('.preview-text');
          const textContent = document.querySelector('.text-content');
          if (mainText) mainText.textContent = 'Line.\n'.repeat(100);
          textContent.scrollTop = 0;
        });
        await __.sleep(50);

        const scrollTopBefore = await this.page().$eval('.text-content', el => el.scrollTop);
        this.assertEq(scrollTopBefore, 0, 'Should start scrolled to top');

        // Capture console errors
        const errors = [];
        this.page().on('console', msg => {
          if (msg.type() === 'error') errors.push(msg.text());
        });

        // Start swipe to trigger preview
        const swyper = await this.page().$('.swyper');
        const box = await swyper.boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await this.page().mouse.move(cx, cy);
        await this.page().mouse.down();
        await this.page().mouse.move(box.x + box.width - 20, box.y + 20, { steps: 10 });

        // Wait for scroll
        await __.sleep(200);

        const state = await this.page().evaluate(() => {
          const textContent = document.querySelector('.text-content');
          const previewText = document.querySelector('.preview-text');
          return {
            scrollTop: textContent?.scrollTop || 0,
            scrollHeight: textContent?.scrollHeight || 0,
            clientHeight: textContent?.clientHeight || 0,
            isAtBottom: textContent ? textContent.scrollTop >= textContent.scrollHeight - textContent.clientHeight - 5 : false,
            previewContent: previewText?.textContent || 'NO_PREVIEW'
          };
        });

        // Cancel swipe
        await this.page().mouse.up();

        this.assert(state.previewContent !== 'NO_PREVIEW' && state.previewContent !== '', `Preview should be set during swipe (preview="${state.previewContent}")`);
        this.assert(state.isAtBottom, `Should scroll to bottom during swipe preview (scrollTop=${state.scrollTop}, scrollHeight=${state.scrollHeight}, clientHeight=${state.clientHeight}, errors=${errors.join('; ')})`);
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ShortSwipeCommitsFewer',
    doc: 'A short swipe commits fewer tokens than a long swipe',
    isMobile: true,
    async do() {
      const choices = [' alpha beta gamma delta', ' one two three four', ' x y z w', ' a b c d'];
      const server = createMockServer(choices);
      try {
        await setupApiIntercept(this.page(), choices);
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`);
        await this.page().evaluate(() => localStorage.clear());
        await this.page().reload({ waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        await this.page().waitForFunction(() => {
          const choice = document.querySelector('.swype-choice.top-right .choice-text');
          return choice && choice.textContent && choice.textContent.trim().length > 0 && choice.textContent !== '...';
        }, { timeout: 5000 });

        const initialText = await this.page().$eval('.main-text', el => el.textContent);

        const swyper = await this.page().$('.swyper');
        const box = await swyper.boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await this.page().mouse.move(cx, cy);
        await this.page().mouse.down();
        await this.page().mouse.move(cx + 60, cy - 60, { steps: 10 });
        await this.page().mouse.up();

        await __.sleep(200);
        const afterShortSwipe = await this.page().$eval('.main-text', el => el.textContent);
        const shortAppended = afterShortSwipe.slice(initialText.length);
        console.log(shortAppended);
        const shortWordCount = shortAppended.trim().split(/\s+/).filter(w => w).length;

        this.assert(shortWordCount >= 1, 'Short swipe should commit at least 1 word');
        this.assert(shortWordCount < 4, 'Short swipe should commit fewer than all 4 words');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'LongSwipeCommitsMore',
    doc: 'A long swipe commits more tokens',
    isMobile: true,
    async do() {
      const choices = [' alpha beta gamma delta', ' one two three four', ' x y z w', ' a b c d'];
      const server = createMockServer(choices);
      try {
        await setupApiIntercept(this.page(), choices);
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`);
        await this.page().evaluate(() => localStorage.clear());
        await this.page().reload({ waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        await this.page().waitForFunction(() => {
          const choice = document.querySelector('.swype-choice.top-right .choice-text');
          return choice && choice.textContent && choice.textContent.trim().length > 0 && choice.textContent !== '...';
        }, { timeout: 5000 });

        const initialText = await this.page().$eval('.main-text', el => el.textContent);

        const swyper = await this.page().$('.swyper');
        const box = await swyper.boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await this.page().mouse.move(cx, cy);
        await this.page().mouse.down();
        await this.page().mouse.move(box.x + box.width - 10, box.y + 10, { steps: 15 });
        await this.page().mouse.up();

        await __.sleep(200);
        const afterLongSwipe = await this.page().$eval('.main-text', el => el.textContent);
        const longAppended = afterLongSwipe.slice(initialText.length);
        const longWordCount = longAppended.trim().split(/\s+/).filter(w => w).length;

        this.assert(longWordCount >= 3, 'Long swipe should commit 3+ words');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ClickCornerCommitsFull',
    doc: 'Clicking a corner directly commits the full choice',
    isMobile: true,
    async do() {
      const choices = [' alpha beta gamma delta', ' one two three four', ' x y z w', ' a b c d'];
      const server = createMockServer(choices);
      try {
        await setupApiIntercept(this.page(), choices);
        await this.page().goto(`http://localhost:${server.port}/apps/swyperloom/index.html`);
        await this.page().evaluate(() => localStorage.clear());
        await this.page().reload({ waitUntil: 'networkidle' });
        await this.page().waitForSelector('.swypeloom', { timeout: 5000 });

        await this.page().waitForFunction(() => {
          const choice = document.querySelector('.swype-choice.top-left .choice-text');
          return choice && choice.textContent && choice.textContent.trim().length > 0 && choice.textContent !== '...';
        }, { timeout: 5000 });

        const initialText = await this.page().$eval('.main-text', el => el.textContent);

        const choiceText = await this.page().$eval('.swype-choice.top-left .choice-text', el => el.textContent);
        const expectedWordCount = choiceText.trim().split(/\s+/).filter(w => w).length;

        await this.page().click('.swype-choice.top-left');
        await __.sleep(100);

        const afterClick = await this.page().$eval('.main-text', el => el.textContent);
        const appended = afterClick.slice(initialText.length);
        const wordCount = appended.trim().split(/\s+/).filter(w => w).length;

        this.assertEq(wordCount, expectedWordCount, 'Click should commit all words from the choice');
      } finally {
        server.stop();
      }
    }
  });

}.module({
  name: 'test.swyperloom.app',
  imports: [base, test, llm],
}).load();
