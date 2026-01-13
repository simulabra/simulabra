import { __, base } from 'simulabra';

export default await async function (_, $) {
  $.Class.new({
    name: 'Tool',
    doc: 'Base class for LLM-callable tools with unified definition and execution',
    slots: [
      $.Var.new({ name: 'toolName', doc: 'the name of this tool' }),
      $.Var.new({
        name: 'doc',
        doc: 'description of what the tool does (shown to LLM)',
      }),
      $.Var.new({
        name: 'inputSchema',
        doc: 'JSON schema for the tool input',
      }),
      $.Method.new({
        name: 'definition',
        doc: 'returns the Anthropic tool definition',
        do() {
          return {
            name: this.toolName(),
            description: this.doc(),
            input_schema: this.inputSchema(),
          };
        }
      }),
      $.Virtual.new({
        name: 'execute',
        doc: 'execute the tool with given args and services context',
      }),
    ]
  });

  $.Class.new({
    name: 'ToolRegistry',
    doc: 'Registry of tools with lookup and execution dispatch',
    slots: [
      $.Var.new({
        name: 'tools',
        doc: 'array of Tool objects',
        default: () => [],
      }),
      $.Var.new({
        name: 'toolMap',
        doc: 'map of tool name to Tool object (computed lazily)',
      }),
      $.Method.new({
        name: 'register',
        doc: 'add a tool to the registry',
        do(tool) {
          this.tools().push(tool);
          this.toolMap(null);
          return this;
        }
      }),
      $.Method.new({
        name: 'getToolMap',
        doc: 'get or build the name->tool map',
        do() {
          if (!this.toolMap()) {
            const map = {};
            for (const tool of this.tools()) {
              map[tool.toolName()] = tool;
            }
            this.toolMap(map);
          }
          return this.toolMap();
        }
      }),
      $.Method.new({
        name: 'get',
        doc: 'get a tool by name',
        do(name) {
          return this.getToolMap()[name];
        }
      }),
      $.Method.new({
        name: 'definitions',
        doc: 'returns array of all tool definitions for the Claude API',
        do() {
          return this.tools().map(t => t.definition());
        }
      }),
      $.Method.new({
        name: 'execute',
        doc: 'execute a tool by name with given args and services context',
        async do(toolName, args, services) {
          const tool = this.get(toolName);
          if (!tool) {
            return { success: false, error: `Unknown tool: ${toolName}` };
          }
          try {
            const result = await tool.execute(args, services);
            return { success: true, data: result };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
      }),
    ]
  });

  $.Class.new({
    name: 'CreateLogTool',
    doc: 'Tool for creating journal/log entries',
    slots: [
      _.Tool,
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
      _.Tool,
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
            }
          },
          required: ['title']
        }),
      }),
      $.Method.new({
        name: 'execute',
        async do(args, services) {
          return await services.db.createTask(args.title, args.priority || 3, args.dueDate || null);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'CompleteTaskTool',
    doc: 'Tool for marking tasks as completed',
    slots: [
      _.Tool,
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
      _.Tool,
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
      _.Tool,
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
      _.Tool,
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
      _.Tool,
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
    name: 'AgendaToolRegistry',
    doc: 'Pre-configured registry with all Agenda tools',
    slots: [
      _.ToolRegistry,
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
        }
      }),
    ]
  });
}.module({
  name: 'tools',
  imports: [base],
}).load();
