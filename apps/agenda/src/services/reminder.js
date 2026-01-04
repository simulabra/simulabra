import { __, base } from 'simulabra';
import live from 'simulabra/live';

export default await async function (_, $, $live) {
  $.Class.new({
    name: 'ReminderService',
    doc: 'Polls for due reminders and triggers notifications',
    slots: [
      $live.NodeClient,
      $.Var.new({ name: 'dbService' }),
      $.Var.new({ name: 'pollIntervalMs', default: 60000 }),
      $.Var.new({ name: 'running', default: false }),
      $.Var.new({ name: 'pollTimer' }),
      $.Var.new({ name: 'notificationHandlers', default: () => [] }),

      // Health check
      $live.RpcMethod.new({
        name: 'health',
        do() {
          return {
            status: 'ok',
            service: 'ReminderService',
            running: this.running(),
          };
        }
      }),

      $.Method.new({
        name: 'addNotificationHandler',
        doc: 'add a handler function for notifications',
        do(handler) {
          this.notificationHandlers().push(handler);
        }
      }),

      $.Method.new({
        name: 'collectNotifications',
        doc: 'get due reminders without processing',
        async do() {
          const db = this.dbService();
          if (!db) {
            this.tlog('no database service connected');
            return [];
          }
          const dueReminders = await db.getDueReminders();
          return dueReminders;
        }
      }),

      $.Method.new({
        name: 'checkDueReminders',
        doc: 'check for due reminders and process them',
        async do() {
          const db = this.dbService();
          if (!db) {
            this.tlog('no database service connected');
            return [];
          }

          const dueReminders = await db.getDueReminders();
          if (dueReminders.length === 0) {
            return [];
          }

          this.tlog(`found ${dueReminders.length} due reminder(s)`);

          const processed = [];
          for (const reminder of dueReminders) {
            // Trigger notifications
            await this.triggerNotification(reminder);

            // Mark as sent (this also handles recurrence in DatabaseService)
            await db.markReminderSent(reminder.rid);
            processed.push(reminder);
          }

          return processed;
        }
      }),

      $.Method.new({
        name: 'triggerNotification',
        doc: 'send notification for a reminder',
        async do(reminder) {
          // Log the notification
          this.tlog(`REMINDER: ${reminder.message}`);

          // Call registered handlers
          for (const handler of this.notificationHandlers()) {
            try {
              await handler(reminder);
            } catch (e) {
              this.tlog(`notification handler error: ${e.message}`);
            }
          }
        }
      }),

      $.Method.new({
        name: 'startPolling',
        doc: 'start the polling loop',
        do() {
          if (this.running()) {
            return;
          }
          this.running(true);
          this.tlog(`starting polling every ${this.pollIntervalMs()}ms`);
          this.poll();
        }
      }),

      $.Method.new({
        name: 'poll',
        doc: 'single poll iteration',
        async do() {
          if (!this.running()) {
            return;
          }

          try {
            await this.checkDueReminders();
          } catch (e) {
            this.tlog(`poll error: ${e.message}`);
          }

          if (this.running()) {
            this.pollTimer(setTimeout(() => this.poll(), this.pollIntervalMs()));
          }
        }
      }),

      $.Method.new({
        name: 'stopPolling',
        doc: 'stop the polling loop',
        do() {
          this.running(false);
          if (this.pollTimer()) {
            clearTimeout(this.pollTimer());
            this.pollTimer(null);
          }
          this.tlog('stopped polling');
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
    const service = _.ReminderService.new({ uid: 'ReminderService' });
    await service.connect();
    await service.connectToDatabase();
    service.startPolling();
    __.tlog('ReminderService started');
  }
}.module({
  name: 'services.reminder',
  imports: [base, live],
}).load();
