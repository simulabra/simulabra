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
        name: "render",
        do() {
          return $html.HTML.t`
            <div class="top-bar">
              <h1 class="title">AGENDA</h1>
              <div class="connection-status">${() => this.app().connected() ? "connected" : "offline"}</div>
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
        name: "render",
        do() {
          const msg = this.message();
          return $html.HTML.t`
            <div class=${"chat-message " + msg.role}>
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
                  <span class="nav-label">${tab.label}</span>
                </button>
              `)}
            </nav>
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
      $.Signal.new({ name: "connected", default: false }),
      $.Var.new({ name: "socket" }),
      $.Var.new({ name: "pendingCalls", default: () => new Map() }),
      $.Var.new({ name: "callId", default: 0 }),

      $.After.new({
        name: "init",
        do() {
          // Defer connection to avoid blocking render
          setTimeout(() => this.connectToBackend(), 100);
        }
      }),

      $.Method.new({
        name: "connectToBackend",
        do() {
          const port = 3030;
          const wsUrl = `ws://${window.location.hostname}:${port}`;
          try {
            const socket = new WebSocket(wsUrl);
            this.socket(socket);

            socket.onopen = () => {
              this.connected(true);
              this.addMessage({ role: "system", content: "Connected to Agenda" });
              this.refreshData();
            };

            socket.onmessage = (event) => {
              const msg = JSON.parse(event.data);
              if (msg.callId && this.pendingCalls().has(msg.callId)) {
                const { resolve, reject } = this.pendingCalls().get(msg.callId);
                this.pendingCalls().delete(msg.callId);
                if (msg.error) reject(new Error(msg.error));
                else resolve(msg.result);
              }
            };

            socket.onclose = () => {
              this.connected(false);
            };

            socket.onerror = () => {
              this.connected(false);
              this.addMessage({ role: "system", content: "Offline mode" });
            };
          } catch (e) {
            this.connected(false);
            this.addMessage({ role: "system", content: `Offline mode` });
          }
        }
      }),

      $.Method.new({
        name: "rpcCall",
        async do(service, method, args) {
          if (!this.socket() || this.socket().readyState !== WebSocket.OPEN) {
            throw new Error("Not connected");
          }
          const callId = this.callId() + 1;
          this.callId(callId);
          return new Promise((resolve, reject) => {
            this.pendingCalls().set(callId, { resolve, reject });
            this.socket().send(JSON.stringify({
              type: "rpc",
              callId,
              service,
              method,
              args
            }));
          });
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
          this.addMessage({ role: "user", content: text });
          this.loading(true);
          try {
            if (!this.connected()) {
              this.addMessage({ role: "system", content: "Not connected - try reconnecting" });
              return;
            }
            const result = await this.rpcCall("GeistService", "interpret", [text]);
            if (result.success) {
              this.addMessage({ role: "assistant", content: result.response || "Done." });
              await this.refreshData();
            } else {
              this.addMessage({ role: "system", content: `Error: ${result.error}` });
            }
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
        name: "css",
        do() {
          return `
            :root {
              --bg: #1a1a2e;
              --surface: #16213e;
              --surface-alt: #0f3460;
              --primary: #e94560;
              --secondary: #533483;
              --text: #eaeaea;
              --text-dim: #a0a0a0;
              --success: #4ade80;
              --warning: #fbbf24;
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: var(--bg);
              color: var(--text);
              overflow: hidden;
            }

            .agenda-app {
              display: flex;
              flex-direction: column;
              height: 100dvh;
              max-width: 480px;
              margin: 0 auto;
            }

            /* Top Bar */
            .top-bar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 12px 16px;
              background: var(--surface);
              border-bottom: 1px solid var(--surface-alt);
            }

            .title {
              font-size: 18px;
              font-weight: 600;
              letter-spacing: 2px;
              color: var(--primary);
            }

            .connection-status {
              font-size: 11px;
              color: var(--text-dim);
              text-transform: uppercase;
            }

            /* Views */
            .view-container {
              flex: 1;
              overflow: hidden;
              position: relative;
            }

            .view {
              position: absolute;
              inset: 0;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }

            .view[hidden] { display: none; }

            .view-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 12px 16px;
              background: var(--surface);
            }

            .view-header h2 {
              font-size: 16px;
              font-weight: 500;
            }

            .task-count {
              font-size: 12px;
              color: var(--text-dim);
            }

            .empty-state {
              padding: 32px 16px;
              text-align: center;
              color: var(--text-dim);
              font-style: italic;
            }

            /* Task List */
            .task-list, .log-list, .reminder-list {
              flex: 1;
              overflow-y: auto;
              padding: 8px;
            }

            .task-item {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              padding: 12px;
              background: var(--surface);
              border-radius: 8px;
              margin-bottom: 8px;
            }

            .task-item.done {
              opacity: 0.5;
            }

            .task-item.priority-1 { border-left: 3px solid var(--primary); }
            .task-item.priority-2 { border-left: 3px solid var(--warning); }
            .task-item.priority-3 { border-left: 3px solid var(--text-dim); }

            .task-checkbox {
              background: var(--surface-alt);
              border: none;
              color: var(--text);
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 11px;
              cursor: pointer;
            }

            .task-checkbox:hover {
              background: var(--primary);
            }

            .task-content {
              flex: 1;
            }

            .task-title {
              display: block;
              font-size: 14px;
            }

            .task-due {
              font-size: 11px;
              color: var(--text-dim);
            }

            /* Log Entries */
            .log-entry {
              padding: 12px;
              background: var(--surface);
              border-radius: 8px;
              margin-bottom: 8px;
            }

            .log-timestamp {
              font-size: 11px;
              color: var(--text-dim);
              margin-bottom: 4px;
            }

            .log-content {
              font-size: 14px;
              line-height: 1.5;
            }

            .log-tags {
              margin-top: 8px;
              display: flex;
              gap: 6px;
              flex-wrap: wrap;
            }

            .tag {
              font-size: 11px;
              color: var(--secondary);
            }

            /* Reminders */
            .reminder-item {
              padding: 12px;
              background: var(--surface);
              border-radius: 8px;
              margin-bottom: 8px;
            }

            .reminder-item.past {
              border-left: 3px solid var(--warning);
            }

            .reminder-item.sent {
              opacity: 0.5;
            }

            .reminder-time {
              font-size: 12px;
              color: var(--primary);
              margin-bottom: 4px;
            }

            .reminder-message {
              font-size: 14px;
            }

            .reminder-recurring {
              display: inline-block;
              margin-top: 6px;
              font-size: 10px;
              color: var(--secondary);
              background: var(--surface-alt);
              padding: 2px 6px;
              border-radius: 4px;
            }

            /* Chat View */
            .chat-view {
              display: flex;
              flex-direction: column;
            }

            .chat-messages {
              flex: 1;
              overflow-y: auto;
              padding: 12px;
            }

            .chat-message {
              max-width: 85%;
              padding: 10px 14px;
              border-radius: 12px;
              margin-bottom: 8px;
              font-size: 14px;
              line-height: 1.4;
            }

            .chat-message.user {
              background: var(--primary);
              margin-left: auto;
              border-bottom-right-radius: 4px;
            }

            .chat-message.assistant {
              background: var(--surface);
              margin-right: auto;
              border-bottom-left-radius: 4px;
            }

            .chat-message.system {
              background: var(--surface-alt);
              margin: 0 auto;
              font-size: 12px;
              color: var(--text-dim);
              text-align: center;
            }

            .chat-input-form {
              display: flex;
              gap: 8px;
              padding: 12px;
              background: var(--surface);
              border-top: 1px solid var(--surface-alt);
            }

            .chat-input {
              flex: 1;
              background: var(--surface-alt);
              border: none;
              border-radius: 20px;
              padding: 10px 16px;
              color: var(--text);
              font-size: 14px;
            }

            .chat-input:focus {
              outline: none;
              box-shadow: 0 0 0 2px var(--primary);
            }

            .chat-input::placeholder {
              color: var(--text-dim);
            }

            .chat-send {
              background: var(--primary);
              border: none;
              border-radius: 20px;
              padding: 10px 20px;
              color: var(--text);
              font-size: 14px;
              cursor: pointer;
            }

            .chat-send:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }

            /* Bottom Navigation */
            .bottom-nav {
              display: flex;
              background: var(--surface);
              border-top: 1px solid var(--surface-alt);
            }

            .nav-tab {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 4px;
              padding: 10px;
              background: none;
              border: none;
              color: var(--text-dim);
              cursor: pointer;
            }

            .nav-tab.active {
              color: var(--primary);
            }

            .nav-icon {
              font-size: 14px;
            }

            .nav-label {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
          `;
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
            </div>
          `;
        }
      })
    ]
  });

  _.AgendaApp.new().mount();

}.module({ name: "agenda.ui", imports: [base, html] }).load();
