import { Database } from 'bun:sqlite';
import { __, base } from 'simulabra';
import live from 'simulabra/live';
import db from 'simulabra/db';
import supervisor from '../supervisor.js';
import sqlite from '../sqlite.js';
import models from '../models.js';
import time from '../time.js';

export default await async function (_, $, $live, $db, $supervisor, $sqlite, $models, $time) {
  $.Class.new({
    name: 'DatabaseService',
    doc: 'CRUD operations for all item types using SQLite',
    slots: [
      $supervisor.AgendaService,
      $.Var.new({ name: 'db' }),
      $.Var.new({ name: 'dbPath', default: 'agenda.db' }),
      $.Var.new({ name: 'chatStream' }),
      $.Var.new({ name: 'eventStream' }),
      $.Method.new({
        name: 'initDatabase',
        doc: 'initialize SQLite database and run migrations',
        do() {
          if (!this.db()) {
            const dbPath = process.env.AGENDA_DB_PATH || this.dbPath();
            this.db(new Database(dbPath));
            this.tlog('opened SQLite database:', dbPath);
          }
          const runner = $db.MigrationRunner.new({ db: this.db() });
          for (const migration of $sqlite.AgendaMigrations.all()) {
            runner.register(migration);
          }
          const applied = runner.migrate();
          if (applied > 0) {
            this.tlog('applied', applied, 'migrations');
          }
          this.chatStream($db.SQLiteStream.new({
            db: this.db(),
            streamName: 'agenda:chat:main',
          }));
          this.eventStream($db.SQLiteStream.new({
            db: this.db(),
            streamName: 'agenda:events',
          }));
        }
      }),
      $.Method.new({
        name: 'publishEvent',
        doc: 'publish event to event stream',
        do(type, data) {
          this.eventStream().append({
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
        do({ content, tags = [] }) {
          const log = $models.Log.new({ content, tags });
          log.save(this.db());
          this.publishEvent('log.created', { id: log.sid() });
          return log.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'getLog',
        do({ id }) {
          const log = $models.Log.findById(this.db(), id);
          return log?.jsonify() ?? null;
        }
      }),
      $live.RpcMethod.new({
        name: 'listLogs',
        do({ limit = 50 } = {}) {
          const logs = $models.Log.findAll(this.db());
          const sorted = logs.sort((a, b) => b.timestamp() - a.timestamp());
          return sorted.slice(0, limit).map(l => l.jsonify());
        }
      }),

      // Task operations
      $live.RpcMethod.new({
        name: 'createTask',
        do({ title, priority = 3, dueDate = null, tags = [] }) {
          const task = $models.Task.new({
            title,
            priority,
            dueDate: dueDate ? new Date(dueDate) : null,
            tags
          });
          task.save(this.db());
          this.publishEvent('task.created', { id: task.sid() });
          return task.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'getTask',
        do({ id }) {
          const task = $models.Task.findById(this.db(), id);
          return task?.jsonify() ?? null;
        }
      }),
      $live.RpcMethod.new({
        name: 'completeTask',
        do({ id }) {
          const task = $models.Task.findById(this.db(), id);
          if (!task) {
            throw new Error(`Task not found: ${id}`);
          }
          task.complete();
          task.save(this.db());
          this.publishEvent('task.completed', { id: task.sid() });
          return task.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'listTasks',
        do(filter = {}) {
          const tasks = $models.Task.findAll(this.db());
          let filtered = tasks;

          if (filter.done !== undefined) {
            filtered = filtered.filter(t => t.done() === filter.done);
          }
          if (filter.priority !== undefined) {
            filtered = filtered.filter(t => t.priority() === filter.priority);
          }
          if (filter.maxPriority !== undefined) {
            filtered = filtered.filter(t => t.priority() <= filter.maxPriority);
          }
          if (filter.tag !== undefined) {
            filtered = filtered.filter(t => t.tags().includes(filter.tag));
          }

          return filtered
            .sort((a, b) => a.priority() - b.priority())
            .map(t => t.jsonify());
        }
      }),
      $live.RpcMethod.new({
        name: 'updateTask',
        doc: 'update a task by id',
        do({ id, title, priority, dueDate, tags }) {
          const task = $models.Task.findById(this.db(), id);
          if (!task) {
            throw new Error(`Task not found: ${id}`);
          }

          if (title !== undefined) task.title(title);
          if (priority !== undefined) task.priority(priority);
          if (dueDate !== undefined) task.dueDate(dueDate ? new Date(dueDate) : null);
          if (tags !== undefined) task.tags(tags);

          task.save(this.db());
          this.publishEvent('task.updated', { id: task.sid() });
          return task.jsonify();
        }
      }),

      // Reminder operations
      $live.RpcMethod.new({
        name: 'createReminder',
        do({ message, triggerAt, recurrence = null }) {
          const reminderData = {
            message,
            triggerAt: new Date(triggerAt)
          };
          if (recurrence) {
            reminderData.recurrence = $time.RecurrenceRule.new(recurrence);
          }
          const reminder = $models.Reminder.new(reminderData);
          reminder.save(this.db());
          this.publishEvent('reminder.created', { id: reminder.sid() });
          return reminder.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'getReminder',
        do({ id }) {
          const reminder = $models.Reminder.findById(this.db(), id);
          return reminder?.jsonify() ?? null;
        }
      }),
      $live.RpcMethod.new({
        name: 'getDueReminders',
        do() {
          const reminders = $models.Reminder.findAll(this.db());
          const due = reminders.filter(r => r.isDue());
          return due.map(r => r.jsonify());
        }
      }),
      $live.RpcMethod.new({
        name: 'markReminderSent',
        do({ id }) {
          const reminder = $models.Reminder.findById(this.db(), id);
          if (!reminder) {
            throw new Error(`Reminder not found: ${id}`);
          }
          reminder.markSent();
          reminder.save(this.db());
          this.publishEvent('reminder.sent', { id: reminder.sid() });

          // Create next occurrence if recurring
          const next = reminder.createNextOccurrence();
          if (next) {
            next.save(this.db());
            this.publishEvent('reminder.created', { id: next.sid(), recurring: true });
          }

          return reminder.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'listReminders',
        do(filter = {}) {
          const reminders = $models.Reminder.findAll(this.db());
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
        do({ query }) {
          const q = query.toLowerCase();
          const matchAll = q === '*' || q === '';

          const logs = $models.Log.findAll(this.db());
          const matchingLogs = matchAll ? logs : logs.filter(l =>
            l.content().toLowerCase().includes(q) ||
            l.tags().some(t => t.toLowerCase().includes(q))
          );

          const tasks = $models.Task.findAll(this.db());
          const matchingTasks = matchAll ? tasks : tasks.filter(t =>
            t.title().toLowerCase().includes(q) ||
            t.tags().some(tag => tag.toLowerCase().includes(q))
          );

          const reminders = $models.Reminder.findAll(this.db());
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

      // Chat message operations
      $.Method.new({
        name: 'getChatStream',
        doc: 'get or create a chat stream for a conversation',
        do(conversationId = 'main') {
          if (conversationId === 'main') {
            return this.chatStream();
          }
          return $db.SQLiteStream.new({
            db: this.db(),
            streamName: 'agenda:chat:' + conversationId,
          });
        }
      }),

      $.Method.new({
        name: 'parseStreamEntry',
        doc: 'parse a stream entry into a chat message object',
        do(entry) {
          const message = entry.message;
          return {
            id: entry.id,
            internalId: entry.internalId,
            conversationId: message.conversationId,
            role: message.role,
            content: message.content,
            source: message.source,
            createdAt: message.createdAt,
            clientUid: message.clientUid || null,
            clientMessageId: message.clientMessageId || null,
            meta: message.meta ? (typeof message.meta === 'string' ? JSON.parse(message.meta) : message.meta) : null,
          };
        }
      }),

      $live.RpcMethod.new({
        name: 'appendChatMessage',
        doc: 'append a message to the chat stream',
        do(message) {
          const { conversationId = 'main', role, content, source, clientUid, clientMessageId, meta } = message;
          const stream = this.getChatStream(conversationId);
          const createdAt = new Date().toISOString();

          const entry = {
            type: 'chat.message',
            conversationId,
            role,
            content,
            source,
            createdAt,
          };
          if (clientUid) entry.clientUid = clientUid;
          if (clientMessageId) entry.clientMessageId = clientMessageId;
          if (meta) entry.meta = JSON.stringify(meta);

          const id = stream.append(entry);

          return {
            id,
            conversationId,
            role,
            content,
            source,
            createdAt,
            clientUid: clientUid || null,
            clientMessageId: clientMessageId || null,
            meta: meta || null,
          };
        }
      }),

      $live.RpcMethod.new({
        name: 'listChatMessages',
        doc: 'list recent chat messages (newest limit messages, returned oldest→newest)',
        do({ conversationId = 'main', limit = 100 } = {}) {
          const stream = this.getChatStream(conversationId);
          const entries = stream.readLatest(limit);
          const messages = entries.map(e => this.parseStreamEntry(e));
          return messages.reverse();
        }
      }),

      $live.RpcMethod.new({
        name: 'readChatMessages',
        doc: 'read chat messages after a given internal id (non-blocking)',
        do({ conversationId = 'main', afterId = 0, limit = 100 } = {}) {
          const stream = this.getChatStream(conversationId);
          const entries = stream.readAfter(afterId, limit);
          return entries.map(e => this.parseStreamEntry(e));
        }
      }),

      $live.RpcMethod.new({
        name: 'waitForChatMessages',
        doc: 'polling wait for new chat messages after a given internal id',
        async do({ conversationId = 'main', afterId = 0, timeoutMs = 20000, limit = 100 } = {}) {
          const stream = this.getChatStream(conversationId);
          const pollInterval = 200;
          const startTime = Date.now();

          while (Date.now() - startTime < timeoutMs) {
            const entries = stream.readAfter(afterId, limit);
            if (entries.length > 0) {
              return entries.map(e => this.parseStreamEntry(e));
            }
            await __.sleep(pollInterval);
          }
          return [];
        }
      }),

      $live.RpcMethod.new({
        name: 'getLastChatInternalId',
        doc: 'get the last internal id for a conversation (for polling)',
        do({ conversationId = 'main' } = {}) {
          const stream = this.getChatStream(conversationId);
          return stream.getLastInternalId();
        }
      }),

      // Prompt operations
      $live.RpcMethod.new({
        name: 'createPrompt',
        doc: 'create a new prompt for surfacing actionable items',
        do({ itemType, itemId, message, context = null, status = 'pending' }) {
          const prompt = $models.Prompt.new({
            itemType,
            itemId,
            message,
            context,
            status
          });
          prompt.save(this.db());
          this.publishEvent('prompt.created', { id: prompt.sid() });
          return prompt.jsonify();
        }
      }),

      $live.RpcMethod.new({
        name: 'getPrompt',
        doc: 'get a single prompt by id',
        do({ id }) {
          const prompt = $models.Prompt.findById(this.db(), id);
          return prompt?.jsonify() ?? null;
        }
      }),

      $live.RpcMethod.new({
        name: 'listPrompts',
        doc: 'list prompts with optional status filter',
        do({ status, limit = 50 } = {}) {
          let prompts = $models.Prompt.findAll(this.db());

          if (status !== undefined) {
            prompts = prompts.filter(p => p.status() === status);
          }

          return prompts
            .sort((a, b) => b.generatedAt() - a.generatedAt())
            .slice(0, limit)
            .map(p => p.jsonify());
        }
      }),

      $live.RpcMethod.new({
        name: 'updatePrompt',
        doc: 'update a prompt by id',
        do({ id, status, action, shownAt, actionedAt, snoozeUntil }) {
          const prompt = $models.Prompt.findById(this.db(), id);
          if (!prompt) {
            throw new Error(`Prompt not found: ${id}`);
          }

          if (status !== undefined) prompt.status(status);
          if (action !== undefined) prompt.action(action);
          if (shownAt !== undefined) prompt.shownAt(shownAt ? new Date(shownAt) : null);
          if (actionedAt !== undefined) prompt.actionedAt(actionedAt ? new Date(actionedAt) : null);
          if (snoozeUntil !== undefined) prompt.snoozeUntil(snoozeUntil ? new Date(snoozeUntil) : null);

          prompt.save(this.db());
          this.publishEvent('prompt.updated', { id: prompt.sid(), status: prompt.status() });
          return prompt.jsonify();
        }
      }),

      $live.RpcMethod.new({
        name: 'getPromptConfig',
        doc: 'get the prompt configuration (creates default if not exists)',
        do({ key = 'main' } = {}) {
          const rows = this.db().query('SELECT * FROM agenda_PromptConfig WHERE key = $key').all({ $key: key });
          if (rows.length > 0) {
            return $models.PromptConfig.fromSQLRow(rows[0]).jsonify();
          }
          const config = $models.PromptConfig.new({ key });
          config.save(this.db());
          return config.jsonify();
        }
      }),

      $live.RpcMethod.new({
        name: 'hasActivePendingPrompt',
        doc: 'check if a pending prompt exists for the given itemType/itemId pair',
        do({ itemType, itemId }) {
          const stmt = this.db().query(
            'SELECT 1 FROM agenda_Prompt WHERE itemType = $itemType AND itemId = $itemId AND status = $status LIMIT 1'
          );
          const row = stmt.get({ $itemType: itemType, $itemId: itemId, $status: 'pending' });
          return row !== null;
        }
      }),

      $live.RpcMethod.new({
        name: 'updatePromptConfig',
        doc: 'update the prompt configuration',
        do({ key = 'main', promptFrequencyHours, maxPromptsPerCycle, taskStalenessDays, lastGenerationAt, responseHistory }) {
          const rows = this.db().query('SELECT * FROM agenda_PromptConfig WHERE key = $key').all({ $key: key });
          let config;
          if (rows.length > 0) {
            config = $models.PromptConfig.fromSQLRow(rows[0]);
          } else {
            config = $models.PromptConfig.new({ key });
          }

          if (promptFrequencyHours !== undefined) config.promptFrequencyHours(promptFrequencyHours);
          if (maxPromptsPerCycle !== undefined) config.maxPromptsPerCycle(maxPromptsPerCycle);
          if (taskStalenessDays !== undefined) config.taskStalenessDays(taskStalenessDays);
          if (lastGenerationAt !== undefined) config.lastGenerationAt(lastGenerationAt ? new Date(lastGenerationAt) : null);
          if (responseHistory !== undefined) config.responseHistory(responseHistory);

          config.save(this.db());
          return config.jsonify();
        }
      }),
    ]
  });

  if (import.meta.main) {
    await __.sleep(50);
    const service = _.DatabaseService.new();
    service.initDatabase();
    await service.connect();
    __.tlog('DatabaseService connected and ready');
  }
}.module({
  name: 'services.database',
  imports: [base, live, db, supervisor, sqlite, models, time],
}).load();
