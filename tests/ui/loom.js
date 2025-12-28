import { __, base } from '../../src/base.js';
import test from '../../src/test.js';

export default await async function (_, $, $test) {
  $test.BrowserCase.new({
    name: 'LoomPageLoads',
    doc: 'Verifies the Loom demo page loads with expected elements',
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
        const url = `http://localhost:${server.port}/demos/loom.html`;
        let pageError = null;
        this.page().on('pageerror', err => { pageError = err; });
        await this.page().goto(url, { waitUntil: 'networkidle' });
        if (pageError) throw new Error(`Page error: ${pageError.message}`);
        await this.page().waitForSelector('.loom', { timeout: 1000 });
        await this.page().waitForSelector('.loom-textarea', { timeout: 1000 });
        await this.page().waitForSelector('.seek-button', { timeout: 1000 });
      } finally {
        server.stop();
      }
    }
  });
}.module({
  name: 'test.ui.loom',
  imports: [base, test],
}).load();
