import { __, base } from 'simulabra';
import live from 'simulabra/live';
import Anthropic from '@anthropic-ai/sdk';

export default await async function (_, $, $live) {
  $.Class.new({
    name: 'GeistService',
    doc: 'Claude API integration for natural language understanding',
    slots: [
      $live.NodeClient,
      $.Var.new({ name: 'dbService' }),
      $.Var.new({ name: 'client' }),
      $.Var.new({ name: 'model', default: 'claude-sonnet-4-20250514' }),
      $.Var.new({
        name: 'systemPrompt',
        default: `You are Agenda, a personal productivity assistant. You help users manage their logs (journal entries), tasks (todo items), and reminders.

When the user wants to:
- Record a thought, note, or journal entry → use create_log
- Add a todo item or task → use create_task
- Mark a task as done → use complete_task
- Set a reminder for a specific time → use create_reminder
- Find something they wrote before → use search
- See their current tasks → use list_tasks
- See their recent journal entries → use list_logs

Be helpful and concise. When creating items, confirm what was created. When searching, summarize the results.

For reminders:
- Parse natural language times like "tomorrow at 3pm", "in 2 hours", "next Monday"
- Convert to ISO 8601 format for the 'when' parameter
- For recurring reminders, set the recurrence object with pattern (daily/weekly/monthly) and interval

For tasks:
- Priority 1 is highest (urgent), 5 is lowest
- Default to priority 3 if not specified
- Parse due dates from natural language`
      }),
      $.Var.new({
        name: 'tools',
        default: () => [
          {
            name: 'create_log',
            description: 'Create a journal/log entry to record thoughts, notes, or events',
            input_schema: {
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
            }
          },
          {
            name: 'create_task',
            description: 'Create a new task/todo item',
            input_schema: {
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
            }
          },
          {
            name: 'complete_task',
            description: 'Mark a task as completed',
            input_schema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The task ID to complete'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'create_reminder',
            description: 'Create a reminder for a specific time',
            input_schema: {
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
            }
          },
          {
            name: 'search',
            description: 'Search across all logs, tasks, and reminders',
            input_schema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'list_tasks',
            description: 'List tasks with optional filtering',
            input_schema: {
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
            }
          },
          {
            name: 'list_logs',
            description: 'List recent log/journal entries',
            input_schema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'integer',
                  description: 'Maximum number of entries to return (default 50)'
                }
              }
            }
          }
        ]
      }),

      $.After.new({
        name: 'init',
        do() {
          const apiKey = process.env.AGENDA_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;
          if (apiKey) {
            this.client(new Anthropic({ apiKey }));
          }
        }
      }),

      // Health check
      $live.RpcMethod.new({
        name: 'health',
        do() {
          return {
            status: 'ok',
            service: 'GeistService',
            hasClient: !!this.client(),
          };
        }
      }),

      $.Method.new({
        name: 'buildMessages',
        doc: 'build messages array for Claude API',
        do(input) {
          return [{ role: 'user', content: input }];
        }
      }),

      $.Method.new({
        name: 'executeTool',
        doc: 'execute a tool by name with given arguments',
        async do(toolName, args) {
          const db = this.dbService();
          if (!db) {
            return { success: false, error: 'No database service connected' };
          }

          try {
            let result;
            switch (toolName) {
              case 'create_log':
                result = await db.createLog(args.content, args.tags || []);
                break;
              case 'create_task':
                result = await db.createTask(args.title, args.priority || 3, args.dueDate || null);
                break;
              case 'complete_task':
                result = await db.completeTask(args.id);
                break;
              case 'create_reminder':
                result = await db.createReminder(args.message, args.when, args.recurrence || null);
                break;
              case 'search':
                result = await db.search(args.query);
                break;
              case 'list_tasks':
                result = await db.listTasks(args || {});
                break;
              case 'list_logs':
                result = await db.listLogs(args.limit || 50);
                break;
              default:
                return { success: false, error: `Unknown tool: ${toolName}` };
            }
            return { success: true, data: result };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
      }),

      $live.RpcMethod.new({
        name: 'interpret',
        doc: 'interpret natural language input and execute actions',
        async do(input) {
          if (!this.client()) {
            return {
              success: false,
              error: 'Claude API not configured. Set AGENDA_CLAUDE_KEY or ANTHROPIC_API_KEY'
            };
          }

          const db = this.dbService();
          if (!db) {
            return { success: false, error: 'No database service connected' };
          }

          try {
            const messages = this.buildMessages(input);

            const response = await this.client().messages.create({
              model: this.model(),
              max_tokens: 1024,
              system: this.systemPrompt(),
              tools: this.tools(),
              messages,
            });

            const results = [];
            let textResponse = '';

            for (const block of response.content) {
              if (block.type === 'text') {
                textResponse += block.text;
              } else if (block.type === 'tool_use') {
                this.tlog(`executing tool: ${block.name}`);
                const toolResult = await this.executeTool(block.name, block.input);
                results.push({
                  tool: block.name,
                  input: block.input,
                  result: toolResult
                });
              }
            }

            // If Claude wants to use tools and expects a response, continue the conversation
            if (response.stop_reason === 'tool_use' && results.length > 0) {
              // Build tool results for Claude
              const toolResults = results.map((r, i) => ({
                type: 'tool_result',
                tool_use_id: response.content.filter(b => b.type === 'tool_use')[i].id,
                content: JSON.stringify(r.result)
              }));

              // Continue conversation with tool results
              const followUp = await this.client().messages.create({
                model: this.model(),
                max_tokens: 1024,
                system: this.systemPrompt(),
                tools: this.tools(),
                messages: [
                  ...messages,
                  { role: 'assistant', content: response.content },
                  { role: 'user', content: toolResults }
                ],
              });

              // Extract final text response
              for (const block of followUp.content) {
                if (block.type === 'text') {
                  textResponse += block.text;
                }
              }
            }

            return {
              success: true,
              response: textResponse,
              toolsExecuted: results
            };
          } catch (e) {
            this.tlog(`interpret error: ${e.message}`);
            return { success: false, error: e.message };
          }
        }
      }),

      $.Method.new({
        name: 'connectToDatabase',
        doc: 'connect to DatabaseService via supervisor proxy',
        async do() {
          if (!this.connected()) {
            throw new Error('not connected to supervisor');
          }
          const proxy = await this.serviceProxy({ name: 'DatabaseService' });
          this.dbService(proxy);
          this.tlog('connected to DatabaseService');
        }
      }),
    ]
  });

  if (import.meta.main) {
    await __.sleep(50);
    const service = _.GeistService.new({ uid: 'GeistService' });
    await service.connect();
    await service.connectToDatabase();
    __.tlog('GeistService started');
  }
}.module({
  name: 'services.geist',
  imports: [base, live],
}).load();
