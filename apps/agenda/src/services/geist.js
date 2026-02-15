import { __, base } from 'simulabra';
import live from 'simulabra/live';
import supervisor from '../supervisor.js';
import tools from '../tools.js';
import time from '../time.js';
import providerMod from '../provider.js';

export default await async function (_, $, $live, $supervisor, $tools, $time, $provider) {
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

IMPORTANT: always call a tool to create, update, complete, or delete items. the user's data only changes through tool calls — a text reply alone does nothing.

tools:
- thought/note/journal → create_log
- todo/task → create_task
- done → complete_task
- edit/change/update task → update_task (requires the task id)
- reminder → create_reminder
- find → search
- tasks → list_tasks
- logs → list_logs
- reminders → list_reminders
- webhook/automation → trigger_webhook
projects: organizational containers that group related tasks, logs, and reminders.
- create_project: makes a NEW project (not a task). use when user wants to organize work into a project.
- list_projects: shows existing projects
- update_project: edit project title, context, or archive it (archived=true)
- move_to_project: moves an existing task/log/reminder into a project
do NOT use create_task when the user asks to create a project. projects and tasks are different things.
a project is a container; a task is an actionable item inside a container.

reminders: parse natural time ("tomorrow 3pm", "in 2 hours") → iso 8601. for recurring reminders ("every morning", "every week"), set both when (first occurrence) and recurrence (pattern + interval).

tasks: priority 1 (urgent) to 5 (low), default 3. parse due dates.`
      }),
      $.Var.new({
        name: 'promptGenerationSystemPrompt',
        default: `you are a productivity ghost: the geist of SIMULABRA AGENDA. you are helping the user remember to do things.

examine the tasks the user has saved, their context, and your model of the user.
pick an items that need attention. keep your prompts terse and direct, but helpful.

attention categories:
- forgotten tasks (no updates in a week+)
- approaching deadlines
- frequently snoozed → maybe backlog
- recently added, lacking details → ask about deadline/priority
- patterns suggesting follow-up
- project context relevance: tasks that may need updates relative to their project's goals
- cross-project awareness: surface the most neglected project

each prompt should:
- reference a specific task by name
- ask a question or offer an action
- be quick to respond to (yes/no or short update)

skip items the user has dismissed multiple times.

respond with a JSON array of prompt objects:
- itemType: "task" | "log" | "reminder"
- itemId: the id of the related item
- message: the prompt text
- projectId: (optional) the project id if this prompt relates to a specific project

example:
[
  {"itemType": "task", "itemId": "ghi789", "message": "still planning on redesigning the homepage?", "projectId": "proj123"}
]

nothing needs attention → respond with []`
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
          const adapter = $provider.ProviderConfig.new().fromEnv();
          if (adapter.apiKey()) {
            this.client(adapter);
            this.model(adapter.model());
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
        name: 'resolveProjectContext',
        doc: 'load active projects from DatabaseService for system prompt injection',
        async do() {
          const projects = await this.dbService().listProjects({ archived: false });
          if (projects.length === 0) return null;
          const projectList = projects.map(p => {
            const snippet = p.context ? p.context.substring(0, 800) : '';
            return `- [${p.id}] ${p.title} (${p.slug})${snippet ? ': ' + snippet : ''}`;
          }).join('\n');
          return { projects, projectList };
        }
      }),

      $.Method.new({
        name: 'buildSystemPrompt',
        doc: 'build system prompt with optional project context appended',
        do(projectContext) {
          const base = this.systemPrompt();
          if (!projectContext) return base;
          return `${base}

active projects:
${projectContext.projectList}

when the user mentions a project by name or slug, use the project's id in tool calls. if creating tasks/logs/reminders and a project is clearly implied, set projectId.`;
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

          try {
            const projectContext = await this.resolveProjectContext();
            const systemPrompt = this.buildSystemPrompt(projectContext);
            const messages = this.buildMessages(input);

            const response = await this.client().messages.create({
              model: this.model(),
              max_tokens: 1024,
              system: systemPrompt,
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
                system: systemPrompt,
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
          const db = this.dbService();

          try {
            const projectContext = await this.resolveProjectContext();
            const systemPrompt = this.buildSystemPrompt(projectContext);

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
              system: systemPrompt,
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
                system: systemPrompt,
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
        doc: 'gather tasks, logs, reminders, projects and config for prompt generation',
        async do() {
          const db = this.dbService();
          const [tasks, logs, reminders, config, projects] = await Promise.all([
            db.listTasks({ done: false }),
            db.listLogs({ limit: 20 }),
            db.listReminders({ sent: false }),
            db.getHauntConfig({}),
            db.listProjects({ archived: false }),
          ]);

          const projectMap = {};
          for (const p of projects) {
            projectMap[p.id] = p;
          }

          const tasksByProject = {};
          for (const t of tasks) {
            const key = t.projectId || 'inbox';
            if (!tasksByProject[key]) tasksByProject[key] = [];
            tasksByProject[key].push(t);
          }

          return {
            tasks,
            logs,
            reminders,
            config,
            projects,
            projectMap,
            tasksByProject,
            currentTime: new Date().toISOString(),
          };
        }
      }),

      $live.RpcMethod.new({
        name: 'generateHaunts',
        doc: 'generate haunts by analyzing context and calling Claude',
        async do() {
          const db = this.dbService();

          try {
            const context = await this.analyzeContext();

            if (context.tasks.length === 0) {
              await db.updateHauntConfig({ lastGenerationAt: new Date().toISOString() });
              return { success: true, hauntsCreated: 0, message: 'No tasks to analyze' };
            }

            const formatTask = t => `- [${t.id}] ${t.title} (P${t.priority}${t.dueDate ? ', due: ' + t.dueDate : ''})`;

            let tasksSection;
            if (context.projects.length > 0) {
              const parts = [];
              for (const p of context.projects) {
                const projectTasks = context.tasksByProject[p.id];
                if (!projectTasks || projectTasks.length === 0) continue;
                const snippet = p.context ? p.context.substring(0, 150) : '';
                parts.push(`${p.title}:${snippet ? '\n  context: ' + snippet : ''}\n${projectTasks.map(t => '  ' + formatTask(t)).join('\n')}`);
              }
              const inboxTasks = context.tasksByProject['inbox'];
              if (inboxTasks && inboxTasks.length > 0) {
                parts.push(`Inbox (unassigned):\n${inboxTasks.map(t => '  ' + formatTask(t)).join('\n')}`);
              }
              tasksSection = `Active projects (${context.projects.length}):\n${context.projects.map(p => `- [${p.id}] ${p.title} (${p.slug})`).join('\n')}\n\nTasks (${context.tasks.length}):\n${parts.join('\n\n')}`;
            } else {
              tasksSection = `Tasks (${context.tasks.length}):\n${context.tasks.map(formatTask).join('\n')}`;
            }

            const userMessage = `Current state:

${tasksSection}

Recent logs (${context.logs.length}):
${context.logs.slice(0, 5).map(l => `- ${l.content.substring(0, 100)}`).join('\n')}

Pending reminders (${context.reminders.length}):
${context.reminders.map(r => `- [${r.id}] ${r.message}`).join('\n')}

Response history (last ${Math.min(context.config.responseHistory.length, 10)} actions):
${context.config.responseHistory.slice(-10).map(r => `- ${r.action} on ${r.itemType}`).join('\n') || 'None'}

Generate up to ${context.config.maxHauntsPerCycle} haunts for items that need attention.`;

            const response = await this.client().messages.create({
              model: this.model(),
              max_tokens: 1024,
              system: this.promptGenerationSystemPrompt(),
              messages: [{ role: 'user', content: userMessage }],
            });

            let hauntsData = [];
            for (const block of response.content) {
              if (block.type === 'text') {
                try {
                  hauntsData = JSON.parse(block.text);
                } catch (e) {
                  this.tlog('Failed to parse haunt response:', e.message);
                  return { success: false, error: 'Failed to parse Claude response as JSON' };
                }
              }
            }

            let hauntsCreated = 0;
            let hauntsSkipped = 0;
            for (const hauntData of hauntsData) {
              if (hauntData.itemType && hauntData.itemId && hauntData.message) {
                const hasPending = await db.hasActivePendingHaunt({
                  itemType: hauntData.itemType,
                  itemId: hauntData.itemId,
                });
                if (hasPending) {
                  hauntsSkipped++;
                  continue;
                }
                await db.createHaunt({
                  itemType: hauntData.itemType,
                  itemId: hauntData.itemId,
                  message: hauntData.message,
                  context: { generatedFrom: context, projectId: hauntData.projectId || null },
                  status: 'pending',
                });
                hauntsCreated++;
              }
            }

            await db.updateHauntConfig({ lastGenerationAt: new Date().toISOString() });

            this.tlog(`Generated ${hauntsCreated} haunts (skipped ${hauntsSkipped} duplicates)`);
            return { success: true, hauntsCreated, hauntsSkipped };
          } catch (e) {
            this.tlog('generateHaunts error:', e.message);
            return { success: false, error: e.message };
          }
        }
      }),

      $live.RpcMethod.new({
        name: 'getPendingHaunts',
        doc: 'get pending haunts that are not snoozed',
        async do({ limit = 10 } = {}) {
          const haunts = await this.dbService().listHaunts({ status: 'pending', limit: limit * 2 });
          const now = Date.now();

          return haunts
            .filter(h => {
              if (!h.snoozeUntil) return true;
              return new Date(h.snoozeUntil).getTime() <= now;
            })
            .slice(0, limit);
        }
      }),

      $live.RpcMethod.new({
        name: 'actionHaunt',
        doc: 'process user action on a haunt and update related items accordingly',
        async do({ id, action }) {
          const db = this.dbService();
          const haunt = await db.getHaunt({ id });
          if (!haunt) {
            throw new Error(`Haunt not found: ${id}`);
          }

          const updateFields = {
            id,
            action,
            actionedAt: new Date().toISOString(),
          };

          switch (action) {
            case 'done':
              updateFields.status = 'actioned';
              if (haunt.itemType === 'task' && haunt.itemId) {
                try {
                  await db.completeTask({ id: haunt.itemId });
                } catch (e) {
                  this.tlog(`Failed to complete task ${haunt.itemId}:`, e.message);
                }
              }
              break;

            case 'backlog':
              updateFields.status = 'actioned';
              if (haunt.itemType === 'task' && haunt.itemId) {
                try {
                  await db.updateTask({ id: haunt.itemId, priority: 5 });
                } catch (e) {
                  this.tlog(`Failed to backlog task ${haunt.itemId}:`, e.message);
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

          const result = await db.updateHaunt(updateFields);

          await this.recordHauntResponse({
            hauntId: id,
            action,
            itemType: haunt.itemType,
            itemId: haunt.itemId,
          });

          return result;
        }
      }),

      $.Method.new({
        name: 'recordHauntResponse',
        doc: 'record a haunt response to the config history for learning',
        async do({ hauntId, action, itemType, itemId }) {
          const db = this.dbService();
          const config = await db.getHauntConfig({});
          const history = config.responseHistory || [];
          history.push({
            hauntId,
            action,
            itemType,
            itemId,
            timestamp: new Date().toISOString(),
          });
          if (history.length > 100) {
            history.shift();
          }
          await db.updateHauntConfig({ responseHistory: history });
        }
      }),

      $.Method.new({
        name: 'initScheduler',
        doc: 'initialize the scheduler with haunt generation job',
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
            jobName: 'generateHaunts',
            schedule,
            action: async () => {
              try {
                await this.generateHaunts();
              } catch (e) {
                this.tlog('generateHaunts error:', e.message);
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
        doc: 'start the scheduler for time-based haunt generation',
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
    if (!service.client()) {
      throw new Error('Claude API not configured. Set AGENDA_CLAUDE_KEY or ANTHROPIC_API_KEY');
    }
    await service.connect();
    await service.waitForService({ name: 'DatabaseService' });
    await service.connectToDatabase();
    service.startScheduler();
    __.tlog('GeistService started');
  }
}.module({
  name: 'services.geist',
  imports: [base, live, supervisor, tools, time, providerMod],
}).load();
