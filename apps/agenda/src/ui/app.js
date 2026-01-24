import html from "simulabra/html";
import { __, base } from "simulabra";

export default await async function (_, $, $html) {

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
    doc: "Classic todo list view with task status",
    slots: [
      $html.Component,
      $.Var.new({ name: "app" }),
      $.Method.new({
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="todos-view view">
              <div class="view-header">
                <h2>Tasks</h2>
                <span class="task-count">${() => this.app().tasks().filter(t => !t.done).length} active</span>
              </div>
              <div class="task-list">
                ${() => {
                  const tasks = this.app().tasks();
                  if (!tasks.length) return $html.HTML.t`<div class="empty-state">No tasks yet</div>`;
                  return tasks
                    .sort((a, b) => (a.priority || 3) - (b.priority || 3))
                    .map(task => _.TaskItem.new({ app: this.app(), task }));
                }}
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
      $.Method.new({
        name: "formatTimestamp",
        do(ts) {
          if (!ts) return "";
          return new Date(ts).toISOString();
        }
      }),
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
      $.Method.new({
        name: "handleSubmit",
        async do(e) {
          e.preventDefault();
          const text = this.inputText().trim();
          if (!text) return;
          this.inputText("");
          await this.app().sendMessage(text);
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
                ${() => this.app().loading() ? $html.HTML.t`<div class="chat-message assistant typing">thinking...</div>` : ""}
              </div>
              <form class="chat-input-form" onsubmit=${e => this.handleSubmit(e)}>
                <input type="text" class="chat-input" placeholder="Ask anything..."
                       value=${() => this.inputText()}
                       oninput=${e => this.inputText(e.target.value)} />
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
      $html.LiveBrowserClient,
      $.Signal.new({ name: "activeView", default: "chat" }),
      $.Signal.new({ name: "tasks", default: [] }),
      $.Signal.new({ name: "logs", default: [] }),
      $.Signal.new({ name: "reminders", default: [] }),
      $.Signal.new({ name: "messages", default: [] }),
      $.Signal.new({ name: "loading", default: false }),
      $.Signal.new({ name: "connectionState", default: "offline" }),
      $.Signal.new({ name: "fallbackPolling", default: false }),
      $.Var.new({ name: "lastSeenId", default: null }),
      $.Var.new({ name: "syncRunning", default: false }),
      $.Var.new({ name: "syncFailCount", default: 0 }),
      $.Var.new({ name: "clientUid", default: () => 'ui-' + Math.random().toString(36).slice(2, 10) }),

      $.After.new({
        name: "init",
        do() {
          this.onConnect(async () => {
            this.connectionState("connected");
            this.fallbackPolling(false);
            this.syncFailCount(0);
            this.addMessage({ role: "system", content: "Connected to Agenda" });
            await this.loadChatHistory();
            this.refreshData();
            this.startSyncLoop();
          });
          this.onDisconnect(() => {
            this.connectionState("reconnecting");
            this.syncRunning(false);
          });
          this.onError(() => {
            if (this.connectionState() !== "reconnecting") {
              this.connectionState("offline");
            }
          });
          setTimeout(() => this.connect().catch(() => {
            this.connectionState("offline");
          }), 100);
        }
      }),

      $.Method.new({
        name: "loadChatHistory",
        doc: "load chat history from the server on connect",
        async do() {
          try {
            const history = await this.rpcCall("DatabaseService", "listChatMessages", [{ conversationId: "main", limit: 10 }]);
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
        doc: "start the background sync loop for new messages with fallback polling",
        async do() {
          if (this.syncRunning()) return;
          this.syncRunning(true);

          while (this.syncRunning() && this.connected()) {
            try {
              let newMessages;
              if (this.fallbackPolling()) {
                newMessages = await this.rpcCall("DatabaseService", "readChatMessages", [{
                  conversationId: "main",
                  afterId: this.lastSeenId() || 0,
                  limit: 50
                }]);
                await new Promise(r => setTimeout(r, 5000));
              } else {
                newMessages = await this.rpcCall("DatabaseService", "waitForChatMessages", [{
                  conversationId: "main",
                  afterId: this.lastSeenId(),
                  timeoutMs: 20000,
                  limit: 50
                }]);
              }

              this.syncFailCount(0);
              if (this.fallbackPolling()) {
                this.fallbackPolling(false);
                this.addMessage({ role: "system", content: "Sync restored" });
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
                if (failCount >= 3 && !this.fallbackPolling()) {
                  this.fallbackPolling(true);
                  this.addMessage({ role: "system", content: "Falling back to polling" });
                }
                await new Promise(r => setTimeout(r, this.fallbackPolling() ? 5000 : 2000));
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
              this.rpcCall("DatabaseService", "listTasks", [{}]),
              this.rpcCall("DatabaseService", "listLogs", [50]),
              this.rpcCall("DatabaseService", "listReminders", [{}]),
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
            const result = await this.rpcCall("GeistService", "interpretMessage", [{
              conversationId: "main",
              text,
              source: "ui",
              clientUid: this.clientUid(),
              clientMessageId,
            }]);
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
            await this.rpcCall("DatabaseService", "completeTask", [taskId]);
            await this.refreshData();
          } catch (e) {
            this.addMessage({ role: "system", content: `Failed to complete task: ${e.message}` });
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
