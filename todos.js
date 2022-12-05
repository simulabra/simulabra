import * as Base from './base.js';
import * as HTML from './html.js';
import * as Commands from './commands.js';

export const TodoItem = Base.Class.new({
  name: 'TodoItem',
  super: HTML.Element,
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
              console.log('click', this.name(), this.id());
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
    html() {
      console.log('TodoItem html')
      return HTML.Div.new({
        inner: `${this.isDone() ? '[x]' : '[ ]'} ${this.text()} ${this.toggleButton().html()}`,
      }).html();
    },
    children() {
      return [this.toggleButton()];
    }
  },
});


export const TodoList = Base.Class.new({
  name: 'TodoList',
  super: HTML.Element,
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
    html() {
      return HTML.Div.new({
        id: this.id(),
        inner: this.items().map(item => item.html()).join(''),
      }).html();
    },
    children() {
      return this.items();
    },
  },
});

export const TodoApplication = Base.Class.new({
  name: 'TodoApplication',
  super: HTML.Element,
  static: {
    create() {
      return this.new({
        todoList: TodoList.new({
          id: 'todo-list',
        }),
        input: HTML.Input.new({
          id: 'todo-input',
          keyup: Commands.CallbackCommand.new({
            fn(event) {
              console.log('keyup', event)
              if (event.key === 'Enter') {
                this.todoList().add(event.target.value);
                event.target.value = '';
                this.render();
              }
            },
          }),
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
