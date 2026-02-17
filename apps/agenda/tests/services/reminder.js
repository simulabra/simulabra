import { __, base } from 'simulabra';
import test from 'simulabra/test';
import db from 'simulabra/db';
import helpers from '../support/helpers.js';
import sqlite from '../../src/sqlite.js';
import models from '../../src/models.js';
import database from '../../src/services/database.js';
import reminder from '../../src/services/reminder.js';

export default await async function (_, $, $test, $db, $helpers, $sqlite, $models, $database, $reminder) {
  const createDbService = () => {
    const service = $database.DatabaseService.new({
      uid: 'TestDatabaseService',
      dbPath: ':memory:'
    });
    service.initDatabase();
    return service;
  };

  const createReminderService = (dbService) => {
    const service = $reminder.ReminderService.new({ uid: 'TestReminderService' });
    service.dbService(dbService);
    return service;
  };

  $test.Case.new({
    name: 'ReminderServiceCreation',
    doc: 'ReminderService should be created with defaults',
    do() {
      const service = $reminder.ReminderService.new({ uid: 'TestReminderService' });
      this.assertEq(service.pollIntervalMs(), 60000);
      this.assertEq(service.running(), false);
    }
  });

  $test.Case.new({
    name: 'ReminderServiceHealth',
    doc: 'ReminderService should report health',
    do() {
      const service = $reminder.ReminderService.new({ uid: 'TestReminderService' });
      const health = service.health();
      this.assertEq(health.status, 'ok');
      this.assertEq(health.service, 'ReminderService');
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceCheckDueReminders',
    doc: 'ReminderService should find and process due reminders',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);

      dbService.createReminder({
        message: 'test due reminder',
        triggerAt: '2020-01-01T00:00:00Z'
      });

      dbService.createReminder({
        message: 'future reminder',
        triggerAt: '2099-01-01T00:00:00Z'
      });

      const processed = await reminderService.checkDueReminders();
      this.assert(processed.length >= 1, 'should process at least 1 reminder');
      this.assert(processed.some(r => r.message === 'test due reminder'), 'should include our due reminder');

      const reminder = dbService.getReminder({ id: processed[0].id });
      this.assertEq(reminder.sent, true);

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceRecurringReminder',
    doc: 'ReminderService should create next occurrence for recurring reminders',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);

      dbService.createReminder({
        message: 'daily reminder',
        triggerAt: '2020-01-01T10:00:00Z',
        recurrence: { pattern: 'daily', interval: 1 }
      });

      await reminderService.checkDueReminders();

      const allReminders = dbService.listReminders({});
      const unsentReminders = allReminders.filter(r => !r.sent && r.message === 'daily reminder');
      this.assert(unsentReminders.length >= 1, 'should have created next occurrence');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceNotifications',
    doc: 'ReminderService should collect notifications for due reminders',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);

      dbService.createReminder({ message: 'notify me 1', triggerAt: '2020-01-01T00:00:00Z' });
      dbService.createReminder({ message: 'notify me 2', triggerAt: '2020-01-02T00:00:00Z' });

      const notifications = await reminderService.collectNotifications();
      this.assert(notifications.length >= 2, 'should have at least 2 notifications');
      this.assert(notifications.some(n => n.message === 'notify me 1'), 'should include first');
      this.assert(notifications.some(n => n.message === 'notify me 2'), 'should include second');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServicePollingStartStop',
    doc: 'ReminderService should start and stop polling',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);
      reminderService.pollIntervalMs(100);

      reminderService.startPolling();
      this.assertEq(reminderService.running(), true);

      await __.sleep(50);

      reminderService.stopPolling();
      this.assertEq(reminderService.running(), false);

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceNoDueReminders',
    doc: 'ReminderService should handle no due reminders gracefully',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);

      dbService.createReminder({ message: 'future only', triggerAt: '2099-12-31T23:59:59Z' });

      const processed = await reminderService.checkDueReminders();
      this.assertEq(processed.length, 0);

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceNotificationHandler',
    doc: 'ReminderService should call registered notification handlers',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);

      const receivedReminders = [];
      reminderService.addNotificationHandler(async (reminder) => {
        receivedReminders.push(reminder.message);
      });

      dbService.createReminder({ message: 'handler test', triggerAt: '2020-01-01T00:00:00Z' });

      await reminderService.checkDueReminders();

      this.assertEq(receivedReminders.length, 1);
      this.assertEq(receivedReminders[0], 'handler test');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceMultipleHandlers',
    doc: 'ReminderService should call all registered handlers',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);

      const calls1 = [];
      const calls2 = [];
      reminderService.addNotificationHandler(async (r) => calls1.push(r.message));
      reminderService.addNotificationHandler(async (r) => calls2.push(r.message));

      dbService.createReminder({ message: 'multi handler', triggerAt: '2020-01-01T00:00:00Z' });
      await reminderService.checkDueReminders();

      this.assertEq(calls1.length, 1);
      this.assertEq(calls2.length, 1);
      this.assertEq(calls1[0], 'multi handler');
      this.assertEq(calls2[0], 'multi handler');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceHandlerError',
    doc: 'ReminderService should continue if handler throws',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);

      reminderService.addNotificationHandler(async () => {
        throw new Error('Handler failed');
      });

      const calls = [];
      reminderService.addNotificationHandler(async (r) => calls.push(r.message));

      dbService.createReminder({ message: 'error test', triggerAt: '2020-01-01T00:00:00Z' });
      await reminderService.checkDueReminders();

      this.assertEq(calls.length, 1);
      this.assertEq(calls[0], 'error test');

      dbService.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceTriggerNotification',
    doc: 'triggerNotification should invoke all handlers for a reminder',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);

      const received = [];
      reminderService.addNotificationHandler(async (r) => {
        received.push({ message: r.message, id: r.id });
      });

      const reminder = dbService.createReminder({ message: 'direct trigger', triggerAt: '2025-12-31T00:00:00Z' });
      await reminderService.triggerNotification(reminder);

      this.assertEq(received.length, 1);
      this.assertEq(received[0].message, 'direct trigger');
      this.assertEq(received[0].id, reminder.id);

      dbService.db().close();
    }
  });

  $test.Case.new({
    name: 'ReminderServiceNoDbConnection',
    doc: 'ReminderService should handle missing database gracefully',
    do() {
      const reminderService = $reminder.ReminderService.new({ uid: 'NoDbService' });
      this.assertEq(reminderService.dbService(), undefined);
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServicePollExecutesCheck',
    doc: 'poll should execute checkDueReminders',
    async do() {
      const dbService = createDbService();
      const reminderService = createReminderService(dbService);
      reminderService.pollIntervalMs(50);

      const processed = [];
      reminderService.addNotificationHandler(async (r) => processed.push(r.message));

      dbService.createReminder({ message: 'poll test', triggerAt: '2020-01-01T00:00:00Z' });

      reminderService.startPolling();
      await __.sleep(80);
      reminderService.stopPolling();

      this.assert(processed.includes('poll test'), 'should process during poll');

      dbService.db().close();
    }
  });
}.module({
  name: 'test.services.reminder',
  imports: [base, test, db, helpers, sqlite, models, database, reminder],
}).load();
