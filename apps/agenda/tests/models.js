import { __, base } from 'simulabra';
import test from 'simulabra/test';
import redis from '../src/redis.js';
import time from '../src/time.js';
import models from '../src/models.js';

export default await async function (_, $, $test, $redis, $time, $models) {
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

  $test.Case.new({
    name: 'TaskWithTags',
    doc: 'Task should support tags',
    do() {
      const task = $models.Task.new({
        title: 'tagged task',
        tags: ['work', 'urgent']
      });
      this.assertEq(task.tags().length, 2);
      this.assertEq(task.tags()[0], 'work');
      this.assert(task.description().includes('[work, urgent]'), 'description should show tags');
    }
  });

  $test.Case.new({
    name: 'TaskDefaultTags',
    doc: 'Task should default to empty tags array',
    do() {
      const task = $models.Task.new({ title: 'no tags' });
      this.assertEq(task.tags().length, 0);
      const desc = task.description();
      this.assert(desc.endsWith('no tags'), 'description should end with title when no tags');
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
        dueDate,
        tags: ['project-x', 'backend']
      });
      await task.save(client);

      const found = await $models.Task.findById(client, task.rid());
      this.assertEq(found.title(), 'persistent task');
      this.assertEq(found.priority(), 2);
      this.assertEq(found.dueDate().toISOString().split('T')[0], '2025-12-31');
      this.assertEq(found.done(), false);
      this.assertEq(found.tags().length, 2);
      this.assertEq(found.tags()[0], 'project-x');

      await task.delete(client);
      await client.disconnect();
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleDaily',
    doc: 'Daily recurrence should advance by days',
    do() {
      const rule = $time.RecurrenceRule.new({
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
      const rule = $time.RecurrenceRule.new({
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
      const rule = $time.RecurrenceRule.new({
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
      const rule = $time.RecurrenceRule.new({
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
      const rule = $time.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 2,
        daysOfWeek: [1, 3, 5]
      });
      const json = rule.toJSON();
      const restored = $time.RecurrenceRule.fromJSON(json);
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
      const rule = $time.RecurrenceRule.new({
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

  $test.Case.new({
    name: 'RecurrenceRuleWeeklyWithDays',
    doc: 'Weekly recurrence with specific days should find next matching day',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5] // Mon, Wed, Fri
      });
      // January 15, 2025 is a Wednesday (day 3)
      const from = new Date('2025-01-15T10:00:00Z');
      const next = rule.nextOccurrence(from);
      // Next should be Friday (day 5) Jan 17
      this.assertEq(next.getDate(), 17);
      this.assertEq(next.getDay(), 5); // Friday
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleWeeklyWrapAround',
    doc: 'Weekly recurrence should wrap to next week when needed',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 1,
        daysOfWeek: [1] // Monday only
      });
      // January 17, 2025 is a Friday
      const from = new Date('2025-01-17T10:00:00Z');
      const next = rule.nextOccurrence(from);
      // Next Monday is Jan 20
      this.assertEq(next.getDate(), 20);
      this.assertEq(next.getDay(), 1); // Monday
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleMonthlyOverflow',
    doc: 'Monthly recurrence should handle month-end overflow',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'monthly',
        interval: 1
      });
      // January 31 + 1 month should handle February correctly
      const from = new Date('2025-01-31T10:00:00Z');
      const next = rule.nextOccurrence(from);
      // February 2025 has 28 days, so Feb 28 or Mar 3 depending on impl
      this.assertEq(next.getMonth(), 2); // March (0-indexed)
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleLargeInterval',
    doc: 'Recurrence should handle large intervals',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 30
      });
      const from = new Date('2025-01-01T10:00:00Z');
      const next = rule.nextOccurrence(from);
      this.assertEq(next.getDate(), 31);
      this.assertEq(next.getMonth(), 0); // January
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleEndDateExact',
    doc: 'Recurrence on end date should still return that occurrence',
    do() {
      const endDate = new Date('2025-01-16T00:00:00Z');
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1,
        endDate
      });
      // Starting from Jan 15, next is Jan 16 which equals endDate
      const from = new Date('2025-01-15T10:00:00Z');
      const next = rule.nextOccurrence(from);
      this.assertEq(next.getDate(), 16);

      // From Jan 16, next would be Jan 17 which is past endDate
      const afterEnd = rule.nextOccurrence(next);
      this.assert(!afterEnd, 'should return null after end date');
    }
  });

  $test.Case.new({
    name: 'RecurrenceRulePreservesTime',
    doc: 'Recurrence should preserve time of day',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1
      });
      const from = new Date('2025-01-15T14:30:45Z');
      const next = rule.nextOccurrence(from);
      this.assertEq(next.getUTCHours(), 14);
      this.assertEq(next.getUTCMinutes(), 30);
      this.assertEq(next.getUTCSeconds(), 45);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleJSONRoundTrip',
    doc: 'RecurrenceRule should survive full JSON round-trip',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 2,
        daysOfWeek: [0, 6], // Weekend
        endDate: new Date('2025-12-31')
      });

      const json = rule.toJSON();
      const jsonStr = JSON.stringify(json);
      const parsed = JSON.parse(jsonStr);
      const restored = $time.RecurrenceRule.fromJSON(parsed);

      this.assertEq(restored.pattern(), 'weekly');
      this.assertEq(restored.interval(), 2);
      this.assertEq(restored.daysOfWeek().length, 2);
      this.assertEq(restored.daysOfWeek()[0], 0);
      this.assertEq(restored.daysOfWeek()[1], 6);
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

      const rule = $time.RecurrenceRule.new({
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

  $test.Case.new({
    name: 'RecurrenceRuleDSTSpringForward',
    doc: 'Recurrence should be consistent across DST spring forward',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1
      });
      // US DST 2025 starts March 9
      const beforeDST = new Date('2025-03-08T14:00:00Z');
      const next = rule.nextOccurrence(beforeDST);

      // Time should be preserved in UTC
      this.assertEq(next.getUTCDate(), 9);
      this.assertEq(next.getUTCHours(), 14);
      this.assertEq(next.getUTCMinutes(), 0);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleDSTFallBack',
    doc: 'Recurrence should be consistent across DST fall back',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1
      });
      // US DST 2025 ends November 2
      const beforeDSTEnd = new Date('2025-11-01T14:00:00Z');
      const next = rule.nextOccurrence(beforeDSTEnd);

      // Time should be preserved in UTC
      this.assertEq(next.getUTCDate(), 2);
      this.assertEq(next.getUTCHours(), 14);
      this.assertEq(next.getUTCMinutes(), 0);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleWeeklyDSTBoundary',
    doc: 'Weekly recurrence with days should work across DST',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5] // Mon, Wed, Fri
      });
      // March 7, 2025 is a Friday (day 5)
      const friday = new Date('2025-03-07T09:00:00Z');
      const nextMonday = rule.nextOccurrence(friday);

      // Next should be Monday March 10 (after DST change)
      this.assertEq(nextMonday.getUTCDate(), 10);
      this.assertEq(nextMonday.getUTCDay(), 1); // Monday
      this.assertEq(nextMonday.getUTCHours(), 9); // Time preserved
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleMonthlyDSTBoundary',
    doc: 'Monthly recurrence should work across DST',
    do() {
      const rule = $time.RecurrenceRule.new({
        pattern: 'monthly',
        interval: 1
      });
      // February 15, crossing into March (after DST)
      const feb15 = new Date('2025-02-15T08:30:00Z');
      const next = rule.nextOccurrence(feb15);

      this.assertEq(next.getUTCMonth(), 2); // March
      this.assertEq(next.getUTCDate(), 15);
      this.assertEq(next.getUTCHours(), 8);
      this.assertEq(next.getUTCMinutes(), 30);
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleEndDateTimezoneConsistent',
    doc: 'End date comparison should use consistent UTC semantics',
    do() {
      const endDate = new Date('2025-03-09T00:00:00Z');
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1,
        endDate
      });
      // March 9 at 14:00 UTC, but endDate is March 9 00:00 UTC
      // endOfDay(endDate) is March 9 23:59:59.999 UTC
      // Next occurrence would be March 10 at 14:00 UTC which is past end of March 9
      const march9 = new Date('2025-03-09T14:00:00Z');
      const next = rule.nextOccurrence(march9);

      // March 10 at 14:00 is past end-of-day March 9, so null
      this.assert(!next, 'should return null when next occurrence would be past end date');
    }
  });

  $test.Case.new({
    name: 'RecurrenceRuleEndDateInclusiveAtEndOfDay',
    doc: 'Occurrences on the end date (before 23:59:59.999) should be allowed',
    do() {
      const endDate = new Date('2025-03-10T00:00:00Z');
      const rule = $time.RecurrenceRule.new({
        pattern: 'daily',
        interval: 1,
        endDate
      });
      // March 9 at 08:00 UTC should produce March 10 at 08:00 UTC
      // which is before end of day March 10
      const march9 = new Date('2025-03-09T08:00:00Z');
      const next = rule.nextOccurrence(march9);

      this.assert(next, 'should return occurrence on end date');
      this.assertEq(next.getUTCDate(), 10);
      this.assertEq(next.getUTCHours(), 8);
    }
  });
}.module({
  name: 'test.models',
  imports: [base, test, redis, time, models],
}).load();
