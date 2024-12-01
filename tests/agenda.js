import base from '../src/base';
import test from '../src/test.js';
import todos from '../demos/agenda.js';
const __ = globalThis.SIMULABRA;

export default await base.find('Class', 'Module').new({
  name: 'TestAgendas',
  registry: base.find('Class', 'ObjectRegistry').new(),
  imports: [test, todos],
  on_load(_, $) {
    const agenda = $.Agenda.new();
    $.Case.new({
      name: 'SimpleLog',
      do() {
        const before = new Date();
        const message = 'todo test';
        const command = $.LogCommand.new({
          message,
        });
        const after = new Date();
        const timestamp = command.createdAt();
        this.assert(+before <= +timestamp && +after >= +timestamp, `timestamp not in correct time range: ${before} -> ${timestamp} -> ${after}`);

        this.assertEq(command.message(), message);
        agenda.processCommand(command);
        this.assert(agenda.logs().length === 1 && agenda.logs()[0].indexOf('todo test') > 0, 'message not found in logs');
      }
    });

    $.Case.new({
      name: 'SimpleTask',
      do() {
        const task = $.Task.new({
          title: 'test agenda',
          created: new Date(),
        });

        const command = $.TaskCommand.new({
          task,
        });

        agenda.processCommand(command);
        this.assertEq(agenda.tasks().length, 1);
        this.assertEq(agenda.tasks()[0].title(), 'test agenda');
      }
    });
  }
}).load();
