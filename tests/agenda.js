import { __, base } from '../src/base.js';
import test from '../src/test.js';
import todos from '../demos/agenda.js';

export default await function (_, $, $test, $todos) {
  const agenda = $todos.Agenda.new();
  $test.Case.new({
    name: 'SimpleNote',
    do() {
      const message = 'time to test the agenda I think';
      const note = $todos.Note.new({ message });
      const command = note.createCommand(agenda);
      this.assertEq(command.parent().message(), message);
      command.run();
      this.assert(agenda.notes().length === 1 && agenda.notes()[0].message() === message, 'message not found in notes');
    }
  });
  $test.Case.new({
    name: 'SimpleTodo',
    do() {
      const todo = $todos.Todo.new({ content: 'test agenda' });
      todo.create(agenda);
      this.assertEq(agenda.todos().length, 1);
      this.assertEq(agenda.todos()[0].content(), 'test agenda');
      this.assertEq(agenda.notes()[1].message(), 'added todo "test agenda"');
    }
  });
  $test.Case.new({
    name: 'LoadNotes',
    do() {
      const notes = $todos.Note.loadAll(agenda.db());
      this.assertEq(notes[0].pid(), 1);
      this.assertEq(notes[1].pid(), 2);
      this.assertEq(notes[0].source(), 'user');
      this.assertEq(notes[1].source(), 'system');
      this.assert(+notes[0].created() <= +notes[1].created(), `notes created out of order ${+notes[0].created()} ${+notes[1].created()}`);
      this.assertEq(notes[0].message(), 'time to test the agenda I think');
    }
  });
  $test.Case.new({
    name: 'LoadTodos',
    do() {
      const todos = $todos.Todo.loadAll(agenda.db());
      this.assertEq(todos[0].pid(), 1);
      this.assertEq(todos[0].content(), 'test agenda');
      this.assertEq(todos[0].finished(), null);
    }
  });
  $test.Case.new({
    name: 'FinishTodo',
    do() {
      const todo = agenda.todos()[0];
      todo.finish(agenda);
      this.assert(todo.finished() instanceof Date, `todo not finished: ${todo.finished()}`);
      this.assertEq(agenda.todos().length, 0);
      const dbTodos = $todos.Todo.loadAll(agenda.db());
      this.assert(dbTodos[0].finished() instanceof Date, `todo not finished in db: ${typeof dbTodos[0].finished()}`);
    }
  });
}.module({
  name: 'test.agendas',
  imports: [test, todos],
}).load();
