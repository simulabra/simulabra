import { __, base } from 'simulabra';
import logs from 'simulabra/logs';

export default await async function (_, $, $logs) {
  $.Class.new({
    name: 'AgendaLogFormatter',
    doc: 'LogFormatter with Agenda service colors pre-configured',
    slots: [
      $logs.LogFormatter,
      $.Var.new({
        name: 'colors',
        default: () => ({
          'supervisor': '\x1b[36m',
          'DatabaseService': '\x1b[32m',
          'ReminderService': '\x1b[33m',
          'GeistService': '\x1b[35m',
        }),
      }),
    ]
  });

  $.Class.new({
    name: 'AgendaLogStreamer',
    doc: 'LogStreamer pre-configured for Agenda services',
    slots: [
      $logs.LogStreamer,
      $.Var.new({
        name: 'formatter',
        default: () => _.AgendaLogFormatter.new(),
      }),
    ]
  });
}.module({
  name: 'agenda:logs',
  imports: [base, logs],
}).load();
