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
          const source = msg.source;
          const showSource = source && source !== 'ui' && msg.role !== 'system';
          return $html.HTML.t`
            <div class=${"chat-message " + msg.role}>
              ${showSource ? $html.HTML.t`<span class="message-source">${source}</span>` : ""}
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
      $html.LiveBrowserClient,
      $.Signal.new({ name: "activeView", default: "chat" }),
      $.Signal.new({ name: "tasks", default: [] }),
      $.Signal.new({ name: "logs", default: [] }),
      $.Signal.new({ name: "reminders", default: [] }),
      $.Signal.new({ name: "messages", default: [] }),
      $.Signal.new({ name: "loading", default: false }),
      $.Var.new({ name: "lastSeenId", default: null }),
      $.Var.new({ name: "syncRunning", default: false }),
      $.Var.new({ name: "clientUid", default: () => 'ui-' + crypto.randomUUID().slice(0, 8) }),

      $.After.new({
        name: "init",
        do() {
          this.onConnect(async () => {
            this.addMessage({ role: "system", content: "Connected to Agenda" });
            await this.loadChatHistory();
            this.refreshData();
            this.startSyncLoop();
          });
          this.onError(() => {
            this.addMessage({ role: "system", content: "Offline mode" });
            this.syncRunning(false);
          });
          setTimeout(() => this.connect().catch(() => {}), 100);
        }
      }),

      $.Method.new({
        name: "loadChatHistory",
        doc: "load chat history from the server on connect",
        async do() {
          try {
            const history = await this.rpcCall("DatabaseService", "listChatMessages", [{ conversationId: "main", limit: 200 }]);
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
        doc: "start the background sync loop for new messages",
        async do() {
          if (this.syncRunning()) return;
          this.syncRunning(true);

          while (this.syncRunning() && this.connected()) {
            try {
              const newMessages = await this.rpcCall("DatabaseService", "waitForChatMessages", [{
                conversationId: "main",
                afterId: this.lastSeenId(),
                timeoutMs: 20000,
                limit: 50
              }]);

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
          this.loading(true);
          try {
            if (!this.connected()) {
              this.addMessage({ role: "system", content: "Not connected - try reconnecting" });
              return;
            }
            const result = await this.rpcCall("GeistService", "interpretMessage", [{
              conversationId: "main",
              text,
              source: "ui",
              clientUid: this.clientUid(),
              clientMessageId: crypto.randomUUID(),
            }]);
            if (!result.success) {
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
        name: "css",
        do() {
          return `
            :root {
              --charcoal: #463C3C;
              --wood: #B89877;
              --sand: #E2C79D;
              --light-sand: #EEDAB8;
              --seashell: #FAE8F4;
              --sky: #92B6D5;
              --ocean: #5893A8;
              --dusk: #D8586A;
              --grass: #40A472;
              --seaweed: #487455;

              --box-shadow-args: 1px 1px 0 0 var(--charcoal),
                                -1px -1px 0 0 var(--wood),
                                -2px -2px     var(--wood),
                                -2px  0       var(--wood),
                                  0  -2px      var(--wood),
                                  2px  2px 0 0 var(--charcoal),
                                  0   2px 0 0  var(--charcoal),
                                  2px  0       var(--charcoal),
                                  2px -2px     var(--wood),
                                -2px  2px     var(--charcoal);

              --box-shadow-args-inset: inset  1px  1px 0   var(--wood),
                                      inset  0    1px 0   var(--wood),
                                      inset  1px  0   0   var(--wood),
                                      inset -1px -1px 0   var(--charcoal),
                                      inset  0   -1px 0   var(--charcoal),
                                      inset -1px  0   0   var(--charcoal);
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            ::selection {
              background: var(--ocean);
              color: var(--seashell);
            }

            body {
              font-family: Georgia, 'Times New Roman', serif;
              background: var(--sand);
              color: var(--charcoal);
              overflow: hidden;
            }

            .agenda-app {
              display: flex;
              flex-direction: column;
              height: 100dvh;
              max-width: 480px;
              margin: 0 auto;
              padding: 4px;
              gap: 4px;
            }

            /* Top Bar */
            .top-bar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 4px 8px;
              background: var(--wood);
              box-shadow: var(--box-shadow-args);
            }

            .title {
              font-size: 16px;
              font-weight: normal;
              font-style: italic;
              letter-spacing: 2px;
              color: var(--seashell);
            }

            .connection-status {
              font-size: 11px;
              color: var(--seashell);
              font-style: italic;
              opacity: 0.8;
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
              padding: 4px 8px;
              background: var(--wood);
              box-shadow: var(--box-shadow-args);
            }

            .view-header h2 {
              font-size: 14px;
              font-weight: normal;
              font-style: italic;
              color: var(--seashell);
            }

            .task-count {
              font-size: 11px;
              color: var(--seashell);
              font-style: italic;
              opacity: 0.8;
            }

            .empty-state {
              padding: 32px 16px;
              text-align: center;
              color: var(--charcoal);
              font-style: italic;
              opacity: 0.6;
            }

            /* Task List */
            .task-list, .log-list, .reminder-list {
              flex: 1;
              overflow-y: auto;
              padding: 4px;
              background: var(--sand);
            }

            .task-item {
              display: flex;
              align-items: flex-start;
              gap: 8px;
              padding: 8px;
              background: var(--light-sand);
              box-shadow: var(--box-shadow-args);
              margin-bottom: 4px;
            }

            .task-item.done {
              opacity: 0.5;
            }

            .task-item.priority-1 { border-left: 3px solid var(--dusk); }
            .task-item.priority-2 { border-left: 3px solid var(--ocean); }
            .task-item.priority-3 { border-left: 3px solid var(--wood); }

            .task-checkbox {
              background: var(--sand);
              border: 0;
              box-shadow: var(--box-shadow-args);
              color: var(--seaweed);
              padding: 4px 8px;
              font-size: 11px;
              font-family: inherit;
              cursor: pointer;
            }

            .task-checkbox:hover {
              box-shadow: var(--box-shadow-args), var(--box-shadow-args-inset);
            }

            .task-checkbox:active {
              background: var(--wood);
            }

            .task-content {
              flex: 1;
            }

            .task-title {
              display: block;
              font-size: 14px;
              color: var(--charcoal);
            }

            .task-due {
              font-size: 11px;
              color: var(--ocean);
              font-style: italic;
            }

            /* Log Entries */
            .log-entry {
              padding: 8px;
              background: var(--light-sand);
              box-shadow: var(--box-shadow-args);
              margin-bottom: 4px;
            }

            .log-timestamp {
              font-size: 11px;
              color: var(--ocean);
              margin-bottom: 4px;
              font-style: italic;
            }

            .log-content {
              font-size: 14px;
              line-height: 1.5;
              color: var(--charcoal);
            }

            .log-tags {
              margin-top: 8px;
              display: flex;
              gap: 6px;
              flex-wrap: wrap;
            }

            .tag {
              font-size: 11px;
              color: var(--seaweed);
              font-style: italic;
            }

            /* Reminders */
            .reminder-item {
              padding: 8px;
              background: var(--light-sand);
              box-shadow: var(--box-shadow-args);
              margin-bottom: 4px;
            }

            .reminder-item.past {
              border-left: 3px solid var(--dusk);
            }

            .reminder-item.sent {
              opacity: 0.5;
            }

            .reminder-time {
              font-size: 12px;
              color: var(--ocean);
              margin-bottom: 4px;
              font-style: italic;
            }

            .reminder-message {
              font-size: 14px;
              color: var(--charcoal);
            }

            .reminder-recurring {
              display: inline-block;
              margin-top: 6px;
              font-size: 10px;
              color: var(--seaweed);
              background: var(--sand);
              padding: 2px 6px;
              box-shadow: var(--box-shadow-args);
            }

            /* Chat View */
            .chat-view {
              display: flex;
              flex-direction: column;
            }

            .chat-messages {
              flex: 1;
              overflow-y: auto;
              padding: 8px;
              background: var(--sand);
            }

            .chat-message {
              max-width: 85%;
              padding: 8px 12px;
              margin-bottom: 4px;
              font-size: 14px;
              line-height: 1.4;
              box-shadow: var(--box-shadow-args);
            }

            .chat-message.user {
              background: var(--ocean);
              color: var(--seashell);
              margin-left: auto;
            }

            .chat-message.assistant {
              background: var(--light-sand);
              color: var(--charcoal);
              margin-right: auto;
            }

            .chat-message.system {
              background: var(--wood);
              color: var(--seashell);
              margin: 4px auto;
              font-size: 12px;
              font-style: italic;
              text-align: center;
            }

            .message-source {
              display: block;
              font-size: 10px;
              font-style: italic;
              opacity: 0.7;
              margin-bottom: 2px;
            }

            .chat-message.user .message-source {
              text-align: right;
            }

            .chat-input-form {
              display: flex;
              gap: 4px;
              padding: 4px;
              background: var(--wood);
              box-shadow: var(--box-shadow-args);
            }

            .chat-input {
              flex: 1;
              background: var(--light-sand);
              border: 0;
              box-shadow: var(--box-shadow-args);
              padding: 8px 12px;
              color: var(--charcoal);
              font-size: 14px;
              font-family: inherit;
            }

            .chat-input:focus {
              outline: none;
              box-shadow: var(--box-shadow-args), var(--box-shadow-args-inset);
            }

            .chat-input::placeholder {
              color: var(--charcoal);
              opacity: 0.5;
            }

            .chat-send {
              background: var(--grass);
              border: 0;
              box-shadow: var(--box-shadow-args);
              padding: 8px 16px;
              color: var(--seashell);
              font-size: 14px;
              font-family: inherit;
              font-style: italic;
              cursor: pointer;
            }

            .chat-send:hover {
              box-shadow: var(--box-shadow-args), var(--box-shadow-args-inset);
            }

            .chat-send:active {
              background: var(--seaweed);
            }

            .chat-send:disabled {
              background: var(--wood);
              opacity: 0.5;
              cursor: not-allowed;
            }

            /* Bottom Navigation */
            .bottom-nav {
              display: flex;
              background: var(--wood);
              box-shadow: var(--box-shadow-args);
            }

            .nav-tab {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 2px;
              padding: 6px;
              background: var(--sand);
              border: 0;
              box-shadow: var(--box-shadow-args);
              color: var(--charcoal);
              cursor: pointer;
              font-family: inherit;
              margin: 2px;
            }

            .nav-tab:hover {
              box-shadow: var(--box-shadow-args), var(--box-shadow-args-inset);
            }

            .nav-tab:active {
              background: var(--wood);
            }

            .nav-tab.active {
              background: var(--light-sand);
              color: var(--ocean);
            }

            .nav-icon {
              font-size: 12px;
            }

            .nav-label {
              font-size: 9px;
              font-style: italic;
            }

            [hidden] {
              display: none !important;
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
