import { Database } from 'bun:sqlite';
import { __, base } from 'simulabra';
import test from 'simulabra/test';
import db from 'simulabra/db';
import sqlite from '../src/sqlite.js';
import time from '../src/time.js';
import models from '../src/models.js';

export default await async function (_, $, $test, $db, $sqlite, $time, $models) {
  const createTestDb = () => {
    const database = new Database(':memory:');
    const runner = $db.MigrationRunner.new({ db: database });
    for (const migration of $sqlite.AgendaMigrations.all()) {
      runner.register(migration);
    }
    runner.migrate();
    return database;
  };

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

  $test.Case.new({
    name: 'LogPersistence',
    doc: 'Log should save and load from SQLite',
    do() {
      const database = createTestDb();

      const log = $models.Log.new({
        content: 'persistent entry',
        tags: ['test']
      });
      log.save(database);

      // Debug output
      const logId = log.sid();
      const allRows = database.query('SELECT * FROM agenda_Log').all();
      this.tlog('Saved log id:', logId, 'rows:', allRows.length);

      const found = $models.Log.findById(database, logId);
      this.tlog('findById result:', found ? 'found' : 'null');
      this.assert(found !== null, 'should find the log');
      this.assertEq(found.content(), 'persistent entry');
      this.assertEq(found.tags()[0], 'test');

      database.close();
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

  $test.Case.new({
    name: 'TaskPersistence',
    doc: 'Task should save and load from SQLite',
    do() {
      const database = createTestDb();

      const dueDate = new Date('2025-12-31');
      const task = $models.Task.new({
        title: 'persistent task',
        priority: 2,
        dueDate,
        tags: ['project-x', 'backend']
      });
      task.save(database);

      const found = $models.Task.findById(database, task.sid());
      this.assertEq(found.title(), 'persistent task');
      this.assertEq(found.priority(), 2);
      this.assertEq(found.dueDate().toISOString().split('T')[0], '2025-12-31');
      this.assertEq(found.done(), false);
      this.assertEq(found.tags().length, 2);
      this.assertEq(found.tags()[0], 'project-x');

      database.close();
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

  $test.Case.new({
    name: 'ReminderPersistence',
    doc: 'Reminder should save and load from SQLite with recurrence',
    do() {
      const database = createTestDb();

      const rule = $time.RecurrenceRule.new({
        pattern: 'weekly',
        interval: 1
      });
      const reminder = $models.Reminder.new({
        message: 'persistent reminder',
        triggerAt: new Date('2025-06-15T09:00:00Z'),
        recurrence: rule
      });
      reminder.save(database);

      const found = $models.Reminder.findById(database, reminder.sid());
      this.assertEq(found.message(), 'persistent reminder');
      this.assert(found.recurrence(), 'should have recurrence');
      this.assertEq(found.recurrence().pattern(), 'weekly');

      database.close();
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

  $test.Case.new({
    name: 'LogFindAll',
    doc: 'Log.findAll should return all logs',
    do() {
      const database = createTestDb();

      const log1 = $models.Log.new({ content: 'first' });
      const log2 = $models.Log.new({ content: 'second' });
      log1.save(database);
      log2.save(database);

      const all = $models.Log.findAll(database);
      this.assertEq(all.length, 2);

      database.close();
    }
  });

  $test.Case.new({
    name: 'LogDelete',
    doc: 'Log.delete should remove from database',
    do() {
      const database = createTestDb();

      const log = $models.Log.new({ content: 'to delete' });
      log.save(database);
      const id = log.sid();

      log.delete(database);

      const found = $models.Log.findById(database, id);
      this.assert(!found, 'should not find deleted log');

      database.close();
    }
  });

  $test.Case.new({
    name: 'TaskUpdate',
    doc: 'Task should update existing record',
    do() {
      const database = createTestDb();

      const task = $models.Task.new({ title: 'original' });
      task.save(database);
      const id = task.sid();

      task.title('updated');
      task.save(database);

      this.assertEq(task.sid(), id, 'id should not change');

      const found = $models.Task.findById(database, id);
      this.assertEq(found.title(), 'updated');

      database.close();
    }
  });

  // Prompt model tests
  $test.Case.new({
    name: 'PromptCreation',
    doc: 'Prompt should be created with defaults',
    do() {
      const prompt = $models.Prompt.new({
        itemType: 'task',
        itemId: 'task-123',
        message: 'Did you finish this task?'
      });
      this.assertEq(prompt.itemType(), 'task');
      this.assertEq(prompt.itemId(), 'task-123');
      this.assertEq(prompt.message(), 'Did you finish this task?');
      this.assertEq(prompt.status(), 'pending');
      this.assert(prompt.generatedAt() instanceof Date, 'should have generatedAt');
    }
  });

  $test.Case.new({
    name: 'PromptWithContext',
    doc: 'Prompt should store JSON context',
    do() {
      const context = { taskTitle: 'Test Task', daysSinceUpdate: 7 };
      const prompt = $models.Prompt.new({
        itemType: 'task',
        itemId: 'task-123',
        message: 'Check on this task',
        context
      });
      this.assertEq(prompt.context().taskTitle, 'Test Task');
      this.assertEq(prompt.context().daysSinceUpdate, 7);
    }
  });

  $test.Case.new({
    name: 'PromptDescription',
    doc: 'Prompt description should show status and message',
    do() {
      const prompt = $models.Prompt.new({
        itemType: 'task',
        itemId: 'task-123',
        message: 'Did you complete this?'
      });
      const desc = prompt.description();
      this.assert(desc.includes('⏳'), 'should show pending icon');
      this.assert(desc.includes('[task]'), 'should show item type');
      this.assert(desc.includes('Did you complete this?'), 'should show message');
    }
  });

  $test.Case.new({
    name: 'PromptPersistence',
    doc: 'Prompt should save and load from SQLite',
    do() {
      const database = createTestDb();

      const prompt = $models.Prompt.new({
        itemType: 'reminder',
        itemId: 'reminder-456',
        message: 'Follow up on this reminder',
        context: { importance: 'high' }
      });
      prompt.save(database);

      const found = $models.Prompt.findById(database, prompt.sid());
      this.assertEq(found.itemType(), 'reminder');
      this.assertEq(found.itemId(), 'reminder-456');
      this.assertEq(found.message(), 'Follow up on this reminder');
      this.assertEq(found.context().importance, 'high');
      this.assertEq(found.status(), 'pending');

      database.close();
    }
  });

  $test.Case.new({
    name: 'PromptStatusUpdate',
    doc: 'Prompt status and action should be mutable',
    do() {
      const database = createTestDb();

      const prompt = $models.Prompt.new({
        itemType: 'task',
        itemId: 'task-123',
        message: 'Test prompt'
      });
      prompt.save(database);

      prompt.status('actioned');
      prompt.action('done');
      prompt.actionedAt(new Date());
      prompt.save(database);

      const found = $models.Prompt.findById(database, prompt.sid());
      this.assertEq(found.status(), 'actioned');
      this.assertEq(found.action(), 'done');
      this.assert(found.actionedAt() instanceof Date, 'should have actionedAt');

      database.close();
    }
  });

  $test.Case.new({
    name: 'PromptSnooze',
    doc: 'Prompt should support snooze functionality',
    do() {
      const database = createTestDb();

      const prompt = $models.Prompt.new({
        itemType: 'task',
        itemId: 'task-123',
        message: 'Snoozeable prompt'
      });
      prompt.save(database);

      const snoozeTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prompt.action('snooze');
      prompt.snoozeUntil(snoozeTime);
      prompt.save(database);

      const found = $models.Prompt.findById(database, prompt.sid());
      this.assertEq(found.action(), 'snooze');
      this.assert(found.snoozeUntil() instanceof Date, 'should have snoozeUntil');

      database.close();
    }
  });

  $test.Case.new({
    name: 'PromptFindByStatus',
    doc: 'Prompt should be findable by status index',
    do() {
      const database = createTestDb();

      const prompt1 = $models.Prompt.new({ itemType: 'task', itemId: '1', message: 'Pending 1' });
      const prompt2 = $models.Prompt.new({ itemType: 'task', itemId: '2', message: 'Pending 2' });
      const prompt3 = $models.Prompt.new({ itemType: 'task', itemId: '3', message: 'Shown', status: 'shown' });
      prompt1.save(database);
      prompt2.save(database);
      prompt3.status('shown');
      prompt3.save(database);

      const pending = $models.Prompt.findByIndex(database, 'status', 'pending');
      this.assertEq(pending.length, 2);

      const shown = $models.Prompt.findByIndex(database, 'status', 'shown');
      this.assertEq(shown.length, 1);

      database.close();
    }
  });

  // PromptConfig model tests
  $test.Case.new({
    name: 'PromptConfigDefaults',
    doc: 'PromptConfig should have sensible defaults',
    do() {
      const config = $models.PromptConfig.new({});
      this.assertEq(config.key(), 'main');
      this.assertEq(config.promptFrequencyHours(), 8);
      this.assertEq(config.maxPromptsPerCycle(), 3);
      this.assertEq(config.taskStalenessDays(), 7);
      this.assertEq(config.responseHistory().length, 0);
    }
  });

  $test.Case.new({
    name: 'PromptConfigShouldGenerate',
    doc: 'PromptConfig.shouldGenerate should check time since last generation',
    do() {
      const config = $models.PromptConfig.new({});
      this.assert(config.shouldGenerate(), 'should generate when no lastGenerationAt');

      config.lastGenerationAt(new Date());
      this.assert(!config.shouldGenerate(), 'should not generate immediately after');

      const oldTime = new Date(Date.now() - 9 * 60 * 60 * 1000);
      config.lastGenerationAt(oldTime);
      this.assert(config.shouldGenerate(), 'should generate after frequency hours passed');
    }
  });

  $test.Case.new({
    name: 'PromptConfigRecordResponse',
    doc: 'PromptConfig should record responses with history limit',
    do() {
      const config = $models.PromptConfig.new({});

      config.recordResponse({ promptId: '1', action: 'done', itemType: 'task' });
      config.recordResponse({ promptId: '2', action: 'dismiss', itemType: 'task' });

      this.assertEq(config.responseHistory().length, 2);
      this.assertEq(config.responseHistory()[0].action, 'done');
      this.assert(config.responseHistory()[0].timestamp, 'should have timestamp');
    }
  });

  $test.Case.new({
    name: 'PromptConfigHistoryLimit',
    doc: 'PromptConfig response history should be limited to 100 entries',
    do() {
      const config = $models.PromptConfig.new({});

      for (let i = 0; i < 105; i++) {
        config.recordResponse({ promptId: String(i), action: 'done' });
      }

      this.assertEq(config.responseHistory().length, 100);
      this.assertEq(config.responseHistory()[0].promptId, '5');
    }
  });

  $test.Case.new({
    name: 'PromptConfigPersistence',
    doc: 'PromptConfig should save and load from SQLite',
    do() {
      const database = createTestDb();

      const config = $models.PromptConfig.new({
        promptFrequencyHours: 12,
        maxPromptsPerCycle: 5
      });
      config.lastGenerationAt(new Date('2025-01-15T10:00:00Z'));
      config.recordResponse({ promptId: 'test', action: 'done' });
      config.save(database);

      const found = $models.PromptConfig.findById(database, config.sid());
      this.assertEq(found.key(), 'main');
      this.assertEq(found.promptFrequencyHours(), 12);
      this.assertEq(found.maxPromptsPerCycle(), 5);
      this.assert(found.lastGenerationAt() instanceof Date, 'should have lastGenerationAt');
      this.assertEq(found.responseHistory().length, 1);

      database.close();
    }
  });
}.module({
  name: 'test.models',
  imports: [base, test, db, sqlite, time, models],
}).load();
