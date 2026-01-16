import { __, base } from 'simulabra';
import test from 'simulabra/test';
import helpers from '../support/helpers.js';
import redis from '../../src/redis.js';
import models from '../../src/models.js';
import database from '../../src/services/database.js';
import reminder from '../../src/services/reminder.js';

export default await async function (_, $, $test, $helpers, $redis, $models, $db, $reminder) {
  // Helper to create a test DatabaseService
  const createDbService = async () => {
    const service = $db.DatabaseService.new({ uid: 'TestDatabaseService' });
    await service.connectRedis();
    return service;
  };

  // Helper to create a test ReminderService with mocked database proxy
  const createReminderService = (dbService) => {
    const service = $reminder.ReminderService.new({ uid: 'TestReminderService' });
    // Inject the database service directly for testing
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
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);

      // Create a past reminder that is due
      const dueReminder = await dbService.createReminder(
        'test due reminder',
        '2020-01-01T00:00:00Z'
      );

      // Create a future reminder that is not due
      await dbService.createReminder(
        'future reminder',
        '2099-01-01T00:00:00Z'
      );

      // Check and process due reminders
      const processed = await reminderService.checkDueReminders();
      this.assert(processed.length >= 1, 'should process at least 1 reminder');
      this.assert(processed.some(r => r.message === 'test due reminder'), 'should include our due reminder');

      // Verify the reminder was marked as sent
      const reminder = await dbService.getReminder(dueReminder.rid);
      this.assertEq(reminder.sent, true);

      // Cleanup
      const allReminders = await dbService.listReminders({});
      for (const r of allReminders) {
        const obj = await $models.Reminder.findById(dbService.redis(), r.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceRecurringReminder',
    doc: 'ReminderService should create next occurrence for recurring reminders',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);

      // Create a past recurring reminder
      await dbService.createReminder(
        'daily reminder',
        '2020-01-01T10:00:00Z',
        { pattern: 'daily', interval: 1 }
      );

      // Process due reminders
      await reminderService.checkDueReminders();

      // Check that a new occurrence was created
      const allReminders = await dbService.listReminders({});
      const unsentReminders = allReminders.filter(r => !r.sent && r.message === 'daily reminder');
      this.assert(unsentReminders.length >= 1, 'should have created next occurrence');

      // Cleanup
      for (const r of allReminders) {
        const obj = await $models.Reminder.findById(dbService.redis(), r.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceNotifications',
    doc: 'ReminderService should collect notifications for due reminders',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);

      // Create due reminders
      await dbService.createReminder('notify me 1', '2020-01-01T00:00:00Z');
      await dbService.createReminder('notify me 2', '2020-01-02T00:00:00Z');

      // Collect notifications
      const notifications = await reminderService.collectNotifications();
      this.assert(notifications.length >= 2, 'should have at least 2 notifications');
      this.assert(notifications.some(n => n.message === 'notify me 1'), 'should include first');
      this.assert(notifications.some(n => n.message === 'notify me 2'), 'should include second');

      // Cleanup
      const allReminders = await dbService.listReminders({});
      for (const r of allReminders) {
        const obj = await $models.Reminder.findById(dbService.redis(), r.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServicePollingStartStop',
    doc: 'ReminderService should start and stop polling',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);
      reminderService.pollIntervalMs(100); // Fast polling for test

      reminderService.startPolling();
      this.assertEq(reminderService.running(), true);

      await __.sleep(50);

      reminderService.stopPolling();
      this.assertEq(reminderService.running(), false);

      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceNoDueReminders',
    doc: 'ReminderService should handle no due reminders gracefully',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);

      // Create only future reminders
      await dbService.createReminder('future only', '2099-12-31T23:59:59Z');

      const processed = await reminderService.checkDueReminders();
      this.assertEq(processed.length, 0);

      // Cleanup
      const allReminders = await dbService.listReminders({});
      for (const r of allReminders) {
        const obj = await $models.Reminder.findById(dbService.redis(), r.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceNotificationHandler',
    doc: 'ReminderService should call registered notification handlers',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);

      // Track which reminders the handler received
      const receivedReminders = [];
      reminderService.addNotificationHandler(async (reminder) => {
        receivedReminders.push(reminder.message);
      });

      // Create a due reminder
      await dbService.createReminder('handler test', '2020-01-01T00:00:00Z');

      // Process reminders
      await reminderService.checkDueReminders();

      // Verify handler was called
      this.assertEq(receivedReminders.length, 1);
      this.assertEq(receivedReminders[0], 'handler test');

      // Cleanup
      const allReminders = await dbService.listReminders({});
      for (const r of allReminders) {
        const obj = await $models.Reminder.findById(dbService.redis(), r.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceMultipleHandlers',
    doc: 'ReminderService should call all registered handlers',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);

      // Register multiple handlers
      const calls1 = [];
      const calls2 = [];
      reminderService.addNotificationHandler(async (r) => calls1.push(r.message));
      reminderService.addNotificationHandler(async (r) => calls2.push(r.message));

      await dbService.createReminder('multi handler', '2020-01-01T00:00:00Z');
      await reminderService.checkDueReminders();

      // Both handlers should be called
      this.assertEq(calls1.length, 1);
      this.assertEq(calls2.length, 1);
      this.assertEq(calls1[0], 'multi handler');
      this.assertEq(calls2[0], 'multi handler');

      // Cleanup
      const allReminders = await dbService.listReminders({});
      for (const r of allReminders) {
        const obj = await $models.Reminder.findById(dbService.redis(), r.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceHandlerError',
    doc: 'ReminderService should continue if handler throws',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);

      // First handler throws
      reminderService.addNotificationHandler(async () => {
        throw new Error('Handler failed');
      });

      // Second handler should still be called
      const calls = [];
      reminderService.addNotificationHandler(async (r) => calls.push(r.message));

      await dbService.createReminder('error test', '2020-01-01T00:00:00Z');
      await reminderService.checkDueReminders();

      // Second handler should still have been called
      this.assertEq(calls.length, 1);
      this.assertEq(calls[0], 'error test');

      // Cleanup
      const allReminders = await dbService.listReminders({});
      for (const r of allReminders) {
        const obj = await $models.Reminder.findById(dbService.redis(), r.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServiceTriggerNotification',
    doc: 'triggerNotification should invoke all handlers for a reminder',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);

      const received = [];
      reminderService.addNotificationHandler(async (r) => {
        received.push({ message: r.message, rid: r.rid });
      });

      // Create and trigger directly
      const reminder = await dbService.createReminder('direct trigger', '2025-12-31T00:00:00Z');
      await reminderService.triggerNotification(reminder);

      this.assertEq(received.length, 1);
      this.assertEq(received[0].message, 'direct trigger');
      this.assertEq(received[0].rid, reminder.rid);

      // Cleanup
      const obj = await $models.Reminder.findById(dbService.redis(), reminder.rid);
      if (obj) await obj.delete(dbService.redis());
      await dbService.redis().disconnect();
    }
  });

  $test.Case.new({
    name: 'ReminderServiceNoDbConnection',
    doc: 'ReminderService should handle missing database gracefully',
    do() {
      const reminderService = $reminder.ReminderService.new({ uid: 'NoDbService' });
      // dbService is not set, should not throw
      this.assertEq(reminderService.dbService(), undefined);
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderServicePollExecutesCheck',
    doc: 'poll should execute checkDueReminders',
    async do() {
      const dbService = await createDbService();
      const reminderService = createReminderService(dbService);
      reminderService.pollIntervalMs(50);

      const processed = [];
      reminderService.addNotificationHandler(async (r) => processed.push(r.message));

      await dbService.createReminder('poll test', '2020-01-01T00:00:00Z');

      // Start polling
      reminderService.startPolling();
      await __.sleep(80);
      reminderService.stopPolling();

      // Should have processed the reminder
      this.assert(processed.includes('poll test'), 'should process during poll');

      // Cleanup
      const allReminders = await dbService.listReminders({});
      for (const r of allReminders) {
        const obj = await $models.Reminder.findById(dbService.redis(), r.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });
}.module({
  name: 'test.services.reminder',
  imports: [base, test, helpers, redis, models, database, reminder],
}).load();
