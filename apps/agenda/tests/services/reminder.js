import { __, base } from 'simulabra';
import test from 'simulabra/test';
import redis from '../../src/redis.js';
import models from '../../src/models.js';
import database from '../../src/services/database.js';
import reminder from '../../src/services/reminder.js';

export default await async function (_, $, $test, $redis, $models, $db, $reminder) {
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
}.module({
  name: 'test.services.reminder',
  imports: [base, test, redis, models, database, reminder],
}).load();
