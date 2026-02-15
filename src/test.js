import { __, base } from './base.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'Case',
    slots: [
      $.Method.new({
        name: 'run',
        do() {
          try {
            this.do().apply(this);
            // this.log('passed');
          } catch (e) {
            // demands a native error class?
            this.log('failed');
            throw e;
          }
        }
      }),
      $.Var.new({ name: 'do' }),
      $.Method.new({
        name: 'assert',
        do(statement, msg = '') {
          if (!statement) {
            throw new Error(`${this.description()}: assertion failed: ${msg}`);
          }
        }
      }),
      $.Method.new({
        name: 'assertEq',
        do(a, b, msg = '') {
          if (a !== b) {
            const descA = typeof a?.description === 'function' ? a.description() : JSON.stringify(a);
            const descB = typeof b?.description === 'function' ? b.description() : JSON.stringify(b);
            throw new Error(`${this.description()}: assertEq failed (${descA} !== ${descB}) ${msg}`);
          }
        }
      }),
      $.Method.new({
        name: 'assertErrorMessageIncludes',
        do(errorMessage, messageFragment) {
          if (!errorMessage.includes(messageFragment)) {
            throw new Error(`${this.description()}: Error message should include '${messageFragment}', got '${errorMessage}'`);
          }
        }
      }),
      $.Method.new({
        name: 'assertThrows',
        do(fn, expectedErrorSubstring = '', msg = '') {
          let caught = false;
          let errorMessage = '';
          try {
            fn.apply(this);
          } catch (e) {
            caught = true;
            errorMessage = e.message;
            if (expectedErrorSubstring && !e.message.includes(expectedErrorSubstring)) {
              throw new Error(`${this.title()}: assertThrows failed. Expected error message to include "${expectedErrorSubstring}", but got: "${e.message}". ${msg}`);
            }
          }
          if (!caught) {
            throw new Error(`${this.title()}: assertThrows failed. Expected function to throw an error, but it did not. ${msg}`);
          }
          return errorMessage; // Optionally return message for further checks
        }
      }),
    ]
  });
  const testTimeoutMs = parseInt(process.env.TIMEOUT || '10', 10) * 1000;

  $.Class.new({
    name: 'AsyncCase',
    slots: [
      _.Case,
      $.Method.new({
        name: 'run',
        override: true,
        async do() {
          const timer = setTimeout(() => {
            console.error(`TIMEOUT: ${this.title()} exceeded ${testTimeoutMs}ms`);
            process.exit(1);
          }, testTimeoutMs);
          timer.unref?.();
          try {
            return await this.do().apply(this);
          } catch (e) {
            this.log('failed');
            throw e;
          } finally {
            clearTimeout(timer);
          }
        }
      }),
    ]
  });

  let sharedBrowser = null;

  $.Class.new({
    name: 'BrowserCase',
    doc: 'Test case with Playwright browser automation. Shares one Chromium instance across all tests, using isolated BrowserContexts for per-test state.',
    slots: [
      _.AsyncCase,
      $.Var.new({ name: 'browser' }),
      $.Var.new({ name: 'context' }),
      $.Var.new({ name: 'page' }),
      $.Var.new({ name: 'isMobile', default: false }),
      $.Var.new({ name: 'pageErrors', default: () => [] }),

      $.AsyncBefore.new({
        name: 'run',
        async do() {
          const { chromium } = await import('playwright');
          if (!sharedBrowser || !sharedBrowser.isConnected()) {
            sharedBrowser = await chromium.launch({ timeout: 30000 });
          }
          this.browser(sharedBrowser);
          const contextOptions = this.isMobile()
            ? { viewport: { width: 390, height: 844 } }
            : {};
          this.context(await this.browser().newContext(contextOptions));
          this.page(await this.context().newPage());
          this.page().on('pageerror', err => this.pageErrors().push(`[pageerror] ${err.message}`));
          this.page().on('console', msg => {
            if (msg.type() === 'error') {
              this.pageErrors().push(`[console.error] ${msg.text()}`);
            }
          });
        }
      }),

      $.AsyncAfter.new({
        name: 'run',
        async do() {
          if (this.pageErrors().length > 0) {
            console.log(`Page errors in ${this.title()}:\n  ${this.pageErrors().join('\n  ')}`);
          }
          await this.context()?.close();
        }
      }),

      $.Method.new({
        name: 'assertVisible',
        async do(selector, msg = '') {
          const visible = await this.page().isVisible(selector);
          this.assert(visible, msg || `Expected ${selector} to be visible`);
        }
      }),

      $.Method.new({
        name: 'assertText',
        async do(selector, expected, msg = '') {
          const text = await this.page().textContent(selector);
          this.assertEq(text?.trim(), expected, msg);
        }
      })
    ]
  });
}.module({
  name: 'test',
  imports: [base],
}).load();
