import { Class, Method, Var } from './base.js';
import { ListElement, Element, Button, Input, Span, Div } from './html.js';
import { CallbackCommand } from './commands.js';

export const TodoItemView = Class.new({
  name: 'TodoItemView',
  super: Element,
  static: {
    create(todo) {
      return this.new({
        todo,
        button: Button.new({
          inner: 'Toggle',
          id: `toggle-button-${todo.num()}`,
          click: CallbackCommand.new({
            fn(ev) {
              this.isDone(!this.isDone());
              this.render();
            },
          }),
        }),
      });
    }
  },
  slots: {
    todo: Var.new(),
    button: Var.new(),
    html: Method.new({
      do() {
        return ListElement.new({
          id: `todo-item-${this.todo().num()}`,
          list: [
            `[ ${this.todo().isDone() ? 'x' : ''} ]`,
            this.todo().text(),
          ]
        }).html();
      }
    })
  }
});


export const TodoItem = Class.new({
  name: 'TodoItem',
  static: {
    idCounter: Var.default(0),
    create: Method.do(function create({ text }) {
      this.idCounter(this.idCounter() + 1);
      return this.new({
        text,
        num: this.idCounter(),
      });
    }),
  },
  slots: {
    text: Var.new(),
    isDone: Var.default(false),
    num: Var.new(),
    html: Method.new({
      do() {
        return TodoItemView.create(this).html();
      }
    }),
  },
});

export const TodoList = Class.new({
  name: 'TodoList',
  super: ListElement,
  slots: {
    add: Method.do(function add(text) {
      const todo = TodoItem.create({ text });
      this.list().push(todo);
      this.render();
      return this;
    }),
    clear: Method.do(function clear() {
      this.list([]);
      return this;
    }),
  },
});

export const TodoInput = Class.new({
  name: 'TodoInput',
  super: Input,
  slots: {
    keyup: Var.new({
      default: CallbackCommand.new({
        selfClass: TodoApplication,
        fn(event) {
          if (event.key === 'Enter') {
            this.todoList().add(event.target.value);
            event.target.value = '';
            this.render();
            document.getElementById(this.input().id()).focus();
          }
        },
      }),
    })
  }
})

export var TodoApplication = Class.new({
  name: 'TodoApplication',
  super: Element,
  static: {
    create() {
      return this.new({
        todoList: TodoList.new({
          id: 'todo-list',
        }),
        input: TodoInput.new({
          id: 'todo-input',
        }),
        clearButton: Button.new({
          inner: 'Clear',
          id: 'clear-button',
          click: CallbackCommand.new({
            fn() {
              this.todoList().clear();
              this.render();
            },
          }),
        }),
      });
    },
  },
  slots: {
    todoList: Var.new(),
    input: Var.new(),
    clearButton: Var.new(),
    id: Var.default('app'),
    html() {
      return ListElement.new({
        id: this.id(),
        list: this.children(),
      }).html();
    },
    children() {
      return [this.todoList(), this.input(), this.clearButton()];
    }
  },
});
