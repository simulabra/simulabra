import { __, base } from 'simulabra';
import live from 'simulabra/live';
import supervisor from '../supervisor.js';
import tools from '../tools.js';
import Anthropic from '@anthropic-ai/sdk';

export default await async function (_, $, $live, $supervisor, $tools) {
  $.Class.new({
    name: 'GeistService',
    doc: 'Claude API integration for natural language understanding',
    slots: [
      $supervisor.AgendaService,
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
        default: `you are a productivity ghost. terse responses only.

tools:
- thought/note/journal → create_log
- todo/task → create_task
- done → complete_task
- reminder → create_reminder
- find → search
- tasks → list_tasks
- logs → list_logs
- reminders → list_reminders
- webhook/automation → trigger_webhook

confirm actions briefly. summarize search results.

reminders: parse natural time ("tomorrow 3pm", "in 2 hours") → iso 8601. recurrence: pattern + interval.

tasks: priority 1 (urgent) to 5 (low), default 3. parse due dates.`
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
        name: 'buildMessagesFromHistory',
        doc: 'build messages array from recent chat history',
        do(chatMessages, currentInput) {
          const messages = [];
          for (const msg of chatMessages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              messages.push({ role: msg.role, content: msg.content });
            }
          }
          messages.push({ role: 'user', content: currentInput });
          return messages;
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

      $.Method.new({
        name: 'executeWebhook',
        doc: 'send an HTTP POST request to a webhook URL',
        async do(url, payload) {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          return {
            status: response.status,
            ok: response.ok,
            body: response.ok ? await response.text() : null,
          };
        }
      }),

      $live.RpcMethod.new({
        name: 'interpret',
        doc: 'interpret natural language input and execute actions',
        async do(input) {
          this.tlog(`[conversation] user: ${input}`);

          if (!this.client()) {
            const error = 'Claude API not configured. Set AGENDA_CLAUDE_KEY or ANTHROPIC_API_KEY';
            this.tlog(`[conversation] error: ${error}`);
            return { success: false, error };
          }

          const db = this.dbService();
          if (!db) {
            const error = 'No database service connected';
            this.tlog(`[conversation] error: ${error}`);
            return { success: false, error };
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
                this.tlog(`[conversation] tool: ${block.name}(${JSON.stringify(block.input)})`);
                const toolResult = await this.executeTool(block.name, block.input);
                results.push({
                  tool: block.name,
                  input: block.input,
                  result: toolResult
                });
                if (!toolResult.success) {
                  this.tlog(`[conversation] tool error: ${toolResult.error}`);
                }
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

            this.tlog(`[conversation] assistant: ${textResponse}`);
            return {
              success: true,
              response: textResponse,
              toolsExecuted: results
            };
          } catch (e) {
            this.tlog(`[conversation] error: ${e.message}`);
            return { success: false, error: e.message };
          }
        }
      }),

      $live.RpcMethod.new({
        name: 'interpretMessage',
        doc: 'interpret input and persist both user and assistant messages',
        async do({ conversationId = 'main', text, source, clientUid, clientMessageId, useHistory = true }) {
          this.tlog(`[conversation] user (${source}): ${text}`);

          if (!this.client()) {
            const error = 'Claude API not configured. Set AGENDA_CLAUDE_KEY or ANTHROPIC_API_KEY';
            this.tlog(`[conversation] error: ${error}`);
            return { success: false, error };
          }

          const db = this.dbService();
          if (!db) {
            const error = 'No database service connected';
            this.tlog(`[conversation] error: ${error}`);
            return { success: false, error };
          }

          try {
            const userMessage = await db.appendChatMessage({
              conversationId,
              role: 'user',
              content: text,
              source,
              clientUid,
              clientMessageId,
            });

            let messages;
            if (useHistory) {
              const history = await db.listChatMessages({ conversationId, limit: 20 });
              const historyWithoutCurrent = history.filter(m => m.id !== userMessage.id);
              messages = this.buildMessagesFromHistory(historyWithoutCurrent, text);
            } else {
              messages = this.buildMessages(text);
            }

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
                this.tlog(`[conversation] tool: ${block.name}(${JSON.stringify(block.input)})`);
                const toolResult = await this.executeTool(block.name, block.input);
                results.push({
                  tool: block.name,
                  input: block.input,
                  result: toolResult
                });
                if (!toolResult.success) {
                  this.tlog(`[conversation] tool error: ${toolResult.error}`);
                }
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

            const toolNames = results.map(r => r.tool);
            const assistantMessage = await db.appendChatMessage({
              conversationId,
              role: 'assistant',
              content: textResponse || 'Done.',
              source: 'geist',
              meta: toolNames.length > 0 ? { toolsExecuted: toolNames } : null,
            });

            this.tlog(`[conversation] assistant (geist): ${textResponse}`);
            return {
              success: true,
              response: textResponse,
              toolsExecuted: results,
              userMessage,
              assistantMessage,
            };
          } catch (e) {
            this.tlog(`[conversation] error: ${e.message}`);
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
    const service = _.GeistService.new();
    await service.connect();
    await service.waitForService({ name: 'DatabaseService' });
    await service.connectToDatabase();
    __.tlog('GeistService started');
  }
}.module({
  name: 'services.geist',
  imports: [base, live, supervisor, tools],
}).load();
