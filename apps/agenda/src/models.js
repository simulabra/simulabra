import { __, base } from 'simulabra';
import db from 'simulabra/db';
import sqlite from './sqlite.js';
import time from './time.js';

export default await async function (_, $, $db, $sqlite, $time) {
  $.Class.new({
    name: 'RecurrenceVar',
    doc: 'DBVar for RecurrenceRule fields — serializes via toJSON/fromJSON',
    slots: [
      $db.DBVar,
      $.Method.new({
        name: 'toSQL',
        override: true,
        do(value) { return value ? JSON.stringify(value.toJSON()) : null; },
      }),
      $.Method.new({
        name: 'fromSQL',
        override: true,
        do(value) { return value ? $time.RecurrenceRule.fromJSON(JSON.parse(value)) : null; },
      }),
    ]
  });

  $.Class.new({
    name: 'Log',
    doc: 'Journal entry with timestamp and optional tags',
    slots: [
      $sqlite.SQLitePersisted,
      $db.DBVar.new({
        name: 'content',
        doc: 'the journal entry text',
        searchable: true,
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'timestamp',
        doc: 'when the entry was created',
        indexed: true,
        mutable: true,
      }),
      $db.JSONVar.new({
        name: 'tags',
        doc: 'extracted or explicit tags',
        default: () => [],
        indexed: true,
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'projectId',
        doc: 'optional project reference',
        indexed: true,
        mutable: true,
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
      $sqlite.SQLitePersisted,
      $db.DBVar.new({
        name: 'title',
        doc: 'task description',
        searchable: true,
        mutable: true,
      }),
      $db.BoolVar.new({
        name: 'done',
        doc: 'whether the task is completed',
        default: false,
        indexed: true,
        mutable: true,
      }),
      $db.NumberVar.new({
        name: 'priority',
        doc: 'priority level (1=highest, 5=lowest)',
        default: 3,
        indexed: true,
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'dueDate',
        doc: 'optional deadline',
        indexed: true,
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'completedAt',
        doc: 'when the task was completed',
        mutable: true,
      }),
      $db.JSONVar.new({
        name: 'tags',
        doc: 'optional tags for categorization',
        default: () => [],
        indexed: true,
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'projectId',
        doc: 'optional project reference',
        indexed: true,
        mutable: true,
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
        name: 'toggle',
        doc: 'flip between done and not-done',
        do() {
          if (this.done()) {
            this.done(false);
            this.completedAt(null);
          } else {
            this.done(true);
            this.completedAt(new Date());
          }
          return this;
        }
      }),
      $.Method.new({
        name: 'description',
        do() {
          const status = this.done() ? '✓' : '○';
          const priority = `P${this.priority()}`;
          const due = this.dueDate() ? ` due:${this.dueDate().toISOString().split('T')[0]}` : '';
          const tags = this.tags().length > 0 ? ` [${this.tags().join(', ')}]` : '';
          return `${status} [${priority}] ${this.title()}${due}${tags}`;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'Reminder',
    doc: 'Scheduled notification with optional recurrence',
    slots: [
      $sqlite.SQLitePersisted,
      $db.DBVar.new({
        name: 'message',
        doc: 'what to remind about',
        searchable: true,
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'triggerAt',
        doc: 'when to trigger the reminder',
        indexed: true,
        mutable: true,
      }),
      _.RecurrenceVar.new({
        name: 'recurrence',
        doc: 'optional recurrence rule',
        mutable: true,
      }),
      $db.BoolVar.new({
        name: 'sent',
        doc: 'whether the reminder has been sent',
        default: false,
        indexed: true,
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'projectId',
        doc: 'optional project reference',
        indexed: true,
        mutable: true,
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

  $.Class.new({
    name: 'Haunt',
    doc: 'Proactive suggestion with context-specific action choices',
    slots: [
      $sqlite.SQLitePersisted,
      $db.DBVar.new({
        name: 'itemType',
        doc: 'type of related item: task/log/reminder',
        indexed: true,
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'itemId',
        doc: 'id of the related item',
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'message',
        doc: 'haunt text to display',
        searchable: true,
        mutable: true,
      }),
      $db.JSONVar.new({
        name: 'context',
        doc: 'context used for generation',
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'status',
        doc: 'haunt status: pending/shown/actioned/dismissed',
        default: 'pending',
        indexed: true,
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'action',
        doc: 'user action taken on this haunt',
        mutable: true,
      }),
      $db.JSONVar.new({
        name: 'actions',
        doc: 'LLM-generated action choices [{label, message}]',
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'generatedAt',
        doc: 'when the haunt was generated',
        indexed: true,
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'shownAt',
        doc: 'when the haunt was shown to user',
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'actionedAt',
        doc: 'when the user responded',
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'snoozeUntil',
        doc: 'for snoozed haunts, when to show again',
        mutable: true,
      }),
      $.After.new({
        name: 'init',
        do() {
          if (!this.generatedAt()) {
            this.generatedAt(new Date());
          }
        }
      }),
      $.Method.new({
        name: 'description',
        do() {
          const statusIcon = {
            pending: '👻',
            shown: '👁',
            actioned: '✓',
            dismissed: '✗'
          }[this.status()] || '?';
          return `${statusIcon} [${this.itemType()}] ${this.message()}`;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'HauntConfig',
    doc: 'Configuration for proactive haunting system',
    slots: [
      $sqlite.SQLitePersisted,
      $db.DBVar.new({
        name: 'key',
        doc: 'singleton identifier',
        default: 'main',
        mutable: true,
      }),
      $db.NumberVar.new({
        name: 'hauntFrequencyHours',
        doc: 'hours between generation cycles',
        default: 8,
        mutable: true,
      }),
      $db.NumberVar.new({
        name: 'maxHauntsPerCycle',
        doc: 'max haunts per generation',
        default: 3,
        mutable: true,
      }),
      $db.NumberVar.new({
        name: 'taskStalenessDays',
        doc: 'days before a task is considered stale',
        default: 7,
        mutable: true,
      }),
      $db.DateVar.new({
        name: 'lastGenerationAt',
        doc: 'last generation time',
        mutable: true,
      }),
      $db.JSONVar.new({
        name: 'responseHistory',
        doc: 'recent responses for learning',
        default: () => [],
        mutable: true,
      }),
      $.Method.new({
        name: 'shouldGenerate',
        doc: 'check if enough time has passed since last generation',
        do() {
          if (!this.lastGenerationAt()) {
            return true;
          }
          const hoursSince = (Date.now() - this.lastGenerationAt().getTime()) / (1000 * 60 * 60);
          return hoursSince >= this.hauntFrequencyHours();
        }
      }),
      $.Method.new({
        name: 'recordResponse',
        doc: 'record a user response to the history',
        do(response) {
          const history = this.responseHistory();
          history.push({
            ...response,
            timestamp: new Date().toISOString()
          });
          if (history.length > 100) {
            history.shift();
          }
          this.responseHistory(history);
          return this;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'Project',
    doc: 'Named project that groups tasks, logs, and reminders with shared context',
    slots: [
      $sqlite.SQLitePersisted,
      $db.DBVar.new({
        name: 'title',
        doc: 'human-readable project name',
        searchable: true,
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'slug',
        doc: 'unique URL-safe handle',
        indexed: true,
        mutable: true,
      }),
      $db.BoolVar.new({
        name: 'archived',
        doc: 'whether the project is archived',
        default: false,
        indexed: true,
        mutable: true,
      }),
      $db.DBVar.new({
        name: 'context',
        doc: 'freeform markdown context for Geist and humans',
        mutable: true,
      }),
      $.Method.new({
        name: 'description',
        do() {
          const suffix = this.archived() ? ' (archived)' : '';
          return `[${this.slug()}] ${this.title()}${suffix}`;
        }
      }),
    ]
  });
}.module({
  name: 'models',
  imports: [base, db, sqlite, time],
}).load();
