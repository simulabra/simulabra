import { __, base } from 'simulabra';
import test from 'simulabra/test';

const { randomUUID } = await import('crypto');
const buildDir = `/tmp/agenda-test-${randomUUID()}`;
const buildResult = await Bun.build({
  entrypoints: [process.cwd() + '/apps/agenda/index.html'],
  outdir: buildDir,
});
if (!buildResult.success) {
  console.error('Build failed:', buildResult.logs);
  throw new Error('Agenda build failed');
}

export default await async function (_, $, $test) {

  function createMockServer() {
    const ac = new AbortController();
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        let path = url.pathname === '/' ? '/index.html' : url.pathname;

        if (path.startsWith('/api/v1/')) {
          const json = (value) => new Response(JSON.stringify({ ok: true, value }), {
            headers: { 'Content-Type': 'application/json' },
          });
          if (path === '/api/v1/status') return json({ status: 'ok' });
          if (path === '/api/v1/tasks/list') return json([]);
          if (path === '/api/v1/logs/list') return json([]);
          if (path === '/api/v1/reminders/list') return json([]);
          if (path === '/api/v1/projects/list') return json([]);
          if (path === '/api/v1/chat/history') return json([]);
          if (path === '/api/v1/prompts/pending') return json([]);
          if (path === '/api/v1/chat/wait') {
            await new Promise(resolve => {
              const timer = setTimeout(resolve, 30000);
              ac.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); });
            });
            return json([]);
          }
          return json(null);
        }

        const file = Bun.file(buildDir + path);
        if (await file.exists()) return new Response(file);
        return new Response('Not found', { status: 404 });
      }
    });
    const origStop = server.stop.bind(server);
    server.stop = () => { ac.abort(); origStop(); };
    return server;
  }

  async function loadPage(page, server) {
    const url = `http://localhost:${server.port}/index.html`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.agenda-app', { timeout: 5000 });
  }

  $test.BrowserCase.new({
    name: 'AgendaAppPageLoads',
    doc: 'Verifies the Agenda app loads with expected elements',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        const url = `http://localhost:${server.port}/index.html`;
        const errors = [];
        this.page().on('pageerror', err => errors.push(err.message));
        this.page().on('console', msg => {
          if (msg.type() === 'error'
              && !msg.text().includes('WebSocket')
              && !msg.text().includes('Failed to load resource')
              && !msg.text().includes('fetch')) {
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

  $test.BrowserCase.new({
    name: 'AgendaAppNoNotificationBanner',
    doc: 'Notification banner should not exist; prompts are inline in chat',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        const banner = await this.page().$('.notification-banner');
        this.assertEq(banner, null, 'Notification banner should not be present');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'AgendaAppNudgeButtonInChat',
    doc: 'Nudge button should be in the chat input area',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        const nudge = await this.page().$('.chat-input-form .nudge-btn');
        this.assert(nudge !== null, 'Nudge button should be in chat input form');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'AgendaAppLongTextNoOverflow',
    doc: 'Long unbroken strings should not overflow the app container',
    isMobile: true,
    async do() {
      const server = createMockServer();
      try {
        await loadPage(this.page(), server);

        await this.page().evaluate(() => {
          const el = document.querySelector('.chat-messages');
          const div = document.createElement('div');
          div.textContent = 'x'.repeat(500);
          el.appendChild(div);
        });
        await __.sleep(100);

        const hasHorizontalScroll = await this.page().evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        this.assert(!hasHorizontalScroll, 'Long unbroken text should not cause horizontal overflow');
      } finally {
        server.stop();
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Project Selector Tests
  // ═══════════════════════════════════════════════════════════════════════════

  const testProjects = [
    { sid: 'proj-1', title: 'Coins', slug: 'coins', archived: false, context: 'Ancient coin cleaning' },
    { sid: 'proj-2', title: 'House', slug: 'house', archived: false, context: 'House renovation' },
  ];

  const testTasks = [
    { rid: 't1', title: 'Clean denarius', priority: 1, done: false, projectId: 'proj-1' },
    { rid: 't2', title: 'Fix deck', priority: 2, done: false, projectId: 'proj-2' },
    { rid: 't3', title: 'Buy groceries', priority: 2, done: false, projectId: null },
  ];

  const testLogs = [
    { id: 'l1', content: 'Soaked coins', timestamp: '2026-01-30T10:00:00Z', tags: [], projectId: 'proj-1' },
    { id: 'l2', content: 'General note', timestamp: '2026-01-30T11:00:00Z', tags: [], projectId: null },
  ];

  const testReminders = [
    { id: 'r1', message: 'Check coins', triggerAt: '2026-02-15T10:00:00Z', sent: false, projectId: 'proj-1' },
    { id: 'r2', message: 'Dentist', triggerAt: '2026-02-16T10:00:00Z', sent: false, projectId: null },
  ];

  function createApiMockServer(opts = {}) {
    const projects = (opts.projects || testProjects).map(p => ({...p}));
    const tasks = opts.tasks || testTasks;
    const logs = opts.logs || testLogs;
    const reminders = opts.reminders || testReminders;
    const state = { lastUpdateBody: null };
    const ac = new AbortController();

    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;

        if (path.startsWith('/api/v1/')) {
          const json = (value) => new Response(JSON.stringify({ ok: true, value }), {
            headers: { 'Content-Type': 'application/json' },
          });
          if (path === '/api/v1/status') return json({ status: 'ok' });
          if (path === '/api/v1/tasks/list') return json(tasks);
          if (path === '/api/v1/logs/list') return json(logs);
          if (path === '/api/v1/reminders/list') return json(reminders);
          if (path === '/api/v1/projects/list') return json(projects);
          if (path === '/api/v1/projects/update') {
            const body = await req.json();
            state.lastUpdateBody = body;
            const proj = projects.find(p => p.sid === body.id);
            if (proj && body.context !== undefined) proj.context = body.context;
            return json(proj || null);
          }
          if (path === '/api/v1/chat/history') return json([]);
          if (path === '/api/v1/prompts/pending') return json([]);
          if (path === '/api/v1/chat/wait') {
            await new Promise(resolve => {
              const timer = setTimeout(resolve, 30000);
              ac.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); });
            });
            return json([]);
          }
          return json(null);
        }

        let filePath = path === '/' ? '/index.html' : path;
        const file = Bun.file(buildDir + filePath);
        if (await file.exists()) return new Response(file);
        return new Response('Not found', { status: 404 });
      }
    });
    server.state = state;
    const origStop = server.stop.bind(server);
    server.stop = () => { ac.abort(); origStop(); };
    return server;
  }

  async function loadApiPage(page, server) {
    const url = `http://localhost:${server.port}/index.html`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.agenda-app', { timeout: 5000 });
    await page.waitForSelector('.connection-status.connected', { timeout: 5000 });
  }

  $test.BrowserCase.new({
    name: 'ProjectSelectorRendersOptions',
    doc: 'ProjectSelector shows All, Inbox, and project tabs when projects exist',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await loadApiPage(this.page(), server);
        await this.page().click('.nav-tab:nth-child(2)');
        await __.sleep(300);

        const labels = await this.page().$$eval('.todos-view .project-tab', els => els.map(e => e.textContent.trim()));
        this.assertEq(labels.length, 4, 'Should have All + Inbox + 2 project tabs');
        this.assert(labels.includes('All'), 'Should have All tab');
        this.assert(labels.includes('Inbox'), 'Should have Inbox tab');
        this.assert(labels.includes('Coins'), 'Should have Coins project tab');
        this.assert(labels.includes('House'), 'Should have House project tab');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ProjectSelectorInboxFilters',
    doc: 'Selecting Inbox filters to tasks with no projectId',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await loadApiPage(this.page(), server);
        await this.page().click('.nav-tab:nth-child(2)');
        await __.sleep(300);

        const allTasks = await this.page().$$('.todos-view .task-item');
        this.assertEq(allTasks.length, 3, 'All view shows all 3 tasks');

        await this.page().click('.todos-view .project-tab:nth-child(2)');
        await __.sleep(300);

        const filtered = await this.page().$$('.todos-view .task-item');
        this.assertEq(filtered.length, 1, 'Inbox shows only unassigned task');

        const title = await this.page().$eval('.todos-view .task-item .task-title', el => el.textContent);
        this.assertEq(title, 'Buy groceries', 'Inbox task should be Buy groceries');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ProjectSelectorProjectFilters',
    doc: 'Selecting a project filters to matching tasks',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await loadApiPage(this.page(), server);
        await this.page().click('.nav-tab:nth-child(2)');
        await __.sleep(300);

        await this.page().click('.todos-view .project-tab:nth-child(3)');
        await __.sleep(300);

        const filtered = await this.page().$$('.todos-view .task-item');
        this.assertEq(filtered.length, 1, 'Coins project shows 1 task');

        const title = await this.page().$eval('.todos-view .task-item .task-title', el => el.textContent);
        this.assertEq(title, 'Clean denarius', 'Coins task should be Clean denarius');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ProjectSelectorLocalStorage',
    doc: 'Project selection persists to localStorage',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await loadApiPage(this.page(), server);
        await this.page().click('.nav-tab:nth-child(2)');
        await __.sleep(300);

        await this.page().click('.todos-view .project-tab:nth-child(2)');
        await __.sleep(300);

        const stored = await this.page().evaluate(() => localStorage.getItem('agenda_activeProjectId'));
        this.assertEq(stored, 'inbox', 'localStorage should store inbox selection');

        await this.page().click('.todos-view .project-tab:nth-child(1)');
        await __.sleep(300);

        const cleared = await this.page().evaluate(() => localStorage.getItem('agenda_activeProjectId'));
        this.assertEq(cleared, null, 'localStorage should clear for All selection');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ProjectSelectorNoProjectsRegression',
    doc: 'When no projects exist, selector shows only All and Inbox',
    isMobile: true,
    async do() {
      const server = createApiMockServer({ projects: [] });
      try {
        await loadApiPage(this.page(), server);
        await this.page().click('.nav-tab:nth-child(2)');
        await __.sleep(300);

        const tabs = await this.page().$$('.todos-view .project-tab');
        this.assertEq(tabs.length, 2, 'Should have only All + Inbox when no projects');

        const labels = await this.page().$$eval('.todos-view .project-tab', els => els.map(e => e.textContent.trim()));
        this.assert(labels.includes('All'), 'Should have All tab');
        this.assert(labels.includes('Inbox'), 'Should have Inbox tab');
      } finally {
        server.stop();
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Project Context Panel Tests
  // ═══════════════════════════════════════════════════════════════════════════

  async function navigateToTasksWithProject(page, server) {
    await loadApiPage(page, server);
    await page.click('.nav-tab:nth-child(2)');
    await __.sleep(300);
    await page.click('.todos-view .project-tab:nth-child(3)');
    await __.sleep(300);
  }

  $test.BrowserCase.new({
    name: 'ContextPanelHiddenForAll',
    doc: 'Context panel renders nothing when All is selected',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await loadApiPage(this.page(), server);
        await this.page().click('.nav-tab:nth-child(2)');
        await __.sleep(300);

        const header = await this.page().$('.todos-view .context-panel-header');
        this.assertEq(header, null, 'Context panel header should not exist for All');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ContextPanelHiddenForInbox',
    doc: 'Context panel renders nothing when Inbox is selected',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await loadApiPage(this.page(), server);
        await this.page().click('.nav-tab:nth-child(2)');
        await __.sleep(300);
        await this.page().click('.todos-view .project-tab:nth-child(2)');
        await __.sleep(300);

        const header = await this.page().$('.todos-view .context-panel-header');
        this.assertEq(header, null, 'Context panel header should not exist for Inbox');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ContextPanelShowsForProject',
    doc: 'Selecting a project shows a collapsed context panel header',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await navigateToTasksWithProject(this.page(), server);

        const header = await this.page().$('.todos-view .context-panel-header');
        this.assert(header !== null, 'Context panel header should appear for project');

        const text = await header.textContent();
        this.assert(text.includes('Coins'), 'Header should contain project title');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ContextPanelExpandCollapse',
    doc: 'Click to expand shows context text, click again collapses',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await navigateToTasksWithProject(this.page(), server);

        let body = await this.page().$('.todos-view .context-panel-body');
        this.assertEq(body, null, 'Body should be hidden when collapsed');

        await this.page().click('.context-panel-header');
        await __.sleep(200);

        body = await this.page().$('.todos-view .context-panel-body');
        this.assert(body !== null, 'Body should appear after expanding');

        const text = await this.page().$eval('.context-panel-body .context-text', el => el.textContent);
        this.assertEq(text, 'Ancient coin cleaning', 'Should display project context');

        await this.page().click('.context-panel-header');
        await __.sleep(200);

        body = await this.page().$('.todos-view .context-panel-body');
        this.assertEq(body, null, 'Body should be hidden after collapsing');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ContextPanelEditAndSave',
    doc: 'Edit mode shows textarea, save persists via API',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await navigateToTasksWithProject(this.page(), server);

        await this.page().click('.context-panel-header');
        await __.sleep(200);

        await this.page().click('.context-edit-btn');
        await __.sleep(200);

        const textarea = await this.page().$('.context-panel-body textarea');
        this.assert(textarea !== null, 'Textarea should appear in edit mode');

        await textarea.fill('Updated coin notes');
        await this.page().click('.context-save-btn');
        await __.sleep(500);

        this.assert(server.state.lastUpdateBody !== null, 'Should have sent update request');
        this.assertEq(server.state.lastUpdateBody.context, 'Updated coin notes', 'Should send updated context');

        const editBtn = await this.page().$('.context-edit-btn');
        this.assert(editBtn !== null, 'Should return to read mode after save');
      } finally {
        server.stop();
      }
    }
  });

  $test.BrowserCase.new({
    name: 'ContextPanelEditCancel',
    doc: 'Cancel in edit mode returns to read mode without saving',
    isMobile: true,
    async do() {
      const server = createApiMockServer();
      try {
        await navigateToTasksWithProject(this.page(), server);

        await this.page().click('.context-panel-header');
        await __.sleep(200);
        await this.page().click('.context-edit-btn');
        await __.sleep(200);

        const textarea = await this.page().$('.context-panel-body textarea');
        await textarea.fill('This should not be saved');

        await this.page().click('.context-cancel-btn');
        await __.sleep(200);

        this.assertEq(server.state.lastUpdateBody, null, 'Should not have sent update on cancel');

        const text = await this.page().$eval('.context-panel-body .context-text', el => el.textContent);
        this.assertEq(text, 'Ancient coin cleaning', 'Should show original context after cancel');
      } finally {
        server.stop();
      }
    }
  });

}.module({
  name: 'test.agenda.ui',
  imports: [base, test],
}).load();
