import { __, base } from 'simulabra';
import test from 'simulabra/test';
import redis from '../src/redis.js';
import models from '../src/models.js';

export default await async function (_, $, $test, $redis, $models) {
  $test.Case.new({
    name: 'LogCreation',
    doc: 'Log should be created with content and timestamp',
    do() {
      const log = $models.Log.new({ content: 'test entry' });
      this.assertEq(log.content(), 'test entry');
      this.assert(log.timestamp() instanceof Date, 'should have timestamp');
      this.assertEq(log.tags().length, 0);
    }
  });

  $test.Case.new({
    name: 'LogWithTags',
    doc: 'Log should support tags',
    do() {
      const log = $models.Log.new({
        content: 'tagged entry',
        tags: ['work', 'meeting']
      });
      this.assertEq(log.tags().length, 2);
      this.assertEq(log.tags()[0], 'work');
    }
  });

  $test.Case.new({
    name: 'LogDescription',
    doc: 'Log description should include timestamp and content',
    do() {
      const log = $models.Log.new({
        content: 'test',
        tags: ['tag1']
      });
      const desc = log.description();
      this.assert(desc.includes('test'), 'should include content');
      this.assert(desc.includes('[tag1]'), 'should include tags');
    }
  });

  $test.AsyncCase.new({
    name: 'LogPersistence',
    doc: 'Log should save and load from Redis',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const log = $models.Log.new({
        content: 'persistent entry',
        tags: ['test']
      });
      await log.save(client);

      const found = await $models.Log.findById(client, log.rid());
      this.assertEq(found.content(), 'persistent entry');
      this.assertEq(found.tags()[0], 'test');

      await log.delete(client);
      await client.disconnect();
    }
  });

  $test.Case.new({
    name: 'TaskCreation',
    doc: 'Task should be created with defaults',
    do() {
      const task = $models.Task.new({ title: 'test task' });
      this.assertEq(task.title(), 'test task');
      this.assertEq(task.done(), false);
      this.assertEq(task.priority(), 3);
      this.assert(!task.dueDate(), 'should not have due date');
    }
  });

  $test.Case.new({
    name: 'TaskComplete',
    doc: 'Task should be completable',
    do() {
      const task = $models.Task.new({ title: 'complete me' });
      task.complete();
      this.assertEq(task.done(), true);
      this.assert(task.completedAt() instanceof Date, 'should have completedAt');
    }
  });

  $test.Case.new({
    name: 'TaskWithPriority',
    doc: 'Task should support priority levels',
    do() {
      const task = $models.Task.new({ title: 'urgent', priority: 1 });
      this.assertEq(task.priority(), 1);
      this.assert(task.description().includes('P1'), 'description should show priority');
    }
  });

  $test.AsyncCase.new({
    name: 'TaskPersistence',
    doc: 'Task should save and load from Redis',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const dueDate = new Date('2025-12-31');
      const task = $models.Task.new({
        title: 'persistent task',
        priority: 2,
        dueDate
      });
      await task.save(client);

      const found = await $models.Task.findById(client, task.rid());
      this.assertEq(found.title(), 'persistent task');
      this.assertEq(found.priority(), 2);
      this.assertEq(found.dueDate().toISOString().split('T')[0], '2025-12-31');
      this.assertEq(found.done(), false);

      await task.delete(client);
      await client.disconnect();
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleDaily',
    doc: 'Daily recurrence should advance by days',
    do() {
      const rule = $models.RecurrenceRule.new({
        pattern: 'daily',
        interval: 2
      });
      const from = new Date('2025-01-15T10:00:00Z');
      const next = rule.nextOccurrence(from);
      this.assertEq(next.getDate(), 17);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleWeekly',
    doc: 'Weekly recurrence should advance by weeks',
    do() {
      const rule = $models.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 1
      });
      const from = new Date('2025-01-15T10:00:00Z');
      const next = rule.nextOccurrence(from);
      this.assertEq(next.getDate(), 22);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleMonthly',
    doc: 'Monthly recurrence should advance by months',
    do() {
      const rule = $models.RecurrenceRule.new({
        pattern: 'monthly',
        interval: 1
      });
      const from = new Date('2025-01-15T10:00:00Z');
      const next = rule.nextOccurrence(from);
      this.assertEq(next.getMonth(), 1); // February
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleEndDate',
    doc: 'Recurrence should stop at end date',
    do() {
      const rule = $models.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1,
        endDate: new Date('2025-01-16')
      });
      const from = new Date('2025-01-15T10:00:00Z');
      const next = rule.nextOccurrence(from);
      this.assertEq(next.getDate(), 16);

      const afterEnd = rule.nextOccurrence(next);
      this.assert(!afterEnd, 'should return null after end date');
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleJSON',
    doc: 'RecurrenceRule should serialize to/from JSON',
    do() {
      const rule = $models.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 2,
        daysOfWeek: [1, 3, 5]
      });
      const json = rule.toJSON();
      const restored = $models.RecurrenceRule.fromJSON(json);
      this.assertEq(restored.pattern(), 'weekly');
      this.assertEq(restored.interval(), 2);
      this.assertEq(restored.daysOfWeek()[0], 1);
    }
  });

  $test.Case.new({
    name: 'ReminderCreation',
    doc: 'Reminder should be created with message and trigger time',
    do() {
      const trigger = new Date('2025-12-31T12:00:00Z');
      const reminder = $models.Reminder.new({
        message: 'test reminder',
        triggerAt: trigger
      });
      this.assertEq(reminder.message(), 'test reminder');
      this.assertEq(reminder.triggerAt().toISOString(), trigger.toISOString());
      this.assertEq(reminder.sent(), false);
    }
  });

  $test.Case.new({
    name: 'ReminderIsDue',
    doc: 'Reminder should know when it is due',
    do() {
      const pastReminder = $models.Reminder.new({
        message: 'past',
        triggerAt: new Date('2020-01-01')
      });
      this.assert(pastReminder.isDue(), 'past reminder should be due');

      const futureReminder = $models.Reminder.new({
        message: 'future',
        triggerAt: new Date('2099-01-01')
      });
      this.assert(!futureReminder.isDue(), 'future reminder should not be due');
    }
  });

  $test.Case.new({
    name: 'ReminderMarkSent',
    doc: 'Reminder should be markable as sent',
    do() {
      const reminder = $models.Reminder.new({
        message: 'test',
        triggerAt: new Date()
      });
      reminder.markSent();
      this.assertEq(reminder.sent(), true);
      this.assert(!reminder.isDue(), 'sent reminder should not be due');
    }
  });

  $test.Case.new({
    name: 'ReminderRecurrence',
    doc: 'Reminder should create next occurrence for recurring reminders',
    do() {
      const rule = $models.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1
      });
      const reminder = $models.Reminder.new({
        message: 'daily reminder',
        triggerAt: new Date('2025-01-15T10:00:00Z'),
        recurrence: rule
      });

      const next = reminder.createNextOccurrence();
      this.assert(next, 'should create next occurrence');
      this.assertEq(next.message(), 'daily reminder');
      this.assertEq(next.triggerAt().getDate(), 16);
    }
  });

  $test.Case.new({
    name: 'ReminderNoRecurrence',
    doc: 'Non-recurring reminder should not create next occurrence',
    do() {
      const reminder = $models.Reminder.new({
        message: 'one-time',
        triggerAt: new Date()
      });
      const next = reminder.createNextOccurrence();
      this.assert(!next, 'should not create next occurrence');
    }
  });

  $test.AsyncCase.new({
    name: 'ReminderPersistence',
    doc: 'Reminder should save and load from Redis with recurrence',
    async do() {
      const client = $redis.RedisClient.new({
        url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
      });
      await client.connect();

      const rule = $models.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 1
      });
      const reminder = $models.Reminder.new({
        message: 'persistent reminder',
        triggerAt: new Date('2025-06-15T09:00:00Z'),
        recurrence: rule
      });
      await reminder.save(client);

      const found = await $models.Reminder.findById(client, reminder.rid());
      this.assertEq(found.message(), 'persistent reminder');
      this.assert(found.recurrence(), 'should have recurrence');
      this.assertEq(found.recurrence().pattern(), 'weekly');

      await reminder.delete(client);
      await client.disconnect();
    }
  });
}.module({
  name: 'test.models',
  imports: [base, test, redis, models],
}).load();
