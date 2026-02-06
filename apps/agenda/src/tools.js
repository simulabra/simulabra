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
        default: 'Record a thought, note, or journal entry',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            projectId: { type: 'string' }
          },
          required: ['content']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.createLog({ content: args.content, tags: args.tags || [], projectId: args.projectId || null });
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
        default: 'Create a task/todo item',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            title: { type: 'string' },
            priority: { type: 'integer', minimum: 1, maximum: 5, description: '1=urgent, 5=low, default 3' },
            dueDate: { type: 'string', description: 'ISO 8601' },
            tags: { type: 'array', items: { type: 'string' } },
            projectId: { type: 'string' }
          },
          required: ['title']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.createTask({
            title: args.title,
            priority: args.priority || 3,
            dueDate: args.dueDate || null,
            tags: args.tags || [],
            projectId: args.projectId || null
          });
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
        default: 'Mark a task as done',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.completeTask({ id: args.id });
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
        default: 'Create a timed reminder',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            message: { type: 'string' },
            when: { type: 'string', description: 'ISO 8601 trigger time' },
            recurrence: {
              type: 'object',
              properties: {
                pattern: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
                interval: { type: 'integer' }
              }
            },
            projectId: { type: 'string' }
          },
          required: ['message', 'when']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.createReminder({
            message: args.message,
            triggerAt: args.when,
            recurrence: args.recurrence || null,
            projectId: args.projectId || null
          });
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
        default: 'Full-text search across logs, tasks, and reminders',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            query: { type: 'string' }
          },
          required: ['query']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.search({ query: args.query });
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
        default: 'List tasks, optionally filtered',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            done: { type: 'boolean' },
            priority: { type: 'integer' },
            tag: { type: 'string' },
            projectId: { type: 'string' }
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
        default: 'List recent log entries',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            limit: { type: 'integer', description: 'default 50' },
            projectId: { type: 'string' }
          }
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.listLogs({ ...args, limit: args.limit || 50 });
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
        default: 'List reminders',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            sent: { type: 'boolean', description: 'true=sent, false=pending' },
            projectId: { type: 'string' }
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
        default: 'POST to a webhook URL',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            url: { type: 'string' },
            payload: { type: 'object' }
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
    name: 'CreateProjectTool',
    doc: 'Tool for creating a new project',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'create_project' }),
      $.Var.new({
        name: 'doc',
        default: 'Create a new project',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            title: { type: 'string' },
            slug: { type: 'string', description: 'URL-friendly ID, auto-generated if omitted' },
            context: { type: 'string', description: 'Project context for scoping responses' }
          },
          required: ['title']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.createProject({
            title: args.title,
            slug: args.slug,
            context: args.context || null
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ListProjectsTool',
    doc: 'Tool for listing all projects',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'list_projects' }),
      $.Var.new({
        name: 'doc',
        default: 'List projects',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            archived: { type: 'boolean' }
          }
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.listProjects(args || {});
        }
      }),
    ]
  });

  $.Class.new({
    name: 'UpdateProjectTool',
    doc: 'Tool for updating a project',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'update_project' }),
      $.Var.new({
        name: 'doc',
        default: 'Update a project',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            slug: { type: 'string' },
            context: { type: 'string' },
            archived: { type: 'boolean' }
          },
          required: ['id']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.updateProject(args);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'MoveToProjectTool',
    doc: 'Tool for moving items between projects',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'move_to_project' }),
      $.Var.new({
        name: 'doc',
        default: 'Move an item to a project or Inbox',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            itemType: { type: 'string', enum: ['task', 'log', 'reminder'] },
            itemId: { type: 'string' },
            projectId: { type: 'string', description: 'null to move to Inbox' },
            projectSlug: { type: 'string', description: 'Alternative to projectId' }
          },
          required: ['itemType', 'itemId']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          let targetProjectId = args.projectId ?? null;
          if (args.projectSlug && !args.projectId) {
            const project = await services.db.getProjectBySlug({ slug: args.projectSlug });
            if (!project) {
              throw new Error(`Project not found: ${args.projectSlug}`);
            }
            targetProjectId = project.id;
          }
          const updateArgs = { id: args.itemId, projectId: targetProjectId };
          switch (args.itemType) {
            case 'task': return await services.db.updateTask(updateArgs);
            case 'log': return await services.db.updateLog(updateArgs);
            case 'reminder': return await services.db.updateReminder(updateArgs);
            default: throw new Error(`Unknown item type: ${args.itemType}`);
          }
        }
      }),
    ]
  });

  $.Class.new({
    name: 'UpdateTaskTool',
    doc: 'Tool for updating an existing task',
    slots: [
      $tools.Tool,
      $.Var.new({ name: 'toolName', default: 'update_task' }),
      $.Var.new({
        name: 'doc',
        default: 'Update a task',
      }),
      $.Var.new({
        name: 'inputSchema',
        default: () => ({
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            priority: { type: 'integer', minimum: 1, maximum: 5, description: '1=highest, 5=lowest' },
            dueDate: { type: 'string', description: 'ISO 8601, null to clear' },
            tags: { type: 'array', items: { type: 'string' } },
            projectId: { type: 'string' }
          },
          required: ['id']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.updateTask(args);
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
          this.register(_.CreateProjectTool.new());
          this.register(_.ListProjectsTool.new());
          this.register(_.UpdateProjectTool.new());
          this.register(_.MoveToProjectTool.new());
          this.register(_.UpdateTaskTool.new());
        }
      }),
    ]
  });
}.module({
  name: 'agenda:tools',
  imports: [base, tools],
}).load();
