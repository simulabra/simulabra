import { __, base } from 'simulabra';
import redis from './redis.js';
import time from './time.js';

export default await async function (_, $, $redis, $time) {
  $.Class.new({
    name: 'Log',
    doc: 'Journal entry with timestamp and optional tags',
    slots: [
      $redis.RedisPersisted,
      $redis.RedisVar.new({
        name: 'content',
        doc: 'the journal entry text',
        searchable: true,
        required: true,
      }),
      $redis.RedisVar.new({
        name: 'timestamp',
        doc: 'when the entry was created',
        indexed: true,
        toRedis() { return this ? this.toISOString() : null; },
        fromRedis() { return this ? new Date(this) : null; },
      }),
      $redis.RedisVar.new({
        name: 'tags',
        doc: 'extracted or explicit tags',
        default: () => [],
        indexed: true,
        toRedis() { return JSON.stringify(this); },
        fromRedis() { return JSON.parse(this); },
      }),
      $.After.new({
        name: 'init',
        do() {
          if (!this.timestamp()) {
            this.timestamp(new Date());
          }
        }
      }),
      $.Method.new({
        name: 'description',
        do() {
          const tags = this.tags().length > 0 ? ` [${this.tags().join(', ')}]` : '';
          return `[${this.timestamp().toISOString()}] ${this.content()}${tags}`;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'Task',
    doc: 'Actionable item with priority and optional due date',
    slots: [
      $redis.RedisPersisted,
      $redis.RedisVar.new({
        name: 'title',
        doc: 'task description',
        searchable: true,
        required: true,
      }),
      $redis.RedisVar.new({
        name: 'done',
        doc: 'whether the task is completed',
        default: false,
        indexed: true,
        toRedis() { return this ? 'true' : 'false'; },
        fromRedis() { return this === 'true'; },
      }),
      $redis.RedisVar.new({
        name: 'priority',
        doc: 'priority level (1=highest, 5=lowest)',
        default: 3,
        indexed: true,
        toRedis() { return String(this); },
        fromRedis() { return Number(this); },
      }),
      $redis.RedisVar.new({
        name: 'dueDate',
        doc: 'optional deadline',
        indexed: true,
        toRedis() { return this ? this.toISOString() : null; },
        fromRedis() { return this ? new Date(this) : null; },
      }),
      $redis.RedisVar.new({
        name: 'completedAt',
        doc: 'when the task was completed',
        toRedis() { return this ? this.toISOString() : null; },
        fromRedis() { return this ? new Date(this) : null; },
      }),
      $.Method.new({
        name: 'complete',
        doc: 'mark the task as done',
        do() {
          this.done(true);
          this.completedAt(new Date());
          return this;
        }
      }),
      $.Method.new({
        name: 'description',
        do() {
          const status = this.done() ? '✓' : '○';
          const priority = `P${this.priority()}`;
          const due = this.dueDate() ? ` due:${this.dueDate().toISOString().split('T')[0]}` : '';
          return `${status} [${priority}] ${this.title()}${due}`;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'RecurrenceRule',
    doc: 'Rule for recurring reminders',
    slots: [
      $.EnumVar.new({
        name: 'pattern',
        doc: 'recurrence pattern',
        choices: ['daily', 'weekly', 'monthly'],
        required: true,
      }),
      $.Var.new({
        name: 'interval',
        doc: 'repeat every N units',
        default: 1,
      }),
      $.Var.new({
        name: 'daysOfWeek',
        doc: 'for weekly: which days (0=Sun, 6=Sat)',
        default: () => [],
      }),
      $.Var.new({
        name: 'endDate',
        doc: 'optional end date for recurrence',
      }),
      $.Method.new({
        name: 'nextOccurrence',
        doc: 'calculate the next trigger time from a given date using UTC arithmetic',
        do(fromDate) {
          const TP = $time.TimePolicy;
          let date = new Date(fromDate);

          if (this.endDate() && date > TP.endOfDay(this.endDate())) {
            return null;
          }

          switch (this.pattern()) {
            case 'daily':
              date = TP.addDays(date, this.interval());
              break;
            case 'weekly':
              if (this.daysOfWeek().length > 0) {
                const currentDay = TP.getDayOfWeek(date);
                const sortedDays = [...this.daysOfWeek()].sort((a, b) => a - b);
                const nextDay = sortedDays.find(d => d > currentDay);
                if (nextDay !== undefined) {
                  date = TP.addDays(date, nextDay - currentDay);
                } else {
                  const daysUntilFirst = 7 - currentDay + sortedDays[0];
                  date = TP.addDays(date, daysUntilFirst + 7 * (this.interval() - 1));
                }
              } else {
                date = TP.addWeeks(date, this.interval());
              }
              break;
            case 'monthly':
              date = TP.addMonths(date, this.interval());
              break;
          }

          if (this.endDate() && date > TP.endOfDay(this.endDate())) {
            return null;
          }

          return date;
        }
      }),
      $.Method.new({
        name: 'toJSON',
        do() {
          return {
            pattern: this.pattern(),
            interval: this.interval(),
            daysOfWeek: this.daysOfWeek(),
            endDate: this.endDate()?.toISOString(),
          };
        }
      }),
      $.Static.new({
        name: 'fromJSON',
        do(json) {
          return _.RecurrenceRule.new({
            pattern: json.pattern,
            interval: json.interval || 1,
            daysOfWeek: json.daysOfWeek || [],
            endDate: json.endDate ? new Date(json.endDate) : undefined,
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: 'Reminder',
    doc: 'Scheduled notification with optional recurrence',
    slots: [
      $redis.RedisPersisted,
      $redis.RedisVar.new({
        name: 'message',
        doc: 'what to remind about',
        searchable: true,
        required: true,
      }),
      $redis.RedisVar.new({
        name: 'triggerAt',
        doc: 'when to trigger the reminder',
        indexed: true,
        required: true,
        toRedis() { return this ? this.toISOString() : null; },
        fromRedis() { return this ? new Date(this) : null; },
      }),
      $redis.RedisVar.new({
        name: 'recurrence',
        doc: 'optional recurrence rule (JSON)',
        toRedis() { return this ? JSON.stringify(this.toJSON()) : null; },
        fromRedis() { return this ? _.RecurrenceRule.fromJSON(JSON.parse(this)) : null; },
      }),
      $redis.RedisVar.new({
        name: 'sent',
        doc: 'whether the reminder has been sent',
        default: false,
        indexed: true,
        toRedis() { return this ? 'true' : 'false'; },
        fromRedis() { return this === 'true'; },
      }),
      $.Method.new({
        name: 'isDue',
        doc: 'check if the reminder is due',
        do() {
          return !this.sent() && new Date() >= this.triggerAt();
        }
      }),
      $.Method.new({
        name: 'markSent',
        doc: 'mark the reminder as sent',
        do() {
          this.sent(true);
          return this;
        }
      }),
      $.Method.new({
        name: 'createNextOccurrence',
        doc: 'create the next reminder if recurring',
        do() {
          if (!this.recurrence()) {
            return null;
          }
          const nextTrigger = this.recurrence().nextOccurrence(this.triggerAt());
          if (!nextTrigger) {
            return null;
          }
          return _.Reminder.new({
            message: this.message(),
            triggerAt: nextTrigger,
            recurrence: this.recurrence(),
          });
        }
      }),
      $.Method.new({
        name: 'description',
        do() {
          const status = this.sent() ? '✓' : '⏰';
          const recurring = this.recurrence() ? ` (${this.recurrence().pattern()})` : '';
          return `${status} ${this.triggerAt().toISOString()} - ${this.message()}${recurring}`;
        }
      }),
    ]
  });
}.module({
  name: 'models',
  imports: [base, redis, time],
}).load();
