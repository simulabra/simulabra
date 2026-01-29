import html from "simulabra/html";
import { __, base } from "simulabra";

export default await async function (_, $, $html) {

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP API Client
  // ═══════════════════════════════════════════════════════════════════════════

  $.Class.new({
    name: "AgendaApiClient",
    doc: "HTTP client for Agenda API endpoints",
    slots: [
      $.Var.new({ name: "baseUrl", default: "" }),
      $.Var.new({ name: "lastSuccessTime" }),
      $.Var.new({ name: "consecutiveFailures", default: 0 }),
      $.Method.new({
        name: "apiCall",
        doc: "make an HTTP request, tracking connection health and unwrapping the response envelope",
        async do(method, path, body = null) {
          const url = this.baseUrl() + path;
          const options = {
            method,
            headers: { "Content-Type": "application/json" },
          };
          if (body !== null) {
            options.body = JSON.stringify(body);
          }
          const response = await fetch(url, options);
          const data = await response.json();
          if (!data.ok) {
            throw new Error(data.error || "API call failed");
          }
          this.lastSuccessTime(Date.now());
          this.consecutiveFailures(0);
          return data.value;
        }
      }),
      $.Method.new({
        name: "markFailure",
        doc: "increment consecutive failure count for connection health tracking",
        do() {
          this.consecutiveFailures(this.consecutiveFailures() + 1);
        }
      }),
      $.Method.new({
        name: "isOnline",
        doc: "true if a successful API call occurred within the last 30 seconds",
        do() {
          const last = this.lastSuccessTime();
          if (!last) return false;
          return Date.now() - last < 30000;
        }
      }),
      $.Method.new({
        name: "getStatus",
        async do() {
          return await this.apiCall("GET", "/api/v1/status");
        }
      }),
      $.Method.new({
        name: "listTasks",
        async do(filter = {}) {
          return await this.apiCall("POST", "/api/v1/tasks/list", filter);
        }
      }),
      $.Method.new({
        name: "completeTask",
        async do(id) {
          return await this.apiCall("POST", "/api/v1/tasks/complete", { id });
        }
      }),
      $.Method.new({
        name: "listLogs",
        async do(opts = {}) {
          return await this.apiCall("POST", "/api/v1/logs/list", opts);
        }
      }),
      $.Method.new({
        name: "listReminders",
        async do(filter = {}) {
          return await this.apiCall("POST", "/api/v1/reminders/list", filter);
        }
      }),
      $.Method.new({
        name: "chatHistory",
        async do(opts = {}) {
          return await this.apiCall("POST", "/api/v1/chat/history", opts);
        }
      }),
      $.Method.new({
        name: "chatWait",
        async do(opts) {
          return await this.apiCall("POST", "/api/v1/chat/wait", opts);
        }
      }),
      $.Method.new({
        name: "chatSend",
        async do(opts) {
          return await this.apiCall("POST", "/api/v1/chat/send", opts);
        }
      }),
      $.Method.new({
        name: "getPendingPrompts",
        async do(opts = {}) {
          return await this.apiCall("POST", "/api/v1/prompts/pending", opts);
        }
      }),
      $.Method.new({
        name: "actionPrompt",
        async do(opts) {
          return await this.apiCall("POST", "/api/v1/prompts/action", opts);
        }
      }),
      $.Method.new({
        name: "generatePrompts",
        async do() {
          return await this.apiCall("POST", "/api/v1/prompts/generate", {});
        }
      }),
    ]
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UI Components
  // ═══════════════════════════════════════════════════════════════════════════

  const formatTimestamp = $.Method.new({
    name: "formatTimestamp",
    doc: "format a timestamp string as ISO 8601, returning empty string for falsy values",
    do(ts) {
      if (!ts) return "";
      return new Date(ts).toISOString();
    }
  });

  $.Class.new({
    name: "PromptMessage",
    doc: "Prompt rendered inline as a chat message with action buttons",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Var.new({ name: "prompt" }),
      $.Signal.new({ name: "acting", default: false }),
      $.Method.new({
        name: "handleAction",
        async do(action) {
          if (this.acting()) return;
          this.acting(true);
          try {
            await this.app().actionPrompt(this.prompt().id, action);
          } finally {
            this.acting(false);
          }
        }
      }),
      formatTimestamp,
      $.Method.new({
        name: "render",
        do() {
          const prompt = this.prompt();
          const timestamp = this.formatTimestamp(prompt.createdAt);
          return $html.HTML.t`
            <div class="chat-message assistant prompt">
              <div class="message-meta">
                <span class="message-source">geist</span>
                ${timestamp ? $html.HTML.t`<span class="message-timestamp">${timestamp}</span>` : ""}
              </div>
              <div class="message-content">${prompt.message}</div>
              <div class="prompt-actions">
                <button class="prompt-btn done" onclick=${() => this.handleAction("done")}
                        disabled=${() => this.acting()}>done</button>
                <button class="prompt-btn backlog" onclick=${() => this.handleAction("backlog")}
                        disabled=${() => this.acting()}>backlog</button>
                <button class="prompt-btn later" onclick=${() => this.handleAction("snooze")}
                        disabled=${() => this.acting()}>later</button>
                <button class="prompt-btn dismiss" onclick=${() => this.handleAction("dismiss")}
                        disabled=${() => this.acting()}>dismiss</button>
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "TopBar",
    doc: "Header bar with title and menu toggle",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Method.new({
        name: "statusText",
        do() {
          const state = this.app().connectionState();
          const polling = this.app().fallbackPolling();
          if (state === "connected") {
            return polling ? "polling" : "connected";
          }
          return state;
        }
      }),
      $.Method.new({
        name: "handleRefresh",
        do() {
          location.reload();
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="top-bar">
              <button class="refresh-btn" onclick=${() => this.handleRefresh()}>↻</button>
              <h1 class="title">AGENDA</h1>
              <div class=${() => "connection-status " + this.app().connectionState()}>
                ${() => this.statusText()}
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "TaskItem",
    doc: "Single task item in the todos view",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Var.new({ name: "task" }),
      $.Method.new({
        name: "handleComplete",
        async do() {
          await this.app().completeTask(this.task().rid);
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          const task = this.task();
          const priorityClass = `priority-${task.priority || 3}`;
          return $html.HTML.t`
            <div class=${() => "task-item " + priorityClass + (task.done ? " done" : "")}>
              <button class="task-checkbox" onclick=${() => this.handleComplete()}>
                ${task.done ? "done" : "todo"}
              </button>
              <div class="task-content">
                <span class="task-title">${task.title}</span>
                ${task.dueDate ? $html.HTML.t`<span class="task-due">due ${new Date(task.dueDate).toLocaleDateString()}</span>` : ""}
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "TodosView",
    doc: "Task list view with active/backlog/completed filter tabs",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Signal.new({ name: "taskFilter", default: "active" }),
      $.Method.new({
        name: "filteredTasks",
        doc: "partition tasks by current filter mode, returning {items, recentDone}",
        do() {
          const tasks = this.app().tasks();
          const mode = this.taskFilter();
          if (mode === "active") {
            const items = tasks
              .filter(t => !t.done && (t.priority || 3) <= 3)
              .sort((a, b) => (a.priority || 3) - (b.priority || 3));
            const recentDone = tasks
              .filter(t => t.done && t.completedAt)
              .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
              .slice(0, 3);
            return { items, recentDone };
          } else if (mode === "backlog") {
            const items = tasks
              .filter(t => !t.done && (t.priority || 3) > 3)
              .sort((a, b) => (a.priority || 3) - (b.priority || 3));
            return { items, recentDone: [] };
          } else if (mode === "completed") {
            const items = tasks
              .filter(t => t.done)
              .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
            return { items, recentDone: [] };
          }
          return { items: [], recentDone: [] };
        }
      }),
      $.Method.new({
        name: "filterTabs",
        doc: "render the active/backlog/done tab bar",
        do() {
          const tabs = [
            { id: "active", label: "Active" },
            { id: "backlog", label: "Backlog" },
            { id: "completed", label: "Done" },
          ];
          return $html.HTML.t`
            <div class="filter-tabs">
              ${tabs.map(tab => $html.HTML.t`
                <button class=${() => "filter-tab" + (this.taskFilter() === tab.id ? " active" : "")}
                        onclick=${() => this.taskFilter(tab.id)}>
                  ${tab.label}
                </button>
              `)}
            </div>
          `;
        }
      }),
      $.Method.new({
        name: "taskCount",
        doc: "number of primary tasks in the current filter",
        do() {
          return this.filteredTasks().items.length;
        }
      }),
      $.Method.new({
        name: "renderTaskList",
        doc: "render task items with optional recently-done divider",
        do() {
          const { items, recentDone } = this.filteredTasks();

          if (!items.length && !recentDone.length) {
            const labels = { active: "No active tasks", backlog: "No backlog tasks", completed: "No completed tasks" };
            return $html.HTML.t`<div class="empty-state">${labels[this.taskFilter()] || "No tasks"}</div>`;
          }

          const rendered = items.map(task => _.TaskItem.new({ app: this.app(), task }));
          if (recentDone.length) {
            rendered.push($html.HTML.t`
              <div class="task-section-divider">
                <span class="task-section-label">recently done</span>
              </div>
            `);
            recentDone.forEach(task => rendered.push(_.TaskItem.new({ app: this.app(), task })));
          }
          return rendered;
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="todos-view view">
              <div class="view-header">
                <h2>Tasks</h2>
                ${this.filterTabs()}
                <span class="task-count">${() => this.taskCount()} ${() => this.taskFilter()}</span>
              </div>
              <div class="task-list">
                ${() => this.renderTaskList()}
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "LogEntry",
    doc: "Single log entry in the journal view",
    slots: [
      $html.Component,
      $.Var.new({ name: "log" }),
      $.Method.new({
        name: "render",
        do() {
          const log = this.log();
          const date = new Date(log.timestamp);
          return $html.HTML.t`
            <div class="log-entry">
              <div class="log-timestamp">${date.toLocaleString()}</div>
              <div class="log-content">${log.content}</div>
              ${log.tags && log.tags.length ? $html.HTML.t`
                <div class="log-tags">
                  ${log.tags.map(tag => $html.HTML.t`<span class="tag">#${tag}</span>`)}
                </div>
              ` : ""}
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "JournalView",
    doc: "Timestamped log of journal entries",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="journal-view view">
              <div class="view-header">
                <h2>Journal</h2>
              </div>
              <div class="log-list">
                ${() => {
                  const logs = this.app().logs();
                  if (!logs.length) return $html.HTML.t`<div class="empty-state">No entries yet</div>`;
                  return logs
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map(log => _.LogEntry.new({ log }));
                }}
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "ReminderItem",
    doc: "Single reminder in the calendar view",
    slots: [
      $html.Component,
      $.Var.new({ name: "reminder" }),
      $.Method.new({
        name: "render",
        do() {
          const reminder = this.reminder();
          const date = new Date(reminder.triggerAt);
          const isPast = date < new Date();
          return $html.HTML.t`
            <div class=${() => "reminder-item" + (reminder.sent ? " sent" : "") + (isPast ? " past" : "")}>
              <div class="reminder-time">${date.toLocaleString()}</div>
              <div class="reminder-message">${reminder.message}</div>
              ${reminder.recurrence ? $html.HTML.t`<span class="reminder-recurring">recurring</span>` : ""}
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "CalendarView",
    doc: "View of upcoming reminders",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="calendar-view view">
              <div class="view-header">
                <h2>Reminders</h2>
              </div>
              <div class="reminder-list">
                ${() => {
                  const reminders = this.app().reminders();
                  if (!reminders.length) return $html.HTML.t`<div class="empty-state">No reminders set</div>`;
                  return reminders
                    .filter(r => !r.sent)
                    .sort((a, b) => new Date(a.triggerAt) - new Date(b.triggerAt))
                    .map(reminder => _.ReminderItem.new({ reminder }));
                }}
              </div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "ChatMessage",
    doc: "Single message in the chat view",
    slots: [
      $html.Component,
      $.Var.new({ name: "message" }),
      formatTimestamp,
      $.Method.new({
        name: "subtitle",
        do() {
          const msg = this.message();
          if (msg.role === "system") return null;
          if (msg.role === "user") {
            const source = msg.source && msg.source !== "ui" ? msg.source : "user";
            return source;
          }
          return msg.source || "geist";
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          const msg = this.message();
          const subtitle = this.subtitle();
          const timestamp = this.formatTimestamp(msg.timestamp || msg.createdAt);
          return $html.HTML.t`
            <div class=${"chat-message " + msg.role}>
              ${subtitle ? $html.HTML.t`
                <div class="message-meta">
                  <span class="message-source">${subtitle}</span>
                  ${timestamp ? $html.HTML.t`<span class="message-timestamp">${timestamp}</span>` : ""}
                </div>
              ` : ""}
              <div class="message-content">${msg.content}</div>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "ChatView",
    doc: "Dual-purpose chat: activity log and geist interaction",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Signal.new({ name: "inputText", default: "" }),
      $.Signal.new({ name: "generating", default: false }),
      $.Method.new({
        name: "handleSubmit",
        async do(e) {
          e.preventDefault();
          const input = e.target.querySelector('.chat-input');
          const text = input.value.trim();
          if (!text) return;
          input.value = "";
          this.inputText("");
          await this.app().sendMessage(text);
        }
      }),
      $.Method.new({
        name: "handleNudge",
        async do() {
          if (this.generating()) return;
          this.generating(true);
          try {
            await this.app().generatePrompts();
          } catch (e) {
            this.app().addMessage({ role: "system", content: `Nudge failed: ${e.message}` });
          } finally {
            this.generating(false);
          }
        }
      }),
      $.Method.new({
        name: "scrollToBottom",
        do() {
          requestAnimationFrame(() => {
            const el = document.querySelector('.chat-messages');
            if (el) el.scrollTop = el.scrollHeight;
          });
        }
      }),
      $.After.new({
        name: "init",
        do() {
          $.Effect.create(() => {
            this.app().messages();
            this.app().pendingPrompts();
            this.scrollToBottom();
          });
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="chat-view view">
              <div class="chat-messages">
                ${() => this.app().messages().map(msg => _.ChatMessage.new({ message: msg }))}
                ${() => this.app().pendingPrompts().map(prompt => _.PromptMessage.new({ app: this.app(), prompt }))}
                ${() => this.app().loading() ? $html.HTML.t`<div class="chat-message assistant typing">thinking...</div>` : ""}
              </div>
              <form class="chat-input-form" onsubmit=${e => this.handleSubmit(e)}>
                <button type="button" class="nudge-btn" onclick=${() => this.handleNudge()}
                        disabled=${() => this.generating()}>
                  ${() => this.generating() ? "..." : "nudge"}
                </button>
                <input type="text" class="chat-input" placeholder="Ask anything..."
                       oninput=${e => this.inputText(e.target.value)}
                       onchange=${e => this.inputText(e.target.value)}
                       onfocus=${e => this.inputText(e.target.value)} />
                <button type="submit" class="chat-send" disabled=${() => this.app().loading()}>
                  ${() => this.app().loading() ? "..." : "send"}
                </button>
              </form>
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "BottomNav",
    doc: "Tab navigation between views",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Method.new({
        name: "render",
        do() {
          const tabs = [
            { id: "chat", icon: "chat", label: "Chat" },
            { id: "todos", icon: "check", label: "Tasks" },
            { id: "journal", icon: "book", label: "Journal" },
            { id: "calendar", icon: "bell", label: "Reminders" },
          ];
          return $html.HTML.t`
            <nav class="bottom-nav">
              ${tabs.map(tab => $html.HTML.t`
                <button class=${() => "nav-tab" + (this.app().activeView() === tab.id ? " active" : "")}
                        onclick=${() => this.app().activeView(tab.id)}>
                  <span class="nav-icon">${tab.icon}</span>
                </button>
              `)}
            </nav>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "Bumper",
    doc: "Footer bumper with current day",
    slots: [
      $html.Component,
      $.Method.new({
        name: "dayText",
        do() {
          return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        }
      }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="bumper">
              ${this.dayText()}
            </div>
          `;
        }
      })
    ]
  });

  $.Class.new({
    name: "AgendaApp",
    doc: "Main agenda web application",
    slots: [
      $html.Component,
      $.Signal.new({ name: "activeView", default: "chat" }),
      $.Signal.new({ name: "tasks", default: [] }),
      $.Signal.new({ name: "logs", default: [] }),
      $.Signal.new({ name: "reminders", default: [] }),
      $.Signal.new({ name: "messages", default: [] }),
      $.Signal.new({ name: "loading", default: false }),
      $.Signal.new({ name: "connectionState", default: "connecting" }),
      $.Signal.new({ name: "fallbackPolling", default: false }),
      $.Signal.new({ name: "pendingPrompts", default: [] }),
      $.Var.new({ name: "api" }),
      $.Var.new({ name: "lastSeenId", default: null }),
      $.Var.new({ name: "syncRunning", default: false }),
      $.Var.new({ name: "syncFailCount", default: 0 }),
      $.Var.new({ name: "clientUid", default: () => 'ui-' + Math.random().toString(36).slice(2, 10) }),

      $.After.new({
        name: "init",
        do() {
          this.api(_.AgendaApiClient.new());
          this.initConnection();
        }
      }),

      $.Method.new({
        name: "initConnection",
        async do() {
          try {
            await this.api().getStatus();
            this.connectionState("connected");
            this.addMessage({ role: "system", content: "Connected to Agenda" });
            await this.loadChatHistory();
            await this.refreshData();
            await this.loadPendingPrompts();
            this.startSyncLoop();
          } catch (e) {
            this.connectionState("offline");
            this.addMessage({ role: "system", content: "Cannot connect to server" });
            setTimeout(() => this.initConnection(), 5000);
          }
        }
      }),

      $.Method.new({
        name: "connected",
        do() {
          return this.connectionState() === "connected";
        }
      }),

      $.Method.new({
        name: "loadChatHistory",
        doc: "load chat history from the server on connect",
        async do() {
          try {
            const history = await this.api().chatHistory({ conversationId: "main", limit: 10 });
            if (history && history.length > 0) {
              this.messages(history);
              this.lastSeenId(history[history.length - 1].id);
            }
          } catch (e) {
            this.addMessage({ role: "system", content: `Failed to load history: ${e.message}` });
          }
        }
      }),

      $.Method.new({
        name: "startSyncLoop",
        doc: "start the background sync loop for new messages via HTTP long-polling",
        async do() {
          if (this.syncRunning()) return;
          this.syncRunning(true);

          while (this.syncRunning() && this.connected()) {
            try {
              const newMessages = await this.api().chatWait({
                conversationId: "main",
                afterId: this.lastSeenId() || 0,
                timeoutMs: 20000,
                limit: 50
              });

              this.syncFailCount(0);
              if (this.fallbackPolling()) {
                this.fallbackPolling(false);
              }

              if (newMessages && newMessages.length > 0) {
                const currentMessages = this.messages();
                const existingIds = new Set(currentMessages.map(m => m.id));
                const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));

                if (uniqueNew.length > 0) {
                  this.messages([...currentMessages, ...uniqueNew]);
                  this.lastSeenId(newMessages[newMessages.length - 1].id);
                }
              }
            } catch (e) {
              if (this.connected()) {
                const failCount = this.syncFailCount() + 1;
                this.syncFailCount(failCount);
                this.api().markFailure();
                if (failCount >= 3) {
                  this.connectionState("reconnecting");
                  this.syncRunning(false);
                  setTimeout(() => this.initConnection(), 5000);
                  return;
                }
                await new Promise(r => setTimeout(r, 2000));
              }
            }
          }
        }
      }),

      $.Method.new({
        name: "refreshData",
        async do() {
          if (!this.connected()) return;
          try {
            const [tasks, logs, reminders] = await Promise.all([
              this.api().listTasks({}),
              this.api().listLogs({ limit: 50 }),
              this.api().listReminders({}),
            ]);
            this.tasks(tasks);
            this.logs(logs);
            this.reminders(reminders);
          } catch (e) {
            this.addMessage({ role: "system", content: `Refresh failed: ${e.message}` });
          }
        }
      }),

      $.Method.new({
        name: "addMessage",
        do(msg) {
          this.messages([...this.messages(), msg]);
        }
      }),

      $.Method.new({
        name: "sendMessage",
        async do(text) {
          if (!this.connected()) {
            this.addMessage({ role: "system", content: "Not connected - try reconnecting" });
            return;
          }
          const clientMessageId = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
          this.addMessage({ role: "user", content: text, source: "ui", _pending: clientMessageId });
          this.loading(true);
          try {
            const result = await this.api().chatSend({
              conversationId: "main",
              text,
              source: "ui",
              clientUid: this.clientUid(),
              clientMessageId,
            });
            if (result.success) {
              const msgs = this.messages().filter(m => m._pending !== clientMessageId);
              if (result.userMessage) msgs.push(result.userMessage);
              if (result.assistantMessage) {
                msgs.push(result.assistantMessage);
                this.lastSeenId(result.assistantMessage.id);
              }
              this.messages(msgs);
            } else {
              this.addMessage({ role: "system", content: `Error: ${result.error}` });
            }
            await this.refreshData();
          } catch (e) {
            this.addMessage({ role: "system", content: `Error: ${e.message}` });
          } finally {
            this.loading(false);
          }
        }
      }),

      $.Method.new({
        name: "completeTask",
        async do(taskId) {
          if (!this.connected()) return;
          try {
            await this.api().completeTask(taskId);
            await this.refreshData();
          } catch (e) {
            this.addMessage({ role: "system", content: `Failed to complete task: ${e.message}` });
          }
        }
      }),

      $.Method.new({
        name: "loadPendingPrompts",
        doc: "fetch pending prompts from the API",
        async do() {
          if (!this.connected()) return;
          try {
            const prompts = await this.api().getPendingPrompts({ limit: 5 });
            this.pendingPrompts(prompts || []);
          } catch (e) {
            this.pendingPrompts([]);
          }
        }
      }),

      $.Method.new({
        name: "actionPrompt",
        doc: "handle user action on a prompt and refresh",
        async do(id, action) {
          if (!this.connected()) return;
          try {
            const prompt = this.pendingPrompts().find(p => p.id === id);
            await this.api().actionPrompt({ id, action });
            if (prompt) {
              const label = { done: "marked done", snooze: "snoozed", backlog: "backlogged", dismiss: "dismissed" }[action] || action;
              const snippet = prompt.message.length > 60 ? prompt.message.slice(0, 57) + "..." : prompt.message;
              this.addMessage({ role: "system", content: `${label}: "${snippet}"` });
            }
            await this.loadPendingPrompts();
            if (action === "done" || action === "backlog") {
              await this.refreshData();
            }
          } catch (e) {
            this.addMessage({ role: "system", content: `Failed to action prompt: ${e.message}` });
          }
        }
      }),

      $.Method.new({
        name: "generatePrompts",
        doc: "manually trigger prompt generation",
        async do() {
          if (!this.connected()) {
            this.addMessage({ role: "system", content: "Not connected - try reconnecting" });
            return;
          }
          try {
            const result = await this.api().generatePrompts();
            if (!result.success) {
              this.addMessage({ role: "system", content: `Prompt generation failed: ${result.error}` });
              return;
            }
            if (result.promptsCreated === 0) {
              this.addMessage({ role: "system", content: "No new prompts to suggest" });
            }
            await this.loadPendingPrompts();
          } catch (e) {
            this.addMessage({ role: "system", content: `Failed to generate prompts: ${e.message}` });
          }
        }
      }),

      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="agenda-app">
              ${_.TopBar.new({ app: this })}
              <div class="view-container">
                <div hidden=${() => this.activeView() !== "chat"}>
                  ${_.ChatView.new({ app: this })}
                </div>
                <div hidden=${() => this.activeView() !== "todos"}>
                  ${_.TodosView.new({ app: this })}
                </div>
                <div hidden=${() => this.activeView() !== "journal"}>
                  ${_.JournalView.new({ app: this })}
                </div>
                <div hidden=${() => this.activeView() !== "calendar"}>
                  ${_.CalendarView.new({ app: this })}
                </div>
              </div>
              ${_.BottomNav.new({ app: this })}
              ${_.Bumper.new()}
            </div>
          `;
        }
      })
    ]
  });

  _.AgendaApp.new().mount();

}.module({ name: "agenda.ui", imports: [base, html] }).load();
