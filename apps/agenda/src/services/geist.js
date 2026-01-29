import { __, base } from 'simulabra';
import live from 'simulabra/live';
import supervisor from '../supervisor.js';
import tools from '../tools.js';
import time from '../time.js';
import Anthropic from '@anthropic-ai/sdk';

export default await async function (_, $, $live, $supervisor, $tools, $time) {
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
        default: `you are a productivity ghost: the geist of SIMULABRA AGENDA. keep your responses terse and to the point.
sprinkle in a bit of wit when appropriate.
the user communicates through lazily typed messages. your job is to figure out what they're asking for and do it.

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

reminders: parse natural time ("tomorrow 3pm", "in 2 hours") → iso 8601. recurrence: pattern + interval.

tasks: priority 1 (urgent) to 5 (low), default 3. parse due dates.`
      }),
      $.Var.new({
        name: 'promptGenerationSystemPrompt',
        default: `You are analyzing a user's productivity state to generate helpful prompts.

Given their tasks, recent activity, and past response patterns, identify 1-3 items that need attention:
- Tasks that may have been forgotten (no updates in a week+)
- Tasks approaching deadlines
- Tasks the user frequently snoozes (maybe should be backlogged)
- Tasks added today or recently added that lack details - ask clarifying questions like "you just added X - want to set a deadline?" or "what priority should X be?"
- Patterns suggesting follow-up questions

Generate concise, friendly prompts. Each should:
- Reference a specific task by name
- Ask a natural question or offer an action
- Be easy to respond to (yes/no or quick update)

Avoid prompting about items the user has previously dismissed multiple times.

Respond with a JSON array of prompt objects. Each object should have:
- itemType: "task" | "log" | "reminder"
- itemId: the id of the related item
- message: the prompt text to display

Example response:
[
  {"itemType": "task", "itemId": "abc123", "message": "Did you get around to fixing the login bug? It's been a week."},
  {"itemType": "task", "itemId": "def456", "message": "The quarterly report is due tomorrow - still on track?"},
  {"itemType": "task", "itemId": "ghi789", "message": "You just added 'redesign homepage' - want to set a deadline or priority?"}
]

If nothing needs attention, respond with an empty array: []`
      }),
      $.Var.new({
        name: 'scheduler',
        doc: 'scheduler for time-based job execution',
      }),
      $.Var.new({
        name: 'promptTimes',
        doc: 'times of day to run prompt generation',
        default: () => (process.env.AGENDA_PROMPT_TIMES || '08:00,18:00').split(',').map(t => t.trim()),
      }),
      $.Var.new({
        name: 'promptDays',
        doc: 'days of week to run prompt generation (empty = all days)',
        default: () => (process.env.AGENDA_PROMPT_DAYS || '').split(',').filter(d => d.trim()),
      }),
      $.Var.new({
        name: 'timezone',
        doc: 'timezone for scheduling',
        default: process.env.AGENDA_TIMEZONE || 'local',
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
        name: 'analyzeContext',
        doc: 'gather tasks, logs, reminders and config for prompt generation',
        async do() {
          const db = this.dbService();
          if (!db) {
            throw new Error('No database service connected');
          }

          const [tasks, logs, reminders, config] = await Promise.all([
            db.listTasks({ done: false }),
            db.listLogs({ limit: 20 }),
            db.listReminders({ sent: false }),
            db.getPromptConfig({}),
          ]);

          return {
            tasks,
            logs,
            reminders,
            config,
            currentTime: new Date().toISOString(),
          };
        }
      }),

      $live.RpcMethod.new({
        name: 'generatePrompts',
        doc: 'generate prompts by analyzing context and calling Claude',
        async do() {
          if (!this.client()) {
            return { success: false, error: 'Claude API not configured' };
          }

          const db = this.dbService();
          if (!db) {
            return { success: false, error: 'No database service connected' };
          }

          try {
            const context = await this.analyzeContext();

            if (context.tasks.length === 0) {
              await db.updatePromptConfig({ lastGenerationAt: new Date().toISOString() });
              return { success: true, promptsCreated: 0, message: 'No tasks to analyze' };
            }

            const userMessage = `Current state:

Tasks (${context.tasks.length}):
${context.tasks.map(t => `- [${t.id}] ${t.title} (P${t.priority}${t.dueDate ? ', due: ' + t.dueDate : ''})`).join('\n')}

Recent logs (${context.logs.length}):
${context.logs.slice(0, 5).map(l => `- ${l.content.substring(0, 100)}`).join('\n')}

Pending reminders (${context.reminders.length}):
${context.reminders.map(r => `- [${r.id}] ${r.message}`).join('\n')}

Response history (last ${Math.min(context.config.responseHistory.length, 10)} actions):
${context.config.responseHistory.slice(-10).map(r => `- ${r.action} on ${r.itemType}`).join('\n') || 'None'}

Generate up to ${context.config.maxPromptsPerCycle} prompts for items that need attention.`;

            const response = await this.client().messages.create({
              model: this.model(),
              max_tokens: 1024,
              system: this.promptGenerationSystemPrompt(),
              messages: [{ role: 'user', content: userMessage }],
            });

            let promptsData = [];
            for (const block of response.content) {
              if (block.type === 'text') {
                try {
                  promptsData = JSON.parse(block.text);
                } catch (e) {
                  this.tlog('Failed to parse prompt response:', e.message);
                  return { success: false, error: 'Failed to parse Claude response as JSON' };
                }
              }
            }

            let promptsCreated = 0;
            let promptsSkipped = 0;
            for (const promptData of promptsData) {
              if (promptData.itemType && promptData.itemId && promptData.message) {
                const hasPending = await db.hasActivePendingPrompt({
                  itemType: promptData.itemType,
                  itemId: promptData.itemId,
                });
                if (hasPending) {
                  promptsSkipped++;
                  continue;
                }
                await db.createPrompt({
                  itemType: promptData.itemType,
                  itemId: promptData.itemId,
                  message: promptData.message,
                  context: { generatedFrom: context },
                  status: 'pending',
                });
                promptsCreated++;
              }
            }

            await db.updatePromptConfig({ lastGenerationAt: new Date().toISOString() });

            this.tlog(`Generated ${promptsCreated} prompts (skipped ${promptsSkipped} duplicates)`);
            return { success: true, promptsCreated, promptsSkipped };
          } catch (e) {
            this.tlog('generatePrompts error:', e.message);
            return { success: false, error: e.message };
          }
        }
      }),

      $live.RpcMethod.new({
        name: 'getPendingPrompts',
        doc: 'get pending prompts that are not snoozed',
        async do({ limit = 10 } = {}) {
          const db = this.dbService();
          if (!db) {
            throw new Error('No database service connected');
          }

          const prompts = await db.listPrompts({ status: 'pending', limit: limit * 2 });
          const now = Date.now();

          return prompts
            .filter(p => {
              if (!p.snoozeUntil) return true;
              return new Date(p.snoozeUntil).getTime() <= now;
            })
            .slice(0, limit);
        }
      }),

      $live.RpcMethod.new({
        name: 'actionPrompt',
        doc: 'process user action on a prompt and update related items accordingly',
        async do({ id, action }) {
          const db = this.dbService();
          if (!db) {
            throw new Error('No database service connected');
          }

          const prompt = await db.getPrompt({ id });
          if (!prompt) {
            throw new Error(`Prompt not found: ${id}`);
          }

          const updateFields = {
            id,
            action,
            actionedAt: new Date().toISOString(),
          };

          switch (action) {
            case 'done':
              updateFields.status = 'actioned';
              if (prompt.itemType === 'task' && prompt.itemId) {
                try {
                  await db.completeTask({ id: prompt.itemId });
                } catch (e) {
                  this.tlog(`Failed to complete task ${prompt.itemId}:`, e.message);
                }
              }
              break;

            case 'backlog':
              updateFields.status = 'actioned';
              if (prompt.itemType === 'task' && prompt.itemId) {
                try {
                  await db.updateTask({ id: prompt.itemId, priority: 5 });
                } catch (e) {
                  this.tlog(`Failed to backlog task ${prompt.itemId}:`, e.message);
                }
              }
              break;

            case 'snooze':
              updateFields.status = 'pending';
              updateFields.snoozeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
              break;

            case 'dismiss':
              updateFields.status = 'dismissed';
              break;

            default:
              throw new Error(`Unknown action: ${action}`);
          }

          const result = await db.updatePrompt(updateFields);

          await this.recordPromptResponse({
            promptId: id,
            action,
            itemType: prompt.itemType,
            itemId: prompt.itemId,
          });

          return result;
        }
      }),

      $.Method.new({
        name: 'recordPromptResponse',
        doc: 'record a prompt response to the config history for learning',
        async do({ promptId, action, itemType, itemId }) {
          const db = this.dbService();
          const config = await db.getPromptConfig({});
          const history = config.responseHistory || [];
          history.push({
            promptId,
            action,
            itemType,
            itemId,
            timestamp: new Date().toISOString(),
          });
          if (history.length > 100) {
            history.shift();
          }
          await db.updatePromptConfig({ responseHistory: history });
        }
      }),

      $.Method.new({
        name: 'initScheduler',
        doc: 'initialize the scheduler with prompt generation job',
        do() {
          const sched = $time.Scheduler.new({
            timezone: this.timezone(),
            logger: (...args) => this.tlog(...args),
          });

          const schedule = $time.TimeOfDaySchedule.new({
            times: this.promptTimes(),
            days: this.promptDays(),
          });

          const job = $time.ScheduledJob.new({
            jobName: 'generatePrompts',
            schedule,
            action: async () => {
              try {
                await this.generatePrompts();
              } catch (e) {
                this.tlog('generatePrompts error:', e.message);
              }
            },
          });

          sched.register(job);
          this.scheduler(sched);
          return sched;
        }
      }),

      $.Method.new({
        name: 'startScheduler',
        doc: 'start the scheduler for time-based prompt generation',
        do() {
          if (!this.scheduler()) {
            this.initScheduler();
          }
          this.scheduler().start();
          this.tlog(`Started scheduler with times: ${this.promptTimes().join(', ')} (timezone: ${this.timezone()})`);
        }
      }),

      $.Method.new({
        name: 'stopScheduler',
        doc: 'stop the scheduler',
        do() {
          if (this.scheduler()) {
            this.scheduler().stop();
            this.tlog('Stopped scheduler');
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
    service.startScheduler();
    __.tlog('GeistService started');
  }
}.module({
  name: 'services.geist',
  imports: [base, live, supervisor, tools, time],
}).load();
