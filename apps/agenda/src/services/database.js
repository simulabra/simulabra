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
        do({ content, tags = [], projectId = null }) {
          const log = $models.Log.new({ content, tags, projectId });
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
        do({ limit = 50, projectId } = {}) {
          let logs = $models.Log.findAll(this.db());
          if (projectId === null) {
            logs = logs.filter(l => !l.projectId());
          } else if (projectId !== undefined) {
            logs = logs.filter(l => l.projectId() === projectId);
          }
          const sorted = logs.sort((a, b) => b.timestamp() - a.timestamp());
          return sorted.slice(0, limit).map(l => l.jsonify());
        }
      }),

      // Task operations
      $live.RpcMethod.new({
        name: 'createTask',
        do({ title, priority = 3, dueDate = null, tags = [], projectId = null }) {
          const task = $models.Task.new({
            title,
            priority,
            dueDate: dueDate ? new Date(dueDate) : null,
            tags,
            projectId
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
        name: 'toggleTask',
        doc: 'toggle a task between done and not-done',
        do({ id }) {
          const task = $models.Task.findById(this.db(), id);
          if (!task) {
            throw new Error(`Task not found: ${id}`);
          }
          task.toggle();
          task.save(this.db());
          const eventType = task.done() ? 'task.completed' : 'task.uncompleted';
          this.publishEvent(eventType, { id: task.sid() });
          return task.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'listTasks',
        do(filter = {}) {
          const tasks = $models.Task.findAll(this.db());
          let filtered = tasks;

          if (filter.projectId === null) {
            filtered = filtered.filter(t => !t.projectId());
          } else if (filter.projectId !== undefined) {
            filtered = filtered.filter(t => t.projectId() === filter.projectId);
          }
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
        do({ id, title, priority, dueDate, tags, projectId }) {
          const task = $models.Task.findById(this.db(), id);
          if (!task) {
            throw new Error(`Task not found: ${id}`);
          }

          if (title !== undefined) task.title(title);
          if (priority !== undefined) task.priority(priority);
          if (dueDate !== undefined) task.dueDate(dueDate ? new Date(dueDate) : null);
          if (tags !== undefined) task.tags(tags);
          if (projectId !== undefined) task.projectId(projectId);

          task.save(this.db());
          this.publishEvent('task.updated', { id: task.sid() });
          return task.jsonify();
        }
      }),

      // Reminder operations
      $live.RpcMethod.new({
        name: 'createReminder',
        do({ message, triggerAt, recurrence = null, projectId = null }) {
          const reminderData = {
            message,
            triggerAt: new Date(triggerAt),
            projectId
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

          if (filter.projectId === null) {
            filtered = filtered.filter(r => !r.projectId());
          } else if (filter.projectId !== undefined) {
            filtered = filtered.filter(r => r.projectId() === filter.projectId);
          }
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
        name: 'hideChatMessages',
        doc: 'hide chat messages by internal ids or by time window',
        do({ conversationId = 'main', internalIds, sinceMinutes } = {}) {
          const stream = this.getChatStream(conversationId);
          if (internalIds && internalIds.length > 0) {
            const count = stream.hideEntries(internalIds);
            return { hidden: count };
          }
          if (sinceMinutes) {
            const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
            const count = stream.hideEntriesSince(since);
            return { hidden: count };
          }
          return { hidden: 0 };
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

      // Haunt operations
      $live.RpcMethod.new({
        name: 'createHaunt',
        doc: 'create a new haunt for surfacing actionable items',
        do({ itemType, itemId, message, context = null, actions = null, status = 'pending' }) {
          const haunt = $models.Haunt.new({
            itemType,
            itemId,
            message,
            context,
            actions,
            status
          });
          haunt.save(this.db());
          this.publishEvent('haunt.created', { id: haunt.sid() });
          return haunt.jsonify();
        }
      }),

      $live.RpcMethod.new({
        name: 'getHaunt',
        doc: 'get a single haunt by id',
        do({ id }) {
          const haunt = $models.Haunt.findById(this.db(), id);
          return haunt?.jsonify() ?? null;
        }
      }),

      $live.RpcMethod.new({
        name: 'listHaunts',
        doc: 'list haunts with optional status filter',
        do({ status, limit = 50 } = {}) {
          let haunts = $models.Haunt.findAll(this.db());

          if (status !== undefined) {
            haunts = haunts.filter(h => h.status() === status);
          }

          return haunts
            .sort((a, b) => b.generatedAt() - a.generatedAt())
            .slice(0, limit)
            .map(h => h.jsonify());
        }
      }),

      $live.RpcMethod.new({
        name: 'updateHaunt',
        doc: 'update a haunt by id',
        do({ id, status, action, actions, shownAt, actionedAt, snoozeUntil }) {
          const haunt = $models.Haunt.findById(this.db(), id);
          if (!haunt) {
            throw new Error(`Haunt not found: ${id}`);
          }

          if (status !== undefined) haunt.status(status);
          if (action !== undefined) haunt.action(action);
          if (actions !== undefined) haunt.actions(actions);
          if (shownAt !== undefined) haunt.shownAt(shownAt ? new Date(shownAt) : null);
          if (actionedAt !== undefined) haunt.actionedAt(actionedAt ? new Date(actionedAt) : null);
          if (snoozeUntil !== undefined) haunt.snoozeUntil(snoozeUntil ? new Date(snoozeUntil) : null);

          haunt.save(this.db());
          this.publishEvent('haunt.updated', { id: haunt.sid(), status: haunt.status() });
          return haunt.jsonify();
        }
      }),

      $live.RpcMethod.new({
        name: 'getHauntConfig',
        doc: 'get the haunt configuration (creates default if not exists)',
        do({ key = 'main' } = {}) {
          const rows = this.db().query('SELECT * FROM agenda_HauntConfig WHERE key = $key').all({ $key: key });
          if (rows.length > 0) {
            return $models.HauntConfig.fromSQLRow(rows[0]).jsonify();
          }
          const config = $models.HauntConfig.new({ key });
          config.save(this.db());
          return config.jsonify();
        }
      }),

      $live.RpcMethod.new({
        name: 'hasActivePendingHaunt',
        doc: 'check if a pending haunt exists for the given itemType/itemId pair',
        do({ itemType, itemId }) {
          const stmt = this.db().query(
            'SELECT 1 FROM agenda_Haunt WHERE itemType = $itemType AND itemId = $itemId AND status = $status LIMIT 1'
          );
          const row = stmt.get({ $itemType: itemType, $itemId: itemId, $status: 'pending' });
          return row !== null;
        }
      }),

      $live.RpcMethod.new({
        name: 'updateHauntConfig',
        doc: 'update the haunt configuration',
        do({ key = 'main', hauntFrequencyHours, maxHauntsPerCycle, taskStalenessDays, lastGenerationAt, responseHistory }) {
          const rows = this.db().query('SELECT * FROM agenda_HauntConfig WHERE key = $key').all({ $key: key });
          let config;
          if (rows.length > 0) {
            config = $models.HauntConfig.fromSQLRow(rows[0]);
          } else {
            config = $models.HauntConfig.new({ key });
          }

          if (hauntFrequencyHours !== undefined) config.hauntFrequencyHours(hauntFrequencyHours);
          if (maxHauntsPerCycle !== undefined) config.maxHauntsPerCycle(maxHauntsPerCycle);
          if (taskStalenessDays !== undefined) config.taskStalenessDays(taskStalenessDays);
          if (lastGenerationAt !== undefined) config.lastGenerationAt(lastGenerationAt ? new Date(lastGenerationAt) : null);
          if (responseHistory !== undefined) config.responseHistory(responseHistory);

          config.save(this.db());
          return config.jsonify();
        }
      }),

      // Project operations
      $live.RpcMethod.new({
        name: 'createProject',
        doc: 'create a new project with title, slug, and optional context',
        do({ title, slug, context = null, archived = false }) {
          const project = $models.Project.new({ title, slug, context, archived });
          project.save(this.db());
          this.publishEvent('project.created', { id: project.sid() });
          return project.jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'getProject',
        doc: 'get a project by id',
        do({ id }) {
          const project = $models.Project.findById(this.db(), id);
          return project?.jsonify() ?? null;
        }
      }),
      $live.RpcMethod.new({
        name: 'getProjectBySlug',
        doc: 'get a project by its unique slug via direct SQL lookup',
        do({ slug }) {
          const row = this.db().query('SELECT * FROM agenda_Project WHERE slug = $slug').get({ $slug: slug });
          if (!row) return null;
          return $models.Project.fromSQLRow(row).jsonify();
        }
      }),
      $live.RpcMethod.new({
        name: 'listProjects',
        doc: 'list projects with optional archived filter, sorted by title',
        do({ archived } = {}) {
          let projects = $models.Project.findAll(this.db());
          if (archived !== undefined) {
            projects = projects.filter(p => p.archived() === archived);
          }
          return projects
            .sort((a, b) => a.title().localeCompare(b.title()))
            .map(p => p.jsonify());
        }
      }),
      $live.RpcMethod.new({
        name: 'updateProject',
        doc: 'update a project by id',
        do({ id, title, slug, context, archived }) {
          const project = $models.Project.findById(this.db(), id);
          if (!project) {
            throw new Error(`Project not found: ${id}`);
          }
          if (title !== undefined) project.title(title);
          if (slug !== undefined) project.slug(slug);
          if (context !== undefined) project.context(context);
          if (archived !== undefined) project.archived(archived);
          project.save(this.db());
          this.publishEvent('project.updated', { id: project.sid() });
          return project.jsonify();
        }
      }),

      $live.RpcMethod.new({
        name: 'updateLog',
        doc: 'update a log by id',
        do({ id, projectId }) {
          const log = $models.Log.findById(this.db(), id);
          if (!log) {
            throw new Error(`Log not found: ${id}`);
          }
          if (projectId !== undefined) log.projectId(projectId);
          log.save(this.db());
          this.publishEvent('log.updated', { id: log.sid() });
          return log.jsonify();
        }
      }),

      $live.RpcMethod.new({
        name: 'updateReminder',
        doc: 'update a reminder by id',
        do({ id, projectId }) {
          const reminder = $models.Reminder.findById(this.db(), id);
          if (!reminder) {
            throw new Error(`Reminder not found: ${id}`);
          }
          if (projectId !== undefined) reminder.projectId(projectId);
          reminder.save(this.db());
          this.publishEvent('reminder.updated', { id: reminder.sid() });
          return reminder.jsonify();
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
