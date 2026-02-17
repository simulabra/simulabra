import { __, base } from 'simulabra';
import test from 'simulabra/test';
import db from 'simulabra/db';
import helpers from '../support/helpers.js';
import sqlite from '../../src/sqlite.js';
import models from '../../src/models.js';
import database from '../../src/services/database.js';
import geist from '../../src/services/geist.js';

export default await async function (_, $, $test, $db, $helpers, $sqlite, $models, $database, $geist) {
  const createDbService = () => {
    const service = $database.DatabaseService.new({
      uid: 'TestDatabaseService',
      dbPath: ':memory:'
    });
    service.initDatabase();
    return service;
  };

  const createGeistService = (dbService) => {
    const service = $geist.GeistService.new({ uid: 'TestGeistService' });
    service.dbService(dbService);
    return service;
  };

  $test.Case.new({
    name: 'GeistServiceCreation',
    doc: 'GeistService should be created with defaults',
    do() {
      const service = $geist.GeistService.new({ uid: 'TestGeistService' });
      this.assert(service.tools().length > 0, 'should have tools defined');
    }
  });

  $test.Case.new({
    name: 'GeistServiceHealth',
    doc: 'GeistService should report health',
    do() {
      const service = $geist.GeistService.new({ uid: 'TestGeistService' });
      const health = service.health();
      this.assertEq(health.status, 'ok');
      this.assertEq(health.service, 'GeistService');
    }
  });

  $test.Case.new({
    name: 'GeistServiceToolDefinitions',
    doc: 'GeistService should have correct tool definitions',
    do() {
      const service = $geist.GeistService.new({ uid: 'TestGeistService' });
      const tools = service.tools();

      const toolNames = tools.map(t => t.name);
      this.assert(toolNames.includes('create_log'), 'should have create_log');
      this.assert(toolNames.includes('create_task'), 'should have create_task');
      this.assert(toolNames.includes('complete_task'), 'should have complete_task');
      this.assert(toolNames.includes('create_reminder'), 'should have create_reminder');
      this.assert(toolNames.includes('search'), 'should have search');
      this.assert(toolNames.includes('list_tasks'), 'should have list_tasks');
      this.assert(toolNames.includes('list_logs'), 'should have list_logs');
      this.assert(toolNames.includes('list_reminders'), 'should have list_reminders');
      this.assert(toolNames.includes('trigger_webhook'), 'should have trigger_webhook');
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteCreateLog',
    doc: 'GeistService should execute create_log tool',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      const result = await geistService.executeTool('create_log', {
        content: 'test log from geist'
      });

      this.assert(result.success, 'should succeed');
      this.assertEq(result.data.$class, 'Log');
      this.assertEq(result.data.content, 'test log from geist');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteCreateTask',
    doc: 'GeistService should execute create_task tool',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      const result = await geistService.executeTool('create_task', {
        title: 'test task from geist',
        priority: 2
      });

      this.assert(result.success, 'should succeed');
      this.assertEq(result.data.$class, 'Task');
      this.assertEq(result.data.title, 'test task from geist');
      this.assertEq(result.data.priority, 2);

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteCompleteTask',
    doc: 'GeistService should execute complete_task tool',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      const task = dbService.createTask({ title: 'task to complete' });

      const result = await geistService.executeTool('complete_task', {
        id: task.id
      });

      this.assert(result.success, 'should succeed');
      this.assertEq(result.data.done, true);

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteCreateReminder',
    doc: 'GeistService should execute create_reminder tool',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      const result = await geistService.executeTool('create_reminder', {
        message: 'test reminder from geist',
        when: '2025-12-31T10:00:00Z'
      });

      this.assert(result.success, 'should succeed');
      this.assertEq(result.data.$class, 'Reminder');
      this.assertEq(result.data.message, 'test reminder from geist');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteSearch',
    doc: 'GeistService should execute search tool',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      dbService.createLog({ content: 'geist search test log' });
      dbService.createTask({ title: 'geist search test task' });

      const result = await geistService.executeTool('search', {
        query: 'geist search test'
      });

      this.assert(result.success, 'should succeed');
      this.assert(result.data.logs.length >= 1, 'should find logs');
      this.assert(result.data.tasks.length >= 1, 'should find tasks');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteListTasks',
    doc: 'GeistService should execute list_tasks tool',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      dbService.createTask({ title: 'geist list task 1' });
      dbService.createTask({ title: 'geist list task 2' });

      const result = await geistService.executeTool('list_tasks', {});

      this.assert(result.success, 'should succeed');
      this.assert(result.data.length >= 2, 'should have at least 2 tasks');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteListLogs',
    doc: 'GeistService should execute list_logs tool',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      dbService.createLog({ content: 'geist list log 1' });
      dbService.createLog({ content: 'geist list log 2' });

      const result = await geistService.executeTool('list_logs', { limit: 10 });

      this.assert(result.success, 'should succeed');
      this.assert(result.data.length >= 2, 'should have at least 2 logs');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceUnknownTool',
    doc: 'GeistService should handle unknown tool gracefully',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      const result = await geistService.executeTool('unknown_tool', {});

      this.assertEq(result.success, false);
      this.assert(result.error.includes('Unknown tool'), 'should have error message');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteListReminders',
    doc: 'GeistService should execute list_reminders tool',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      dbService.createReminder({ message: 'geist list reminder 1', triggerAt: new Date(Date.now() + 86400000).toISOString() });
      dbService.createReminder({ message: 'geist list reminder 2', triggerAt: new Date(Date.now() + 172800000).toISOString() });

      const result = await geistService.executeTool('list_reminders', {});

      this.assert(result.success, 'should succeed');
      this.assert(result.data.length >= 2, 'should have at least 2 reminders');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteListRemindersFiltered',
    doc: 'GeistService should filter reminders by sent status',
    async do() {
      const dbService = createDbService();
      const geistService = createGeistService(dbService);

      const reminder1 = dbService.createReminder({ message: 'unsent reminder', triggerAt: new Date(Date.now() + 86400000).toISOString() });
      const reminder2 = dbService.createReminder({ message: 'sent reminder', triggerAt: new Date(Date.now() - 86400000).toISOString() });
      dbService.markReminderSent({ id: reminder2.id });

      const unsentResult = await geistService.executeTool('list_reminders', { sent: false });
      const sentResult = await geistService.executeTool('list_reminders', { sent: true });

      this.assert(unsentResult.success, 'unsent query should succeed');
      this.assert(sentResult.success, 'sent query should succeed');
      this.assert(unsentResult.data.some(r => r.id === reminder1.id), 'should find unsent reminder');
      this.assert(sentResult.data.some(r => r.id === reminder2.id), 'should find sent reminder');

      dbService.db().close();
    }
  });
}.module({
  name: 'test.services.geist',
  imports: [base, test, db, helpers, sqlite, models, database, geist],
}).load();
