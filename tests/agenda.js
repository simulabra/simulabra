import base from '../src/base';
import test from '../src/test.js';
import todos from '../demos/agenda.js';
const __ = globalThis.SIMULABRA;

export default await __.$().Module.new({
  name: 'TestAgendas',
  imports: [test, todos],
  on_load(_, $) {
    const agenda = $.Agenda.new();
    $.Case.new({
      name: 'SimpleNote',
      do() {
        const message = 'time to test the agenda I think';
        const note = $.Note.new({ message });
        const command = note.command();
        this.assertEq(command.note().message(), message);
        agenda.processCommand(command);
        this.assert(agenda.notes().length === 1 && agenda.notes()[0].message() === message, 'message not found in notes');
      }
    });

    $.Case.new({
      name: 'SimpleTodo',
      do() {
        const todo = $.Todo.new({ content: 'test agenda' });
        const command = todo.command();
        agenda.processCommand(command);
        this.assertEq(agenda.todos().length, 1);
        this.assertEq(agenda.todos()[0].content(), 'test agenda');
        this.assertEq(agenda.notes()[1].message(), 'added todo "test agenda"');
      }
    });

    $.Case.new({
      name: 'LoadNotes',
      do() {
        const notes = $.Note.loadAll(agenda.db());
        this.assertEq(notes[0].pid(), 1);
        this.assertEq(notes[1].pid(), 2);
        this.assertEq(notes[0].source(), 'user');
        this.assertEq(notes[1].source(), 'system');
        this.assert(+notes[0].created() <= +notes[1].created(), `notes created out of order ${+notes[0].created()} ${+notes[1].created()}`);
        this.assertEq(notes[0].message(), 'time to test the agenda I think');
      }
    });

    $.Case.new({
      name: 'LoadTodos',
      do() {
        const todos = $.Todo.loadAll(agenda.db());
        this.log(todos[0].content());
        this.assertEq(todos[0].pid(), 1);
        this.assertEq(todos[0].content(), 'test agenda');
        this.assertEq(todos[0].finished(), null);
      }
    });

    $.Case.new({
      name: 'FinishTodo',
      do() {
        const todo = agenda.todos()[0];
        const command = $.FinishTodoCommand.new({
          todo
        });
        agenda.processCommand(command);
        this.assert(todo.finished() instanceof Date, `todo not finished: ${todo.finished()}`);
        this.assertEq(agenda.todos().length, 0);
        const dbTodos = $.Todo.loadAll(agenda.db());
        this.assert(dbTodos[0].finished() instanceof Date, `todo not finished in db: ${typeof dbTodos[0].finished()}`);
      }
    });
  }
}).load();
