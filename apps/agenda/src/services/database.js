import { __, base } from 'simulabra';
import live from 'simulabra/live';
import supervisor from '../supervisor.js';
import redis from '../redis.js';
import models from '../models.js';

export default await async function (_, $, $live, $supervisor, $redis, $models) {
  $.Class.new({
    name: 'DatabaseService',
    doc: 'CRUD operations for all item types',
    slots: [
      $supervisor.AgendaService,
      $.Var.new({ name: 'redis' }),
      $.Var.new({ name: 'eventStream', default: 'agenda:events' }),
      $.Method.new({
        name: 'connectRedis',
        doc: 'connect to Redis (call after init)',
        async do() {
          if (!this.redis()) {
            this.redis($redis.RedisClient.new({
              url: process.env.AGENDA_REDIS_URL || 'redis://localhost:6379'
            }));
          }
          if (!this.redis().connected()) {
            await this.redis().connect();
            this.tlog('connected to Redis');
          }
        }
      }),
      $.Method.new({
        name: 'publishEvent',
        doc: 'publish event to Redis Stream',
        async do(type, data) {
          await this.redis().streamAdd(this.eventStream(), {
            type,
            timestamp: new Date().toISOString(),
            ...data
          });
        }
      }),

      // Health check
      $live.RpcMethod.new({
        name: 'health',
        do() {
          return { status: 'ok', service: 'DatabaseService' };
        }
      }),

      // Log operations
      $live.RpcMethod.new({
        name: 'createLog',
        async do(content, tags = []) {
          const log = $models.Log.new({ content, tags });
          await log.save(this.redis());
          await this.publishEvent('log.created', { id: log.rid() });
          return log.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'getLog',
        async do(id) {
          const log = await $models.Log.findById(this.redis(), id);
          return log?.jsonify() ?? null;
        }
      }),
      $live.RpcMethod.new({
        name: 'listLogs',
        async do(limit = 50) {
          const logs = await $models.Log.findAll(this.redis());
          const sorted = logs.sort((a, b) => b.timestamp() - a.timestamp());
          return sorted.slice(0, limit).map(l => l.jsonify());
        }
      }),

      // Task operations
      $live.RpcMethod.new({
        name: 'createTask',
        async do(title, priority = 3, dueDate = null, tags = []) {
          const task = $models.Task.new({
            title,
            priority,
            dueDate: dueDate ? new Date(dueDate) : null,
            tags
          });
          await task.save(this.redis());
          await this.publishEvent('task.created', { id: task.rid() });
          return task.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'getTask',
        async do(id) {
          const task = await $models.Task.findById(this.redis(), id);
          return task?.jsonify() ?? null;
        }
      }),
      $live.RpcMethod.new({
        name: 'completeTask',
        async do(id) {
          const task = await $models.Task.findById(this.redis(), id);
          if (!task) {
            throw new Error(`Task not found: ${id}`);
          }
          task.complete();
          await task.save(this.redis());
          await this.publishEvent('task.completed', { id: task.rid() });
          return task.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'listTasks',
        async do(filter = {}) {
          const tasks = await $models.Task.findAll(this.redis());
          let filtered = tasks;

          if (filter.done !== undefined) {
            filtered = filtered.filter(t => t.done() === filter.done);
          }
          if (filter.priority !== undefined) {
            filtered = filtered.filter(t => t.priority() === filter.priority);
          }
          if (filter.tag !== undefined) {
            filtered = filtered.filter(t => t.tags().includes(filter.tag));
          }

          return filtered
            .sort((a, b) => a.priority() - b.priority())
            .map(t => t.jsonify());
        }
      }),

      // Reminder operations
      $live.RpcMethod.new({
        name: 'createReminder',
        async do(message, triggerAt, recurrence = null) {
          const reminderData = {
            message,
            triggerAt: new Date(triggerAt)
          };
          if (recurrence) {
            reminderData.recurrence = $models.RecurrenceRule.new(recurrence);
          }
          const reminder = $models.Reminder.new(reminderData);
          await reminder.save(this.redis());
          await this.publishEvent('reminder.created', { id: reminder.rid() });
          return reminder.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'getReminder',
        async do(id) {
          const reminder = await $models.Reminder.findById(this.redis(), id);
          return reminder?.jsonify() ?? null;
        }
      }),
      $live.RpcMethod.new({
        name: 'getDueReminders',
        async do() {
          const reminders = await $models.Reminder.findAll(this.redis());
          const due = reminders.filter(r => r.isDue());
          return due.map(r => r.jsonify());
        }
      }),
      $live.RpcMethod.new({
        name: 'markReminderSent',
        async do(id) {
          const reminder = await $models.Reminder.findById(this.redis(), id);
          if (!reminder) {
            throw new Error(`Reminder not found: ${id}`);
          }
          reminder.markSent();
          await reminder.save(this.redis());
          await this.publishEvent('reminder.sent', { id: reminder.rid() });

          // Create next occurrence if recurring
          const next = reminder.createNextOccurrence();
          if (next) {
            await next.save(this.redis());
            await this.publishEvent('reminder.created', { id: next.rid(), recurring: true });
          }

          return reminder.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'listReminders',
        async do(filter = {}) {
          const reminders = await $models.Reminder.findAll(this.redis());
          let filtered = reminders;

          if (filter.sent !== undefined) {
            filtered = filtered.filter(r => r.sent() === filter.sent);
          }

          return filtered
            .sort((a, b) => a.triggerAt() - b.triggerAt())
            .map(r => r.jsonify());
        }
      }),

      // Search
      $live.RpcMethod.new({
        name: 'search',
        async do(query) {
          const q = query.toLowerCase();
          const matchAll = q === '*' || q === '';

          const logs = await $models.Log.findAll(this.redis());
          const matchingLogs = matchAll ? logs : logs.filter(l =>
            l.content().toLowerCase().includes(q) ||
            l.tags().some(t => t.toLowerCase().includes(q))
          );

          const tasks = await $models.Task.findAll(this.redis());
          const matchingTasks = matchAll ? tasks : tasks.filter(t =>
            t.title().toLowerCase().includes(q) ||
            t.tags().some(tag => tag.toLowerCase().includes(q))
          );

          const reminders = await $models.Reminder.findAll(this.redis());
          const matchingReminders = matchAll ? reminders : reminders.filter(r =>
            r.message().toLowerCase().includes(q)
          );

          return {
            logs: matchingLogs.map(l => l.jsonify()),
            tasks: matchingTasks.map(t => t.jsonify()),
            reminders: matchingReminders.map(r => r.jsonify())
          };
        }
      }),
    ]
  });

  if (import.meta.main) {
    await __.sleep(50);
    const service = _.DatabaseService.new();
    await service.connectRedis();
    await service.connect();
    __.tlog('DatabaseService connected and ready');
  }
}.module({
  name: 'services.database',
  imports: [base, live, supervisor, redis, models],
}).load();
