import { __, base } from 'simulabra';
import test from 'simulabra/test';

export default await async function (_, $, $test) {

  function createMockServer() {
    return Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        const file = Bun.file(process.cwd() + url.pathname);
        if (await file.exists()) {
          return new Response(file);
        }
        return new Response('Not found', { status: 404 });
      }
    });
  }

  $test.BrowserCase.new({
    name: 'AgendaAppPageLoads',
    doc: 'Verifies the Agenda app loads with expected elements',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        const url = `http://localhost:${server.port}/apps/agenda/index.html`;
        const errors = [];
        this.page().on('pageerror', err => errors.push(err.message));
        this.page().on('console', msg => {
          // Ignore WebSocket connection errors (expected when no backend)
          if (msg.type() === 'error' && !msg.text().includes('WebSocket')) {
            errors.push(msg.text());
          }
        });
        await this.page().goto(url, { waitUntil: 'domcontentloaded' });
        if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
        await this.page().waitForSelector('.agenda-app', { timeout: 5000 });
        await this.page().waitForSelector('.top-bar', { timeout: 1000 });
        await this.page().waitForSelector('.bottom-nav', { timeout: 1000 });
      } finally {
        server.stop();
      }
    }
  });

  async function loadPage(page, server) {
    const url = `http://localhost:${server.port}/apps/agenda/index.html`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.agenda-app', { timeout: 5000 });
  }

  $test.BrowserCase.new({
    name: 'AgendaAppHasNavTabs',
    doc: 'Verifies all navigation tabs are present',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        const tabs = await this.page().$$('.nav-tab');
        this.assertEq(tabs.length, 4, 'Should have 4 navigation tabs');

        const labels = await this.page().$$eval('.nav-label', els => els.map(e => e.textContent));
        this.assert(labels.includes('Chat'), 'Should have Chat tab');
        this.assert(labels.includes('Tasks'), 'Should have Tasks tab');
        this.assert(labels.includes('Journal'), 'Should have Journal tab');
        this.assert(labels.includes('Reminders'), 'Should have Reminders tab');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'AgendaAppChatViewDefault',
    doc: 'Chat view should be active by default',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        await this.page().waitForSelector('.chat-view', { timeout: 1000 });
        await this.page().waitForSelector('.chat-input', { timeout: 1000 });
        await this.page().waitForSelector('.chat-send', { timeout: 1000 });
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'AgendaAppNavigateToTasks',
    doc: 'Clicking Tasks tab shows todos view',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        const tasksTab = await this.page().$('.nav-tab:nth-child(2)');
        await tasksTab.click();
        await __.sleep(100);

        const todosView = await this.page().$('.todos-view');
        this.assert(todosView !== null, 'Todos view should be visible');

        const header = await this.page().$eval('.todos-view .view-header h2', el => el.textContent);
        this.assertEq(header, 'Tasks', 'Should show Tasks header');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'AgendaAppNavigateToJournal',
    doc: 'Clicking Journal tab shows journal view',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        const journalTab = await this.page().$('.nav-tab:nth-child(3)');
        await journalTab.click();
        await __.sleep(100);

        const journalView = await this.page().$('.journal-view');
        this.assert(journalView !== null, 'Journal view should be visible');

        const header = await this.page().$eval('.journal-view .view-header h2', el => el.textContent);
        this.assertEq(header, 'Journal', 'Should show Journal header');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'AgendaAppNavigateToReminders',
    doc: 'Clicking Reminders tab shows calendar view',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        const remindersTab = await this.page().$('.nav-tab:nth-child(4)');
        await remindersTab.click();
        await __.sleep(100);

        const calendarView = await this.page().$('.calendar-view');
        this.assert(calendarView !== null, 'Calendar view should be visible');

        const header = await this.page().$eval('.calendar-view .view-header h2', el => el.textContent);
        this.assertEq(header, 'Reminders', 'Should show Reminders header');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'AgendaAppMobileViewport',
    doc: 'Verifies app renders correctly in mobile viewport',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        const viewport = this.page().viewportSize();
        this.assert(viewport.width <= 450, 'Should have mobile width (<=450)');

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
    name: 'AgendaAppChatInputFocusable',
    doc: 'Chat input can receive focus and text',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        const input = await this.page().$('.chat-input');
        await input.click();
        await this.page().keyboard.type('test message');

        const value = await this.page().$eval('.chat-input', el => el.value);
        this.assertEq(value, 'test message', 'Input should contain typed text');
      } finally {
        server.stop();
      }
    }
  });

}.module({
  name: 'test.agenda.ui',
  imports: [base, test],
}).load();
