import { Database } from 'bun:sqlite';
import { __, base } from 'simulabra';
import test from 'simulabra/test';
import db from 'simulabra/db';
import helpers from '../support/helpers.js';
import sqlite from '../../src/sqlite.js';
import models from '../../src/models.js';
import database from '../../src/services/database.js';

export default await async function (_, $, $test, $db, $helpers, $sqlite, $models, $database) {
  const createTestService = () => {
    const service = $database.DatabaseService.new({
      uid: 'TestDatabaseService',
      dbPath: ':memory:'
    });
    service.initDatabase();
    return service;
  };

  $test.Case.new({
    name: 'DatabaseServiceHealth',
    doc: 'DatabaseService should report health',
    do() {
      const service = createTestService();
      const health = service.health();
      this.assertEq(health.status, 'ok');
      this.assertEq(health.service, 'DatabaseService');
      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateLog',
    doc: 'DatabaseService should create logs',
    do() {
      const service = createTestService();

      const log = service.createLog({ content: 'test log entry', tags: ['tag1', 'tag2'] });
      this.assert(log.$class === 'Log', 'should return Log');
      this.assertEq(log.content, 'test log entry');
      this.assertEq(log.tags[0], 'tag1');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListLogs',
    doc: 'DatabaseService should list logs',
    do() {
      const service = createTestService();

      service.createLog({ content: 'log 1' });
      service.createLog({ content: 'log 2' });

      const logs = service.listLogs({ limit: 10 });
      this.assertEq(logs.length, 2, 'should have 2 logs');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateTask',
    doc: 'DatabaseService should create tasks',
    do() {
      const service = createTestService();

      const task = service.createTask({ title: 'test task', priority: 1, dueDate: '2025-12-31' });
      this.assert(task.$class === 'Task', 'should return Task');
      this.assertEq(task.title, 'test task');
      this.assertEq(task.priority, 1);
      this.assertEq(task.done, false);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCompleteTask',
    doc: 'DatabaseService should complete tasks',
    do() {
      const service = createTestService();

      const task = service.createTask({ title: 'complete me' });
      const completed = service.completeTask({ id: task.id });
      this.assertEq(completed.done, true);
      this.assert(completed.completedAt, 'should have completedAt');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListTasks',
    doc: 'DatabaseService should list and filter tasks',
    do() {
      const service = createTestService();

      service.createTask({ title: 'task 1', priority: 1 });
      const task2 = service.createTask({ title: 'task 2', priority: 2 });
      service.completeTask({ id: task2.id });

      const allTasks = service.listTasks({});
      this.assertEq(allTasks.length, 2, 'should have 2 tasks');

      const incompleteTasks = service.listTasks({ done: false });
      this.assert(incompleteTasks.every(t => !t.done), 'should all be incomplete');

      const completeTasks = service.listTasks({ done: true });
      this.assert(completeTasks.every(t => t.done), 'should all be complete');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateReminder',
    doc: 'DatabaseService should create reminders',
    do() {
      const service = createTestService();

      const reminder = service.createReminder({
        message: 'test reminder',
        triggerAt: '2025-12-31T12:00:00Z'
      });
      this.assert(reminder.$class === 'Reminder', 'should return Reminder');
      this.assertEq(reminder.message, 'test reminder');
      this.assertEq(reminder.sent, false);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceRecurringReminder',
    doc: 'DatabaseService should create recurring reminders',
    do() {
      const service = createTestService();

      const reminder = service.createReminder({
        message: 'daily reminder',
        triggerAt: '2025-01-15T10:00:00Z',
        recurrence: { pattern: 'daily', interval: 1 }
      });
      this.assert(reminder.recurrence, 'should have recurrence');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceGetDueReminders',
    doc: 'DatabaseService should get due reminders',
    do() {
      const service = createTestService();

      // Create a past reminder (due)
      service.createReminder({ message: 'past reminder', triggerAt: '2020-01-01T00:00:00Z' });
      // Create a future reminder (not due)
      service.createReminder({ message: 'future reminder', triggerAt: '2099-01-01T00:00:00Z' });

      const dueReminders = service.getDueReminders();
      this.assert(dueReminders.length >= 1, 'should have at least 1 due reminder');
      this.assert(dueReminders.some(r => r.message === 'past reminder'), 'should include past reminder');
      this.assert(!dueReminders.some(r => r.message === 'future reminder'), 'should not include future reminder');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceMarkReminderSent',
    doc: 'DatabaseService should mark reminders as sent',
    do() {
      const service = createTestService();

      const reminder = service.createReminder({ message: 'mark me', triggerAt: '2020-01-01T00:00:00Z' });
      const marked = service.markReminderSent({ id: reminder.id });
      this.assertEq(marked.sent, true);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceSearch',
    doc: 'DatabaseService should search across all items',
    do() {
      const service = createTestService();

      service.createLog({ content: 'searchable log entry' });
      service.createTask({ title: 'searchable task' });
      service.createReminder({ message: 'searchable reminder', triggerAt: '2025-12-31T00:00:00Z' });

      const results = service.search({ query: 'searchable' });
      this.assert(results.logs.length >= 1, 'should find logs');
      this.assert(results.tasks.length >= 1, 'should find tasks');
      this.assert(results.reminders.length >= 1, 'should find reminders');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceSearchWildcard',
    doc: 'DatabaseService search with * should return all items',
    do() {
      const service = createTestService();

      service.createLog({ content: 'wildcard test log' });
      service.createTask({ title: 'wildcard test task' });

      const results = service.search({ query: '*' });
      this.assert(results.logs.length >= 1, 'should find all logs');
      this.assert(results.tasks.length >= 1, 'should find all tasks');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceChatStream',
    doc: 'DatabaseService should append and list chat messages',
    do() {
      const service = createTestService();

      const msg1 = service.appendChatMessage({
        role: 'user',
        content: 'Hello',
        source: 'test'
      });
      this.assert(msg1.id, 'should have id');
      this.assertEq(msg1.content, 'Hello');

      const msg2 = service.appendChatMessage({
        role: 'assistant',
        content: 'Hi there',
        source: 'test'
      });

      const messages = service.listChatMessages({ limit: 10 });
      this.assertEq(messages.length, 2);
      this.assertEq(messages[0].content, 'Hello');
      this.assertEq(messages[1].content, 'Hi there');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceChatReadAfter',
    doc: 'DatabaseService should read chat messages after an id',
    do() {
      const service = createTestService();

      service.appendChatMessage({ role: 'user', content: 'First', source: 'test' });
      const lastId = service.getLastChatInternalId({});

      service.appendChatMessage({ role: 'user', content: 'Second', source: 'test' });
      service.appendChatMessage({ role: 'user', content: 'Third', source: 'test' });

      const newMessages = service.readChatMessages({ afterId: lastId });
      this.assertEq(newMessages.length, 2);
      this.assertEq(newMessages[0].content, 'Second');
      this.assertEq(newMessages[1].content, 'Third');

      service.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceChatWait',
    doc: 'DatabaseService should poll for new messages',
    async do() {
      const service = createTestService();

      const lastId = service.getLastChatInternalId({});

      // Append a message after a delay
      setTimeout(() => {
        service.appendChatMessage({ role: 'user', content: 'Delayed', source: 'test' });
      }, 100);

      const newMessages = await service.waitForChatMessages({ afterId: lastId, timeoutMs: 1000 });
      this.assertEq(newMessages.length, 1);
      this.assertEq(newMessages[0].content, 'Delayed');

      service.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceChatWaitTimeout',
    doc: 'DatabaseService waitForChatMessages should return empty on timeout',
    async do() {
      const service = createTestService();

      const lastId = service.getLastChatInternalId({});
      const newMessages = await service.waitForChatMessages({ afterId: lastId, timeoutMs: 300 });
      this.assertEq(newMessages.length, 0);

      service.db().close();
    }
  });
}.module({
  name: 'test.services.database',
  imports: [base, test, db, helpers, sqlite, models, database],
}).load();
