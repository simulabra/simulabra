import * as Base from './base.js';
import * as HTML from './html.js';

export const Counter = Base.Class.new({
  name: 'Counter',
  super: HTML.Element,
  slots: {
    count: Base.Var.default(0),
    inc: Base.Method.do(function inc() {
      this.count(this.count() + 1);
      return this;
    }),
    html() {
      return HTML.Div.new({
        inner: `Count: ${this.count()}`,
      }).html();
    },
  },
});

export const CallbackCommand = Base.Class.new({
  name: 'CallbackCommand',
  slots: {
    self: Base.Var.new(),
    fn: Base.Var.new(),
    do(...args) {
      return this.fn().apply(this.self(), args);
    },
  }
});

export const Application = Base.Class.new({
  name: 'Application',
  super: HTML.Element,
  static: {
    create() {
      return this.new({
        counter: Counter.new(),
        button: HTML.Button.new({
          inner: 'Add',
          id: 'add-button',
          click: CallbackCommand.new({
            fn() {
              this.counter().inc();
              this.render();
            },
          }),
        })
      });
    }
  },
  slots: {
    counter: Base.Var.new(),
    button: Base.Var.new(),
    id: Base.Var.default('app'),
    children() {
      return [this.counter(), this.button()];
    },
  }
});
