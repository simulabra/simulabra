import { __, base } from 'simulabra';
import live from 'simulabra/live';
import tools from '../tools.js';
import Anthropic from '@anthropic-ai/sdk';

export default await async function (_, $, $live, $tools) {
  $.Class.new({
    name: 'GeistService',
    doc: 'Claude API integration for natural language understanding',
    slots: [
      $live.NodeClient,
      $.Var.new({ name: 'dbService' }),
      $.Var.new({ name: 'client' }),
      $.Var.new({ name: 'model', default: 'claude-sonnet-4-20250514' }),
      $.Var.new({
        name: 'toolRegistry',
        doc: 'registry of available tools',
        default: () => $tools.AgendaToolRegistry.new(),
      }),
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

      $.After.new({
        name: 'init',
        do() {
          const apiKey = process.env.AGENDA_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;
          if (apiKey) {
            this.client(new Anthropic({ apiKey }));
          }
        }
      }),

      $.Method.new({
        name: 'tools',
        doc: 'returns tool definitions for Claude API (compatibility method)',
        do() {
          return this.toolRegistry().definitions();
        }
      }),

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
        name: 'services',
        doc: 'build services context for tool execution',
        do() {
          return {
            db: this.dbService(),
          };
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
          return await this.toolRegistry().execute(toolName, args, this.services());
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

            if (response.stop_reason === 'tool_use' && results.length > 0) {
              const toolResults = results.map((r, i) => ({
                type: 'tool_result',
                tool_use_id: response.content.filter(b => b.type === 'tool_use')[i].id,
                content: JSON.stringify(r.result)
              }));

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
  imports: [base, live, tools],
}).load();
