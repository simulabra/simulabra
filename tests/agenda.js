import base from '../src/base';
import test from '../src/test.js';
import todos from '../demos/agenda.js';
const __ = globalThis.SIMULABRA;

export default await base.find('Class', 'Module').new({
  name: 'TestAgendas',
  registry: base.find('Class', 'ObjectRegistry').new(),
  imports: [test, todos],
  on_load(_, $) {
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
      }
    })
  }
}).load();
