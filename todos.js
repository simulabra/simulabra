import * as Base from './base.js';
import * as HTML from './html.js';
import * as Commands from './commands.js';

export const TodoItem = Base.Class.new({
  name: 'TodoItem',
  super: HTML.ListElement,
  static: {
    idCounter: Base.Var.default(0),
    create({ text }) {
      this.idCounter(this.idCounter() + 1);
      return this.new({
        id: `todo-item-${this.idCounter()}`,
        text,
        toggleButton: HTML.Button.new({
          inner: 'Toggle',
          id: `toggle-button-${this.idCounter()}`,
          click: Commands.CallbackCommand.new({
            fn(ev) {
              this.isDone(!this.isDone());
              this.render();
            },
          }),
        }),
      });
    },
  },
  slots: {
    text: Base.Var.new(),
    isDone: Base.Var.default(false),
    toggleButton: Base.Var.new({ type: HTML.Button }),
    children() {
      return [
        HTML.Span.new({
          inner: `${this.isDone() ? '[x]' : '[ ]'} ${this.text()}`
        }),
        this.toggleButton()
      ];
    }
  },
});

export const TodoList = Base.Class.new({
  name: 'TodoList',
  super: HTML.ListElement,
  slots: {
    items: Base.Var.default([]),
    add: Base.Method.do(function add(text) {
      const todo = TodoItem.create({ text });
      this.items().push(todo);
      this.render();
      return this;
    }),
    clear: Base.Method.do(function clear() {
      this.items([]);
      return this;
    }),
    children() {
      return this.items();
    },
  },
});

export const TodoInput = Base.Class.new({
  name: 'TodoInput',
  super: HTML.Input,
  slots: {
    keyup: Base.Var.new({
      default: Commands.CallbackCommand.new({
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

export var TodoApplication = Base.Class.new({
  name: 'TodoApplication',
  super: HTML.ListElement,
  static: {
    create() {
      return this.new({
        todoList: TodoList.new({
          id: 'todo-list',
        }),
        input: TodoInput.new({
          id: 'todo-input',
        }),
        clearButton: HTML.Button.new({
          inner: 'Clear',
          id: 'clear-button',
          click: Commands.CallbackCommand.new({
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
    todoList: Base.Var.new(),
    input: Base.Var.new(),
    clearButton: Base.Var.new(),
    id: Base.Var.default('app'),
    children() {
      return [this.todoList(), this.input(), this.clearButton()];
    },
  },
});
