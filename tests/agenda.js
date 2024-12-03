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
      name: 'SimpleNote',
      do() {
        const before = new Date();
        const message = 'time to test the agenda I think';
        const note = $.NoteFragment.new({
          message
        });
        const command = $.NoteCommand.new({
          note,
        });
        const after = new Date();
        const timestamp = command.createdAt();
        this.assert(+before <= +timestamp && +after >= +timestamp, `timestamp not in correct time range: ${before} -> ${timestamp} -> ${after}`);

        this.assertEq(command.note().message(), message);
        agenda.processCommand(command);
        this.assert(agenda.notes().length === 1 && agenda.notes()[0].message() === message, 'message not found in notes');
      }
    });

    $.Case.new({
      name: 'SimpleTask',
      do() {
        const task = $.Task.new({
          title: 'test agenda',
          created: new Date(),
        });

        const command = $.TodoCommand.new({
          task,
        });

        agenda.processCommand(command);
        this.assertEq(agenda.tasks().length, 1);
        this.assertEq(agenda.tasks()[0].title(), 'test agenda');
        this.assertEq(agenda.notes()[1].message(), 'added task "test agenda"');
      }
    });

    $.Case.new({
      name: 'LoadNotes',
      do() {
        const notes = agenda.loadNotes();
        this.assertEq(notes[0].dbid(), 1);
        this.assertEq(notes[1].dbid(), 2);
        this.assertEq(notes[0].source(), 'user');
        this.assertEq(notes[1].source(), 'system');
        this.assert(+notes[0].created() <= +notes[1].created(), `notes created out of order ${+notes[0].created()} ${+notes[1].created()}`);
        this.assertEq(notes[0].message(), 'time to test the agenda I think');
      }
    });
  }
}).load();
