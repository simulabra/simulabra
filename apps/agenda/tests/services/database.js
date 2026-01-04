import { __, base } from 'simulabra';
import test from 'simulabra/test';
import redis from '../../src/redis.js';
import models from '../../src/models.js';
import database from '../../src/services/database.js';

export default await async function (_, $, $test, $redis, $models, $db) {
  // Create a test instance without connecting to supervisor
  const createTestService = async () => {
    const service = $db.DatabaseService.new({ uid: 'TestDatabaseService' });
    await service.connectRedis();
    return service;
  };

  $test.AsyncCase.new({
    name: 'DatabaseServiceHealth',
    doc: 'DatabaseService should report health',
    async do() {
      const service = await createTestService();
      const health = service.health();
      this.assertEq(health.status, 'ok');
      this.assertEq(health.service, 'DatabaseService');
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceCreateLog',
    doc: 'DatabaseService should create logs',
    async do() {
      const service = await createTestService();

      const log = await service.createLog('test log entry', ['tag1', 'tag2']);
      this.assert(log.$class === 'Log', 'should return Log');
      this.assertEq(log.content, 'test log entry');
      this.assertEq(log.tags[0], 'tag1');

      // Cleanup
      const logObj = await $models.Log.findById(service.redis(), log.rid);
      await logObj.delete(service.redis());
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceListLogs',
    doc: 'DatabaseService should list logs',
    async do() {
      const service = await createTestService();

      await service.createLog('log 1');
      await service.createLog('log 2');

      const logs = await service.listLogs(10);
      this.assert(logs.length >= 2, 'should have at least 2 logs');

      // Cleanup
      for (const log of logs) {
        const logObj = await $models.Log.findById(service.redis(), log.rid);
        if (logObj) await logObj.delete(service.redis());
      }
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceCreateTask',
    doc: 'DatabaseService should create tasks',
    async do() {
      const service = await createTestService();

      const task = await service.createTask('test task', 1, '2025-12-31');
      this.assert(task.$class === 'Task', 'should return Task');
      this.assertEq(task.title, 'test task');
      this.assertEq(task.priority, 1);
      this.assertEq(task.done, false);

      // Cleanup
      const taskObj = await $models.Task.findById(service.redis(), task.rid);
      await taskObj.delete(service.redis());
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceCompleteTask',
    doc: 'DatabaseService should complete tasks',
    async do() {
      const service = await createTestService();

      const task = await service.createTask('complete me');
      const completed = await service.completeTask(task.rid);
      this.assertEq(completed.done, true);
      this.assert(completed.completedAt, 'should have completedAt');

      // Cleanup
      const taskObj = await $models.Task.findById(service.redis(), task.rid);
      await taskObj.delete(service.redis());
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceListTasks',
    doc: 'DatabaseService should list and filter tasks',
    async do() {
      const service = await createTestService();

      await service.createTask('task 1', 1);
      const task2 = await service.createTask('task 2', 2);
      await service.completeTask(task2.rid);

      const allTasks = await service.listTasks({});
      this.assert(allTasks.length >= 2, 'should have at least 2 tasks');

      const incompleteTasks = await service.listTasks({ done: false });
      this.assert(incompleteTasks.every(t => !t.done), 'should all be incomplete');

      const completeTasks = await service.listTasks({ done: true });
      this.assert(completeTasks.every(t => t.done), 'should all be complete');

      // Cleanup
      for (const task of allTasks) {
        const taskObj = await $models.Task.findById(service.redis(), task.rid);
        if (taskObj) await taskObj.delete(service.redis());
      }
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceCreateReminder',
    doc: 'DatabaseService should create reminders',
    async do() {
      const service = await createTestService();

      const reminder = await service.createReminder(
        'test reminder',
        '2025-12-31T12:00:00Z'
      );
      this.assert(reminder.$class === 'Reminder', 'should return Reminder');
      this.assertEq(reminder.message, 'test reminder');
      this.assertEq(reminder.sent, false);

      // Cleanup
      const reminderObj = await $models.Reminder.findById(service.redis(), reminder.rid);
      await reminderObj.delete(service.redis());
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceRecurringReminder',
    doc: 'DatabaseService should create recurring reminders',
    async do() {
      const service = await createTestService();

      const reminder = await service.createReminder(
        'daily reminder',
        '2025-01-15T10:00:00Z',
        { pattern: 'daily', interval: 1 }
      );
      this.assert(reminder.recurrence, 'should have recurrence');

      // Cleanup
      const reminderObj = await $models.Reminder.findById(service.redis(), reminder.rid);
      await reminderObj.delete(service.redis());
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceGetDueReminders',
    doc: 'DatabaseService should get due reminders',
    async do() {
      const service = await createTestService();

      // Create a past reminder (due)
      await service.createReminder('past reminder', '2020-01-01T00:00:00Z');
      // Create a future reminder (not due)
      await service.createReminder('future reminder', '2099-01-01T00:00:00Z');

      const dueReminders = await service.getDueReminders();
      this.assert(dueReminders.length >= 1, 'should have at least 1 due reminder');
      this.assert(dueReminders.some(r => r.message === 'past reminder'), 'should include past reminder');
      this.assert(!dueReminders.some(r => r.message === 'future reminder'), 'should not include future reminder');

      // Cleanup
      const allReminders = await service.listReminders({});
      for (const reminder of allReminders) {
        const reminderObj = await $models.Reminder.findById(service.redis(), reminder.rid);
        if (reminderObj) await reminderObj.delete(service.redis());
      }
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceMarkReminderSent',
    doc: 'DatabaseService should mark reminders as sent',
    async do() {
      const service = await createTestService();

      const reminder = await service.createReminder('mark me', '2020-01-01T00:00:00Z');
      const marked = await service.markReminderSent(reminder.rid);
      this.assertEq(marked.sent, true);

      // Cleanup
      const reminderObj = await $models.Reminder.findById(service.redis(), reminder.rid);
      await reminderObj.delete(service.redis());
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceSearch',
    doc: 'DatabaseService should search across all items',
    async do() {
      const service = await createTestService();

      await service.createLog('searchable log entry');
      await service.createTask('searchable task');
      await service.createReminder('searchable reminder', '2025-12-31T00:00:00Z');

      const results = await service.search('searchable');
      this.assert(results.logs.length >= 1, 'should find logs');
      this.assert(results.tasks.length >= 1, 'should find tasks');
      this.assert(results.reminders.length >= 1, 'should find reminders');

      // Cleanup
      for (const log of results.logs) {
        const obj = await $models.Log.findById(service.redis(), log.rid);
        if (obj) await obj.delete(service.redis());
      }
      for (const task of results.tasks) {
        const obj = await $models.Task.findById(service.redis(), task.rid);
        if (obj) await obj.delete(service.redis());
      }
      for (const reminder of results.reminders) {
        const obj = await $models.Reminder.findById(service.redis(), reminder.rid);
        if (obj) await obj.delete(service.redis());
      }
      await service.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceSearchWildcard',
    doc: 'DatabaseService search with * should return all items',
    async do() {
      const service = await createTestService();

      await service.createLog('wildcard test log');
      await service.createTask('wildcard test task');

      const results = await service.search('*');
      this.assert(results.logs.length >= 1, 'should find all logs');
      this.assert(results.tasks.length >= 1, 'should find all tasks');

      // Cleanup
      for (const log of results.logs) {
        const obj = await $models.Log.findById(service.redis(), log.rid);
        if (obj) await obj.delete(service.redis());
      }
      for (const task of results.tasks) {
        const obj = await $models.Task.findById(service.redis(), task.rid);
        if (obj) await obj.delete(service.redis());
      }
      await service.redis().disconnect();
    }
  });
}.module({
  name: 'test.services.database',
  imports: [base, test, redis, models, database],
}).load();
