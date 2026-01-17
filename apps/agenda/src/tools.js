import { __, base } from 'simulabra';
import tools from 'simulabra/tools';

export default await async function (_, $, $tools) {
  $.Class.new({
    name: 'CreateLogTool',
    doc: 'Tool for creating journal/log entries',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'create_log' }),
      $.Var.new({
        name: 'doc',
        default: 'Create a journal/log entry to record thoughts, notes, or events',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The content of the log entry'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorization'
            }
          },
          required: ['content']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.createLog(args.content, args.tags || []);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'CreateTaskTool',
    doc: 'Tool for creating tasks/todo items',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'create_task' }),
      $.Var.new({
        name: 'doc',
        default: 'Create a new task/todo item',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The task description'
            },
            priority: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Priority level (1=highest, 5=lowest). Default is 3'
            },
            dueDate: {
              type: 'string',
              description: 'Optional due date in ISO 8601 format'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorization'
            }
          },
          required: ['title']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.createTask(args.title, args.priority || 3, args.dueDate || null, args.tags || []);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'CompleteTaskTool',
    doc: 'Tool for marking tasks as completed',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'complete_task' }),
      $.Var.new({
        name: 'doc',
        default: 'Mark a task as completed',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The task ID to complete'
            }
          },
          required: ['id']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.completeTask(args.id);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'CreateReminderTool',
    doc: 'Tool for creating scheduled reminders',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'create_reminder' }),
      $.Var.new({
        name: 'doc',
        default: 'Create a reminder for a specific time',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'What to remind about'
            },
            when: {
              type: 'string',
              description: 'When to trigger the reminder (ISO 8601 format)'
            },
            recurrence: {
              type: 'object',
              description: 'Optional recurrence rule',
              properties: {
                pattern: {
                  type: 'string',
                  enum: ['daily', 'weekly', 'monthly']
                },
                interval: {
                  type: 'integer',
                  description: 'Repeat every N units'
                }
              }
            }
          },
          required: ['message', 'when']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.createReminder(args.message, args.when, args.recurrence || null);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'SearchTool',
    doc: 'Tool for full-text search across all items',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'search' }),
      $.Var.new({
        name: 'doc',
        default: 'Search across all logs, tasks, and reminders',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            }
          },
          required: ['query']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.search(args.query);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ListTasksTool',
    doc: 'Tool for listing tasks with optional filtering',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'list_tasks' }),
      $.Var.new({
        name: 'doc',
        default: 'List tasks with optional filtering',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            done: {
              type: 'boolean',
              description: 'Filter by completion status'
            },
            priority: {
              type: 'integer',
              description: 'Filter by priority level'
            },
            tag: {
              type: 'string',
              description: 'Filter by tag'
            }
          }
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.listTasks(args || {});
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ListLogsTool',
    doc: 'Tool for listing recent log entries',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'list_logs' }),
      $.Var.new({
        name: 'doc',
        default: 'List recent log/journal entries',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              description: 'Maximum number of entries to return (default 50)'
            }
          }
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.listLogs(args.limit || 50);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ListRemindersTool',
    doc: 'Tool for listing reminders',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'list_reminders' }),
      $.Var.new({
        name: 'doc',
        default: 'List upcoming and past reminders',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            sent: {
              type: 'boolean',
              description: 'Filter by sent status (true=sent, false=pending)'
            }
          }
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.listReminders(args || {});
        }
      }),
    ]
  });

  $.Class.new({
    name: 'TriggerWebhookTool',
    doc: 'Tool for triggering external webhooks',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'trigger_webhook' }),
      $.Var.new({
        name: 'doc',
        default: 'Trigger an external webhook with custom payload',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The webhook URL to call'
            },
            payload: {
              type: 'object',
              description: 'The JSON payload to send'
            }
          },
          required: ['url']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args) {
          const response = await fetch(args.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args.payload || {}),
          });
          return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
          };
        }
      }),
    ]
  });

  $.Class.new({
    name: 'AgendaToolRegistry',
    doc: 'Pre-configured registry with all Agenda tools',
    slots: [
      $tools.ToolRegistry,
      $.After.new({
        name: 'init',
        do() {
          this.register(_.CreateLogTool.new());
          this.register(_.CreateTaskTool.new());
          this.register(_.CompleteTaskTool.new());
          this.register(_.CreateReminderTool.new());
          this.register(_.SearchTool.new());
          this.register(_.ListTasksTool.new());
          this.register(_.ListLogsTool.new());
          this.register(_.ListRemindersTool.new());
          this.register(_.TriggerWebhookTool.new());
        }
      }),
    ]
  });
}.module({
  name: 'agenda:tools',
  imports: [base, tools],
}).load();
