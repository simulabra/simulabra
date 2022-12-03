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
  slots: {
    counter: Base.Var.default(() => Counter.new()),
    button: Base.Var.default(() => HTML.Button.new({
      inner: 'Add',
      id: 'add-button',
    })),
    load() {
      this.counter().load();
      this.button().click(CallbackCommand.new({
        self: this,
        fn() {
          this.counter().inc();
          this.render();
        },
      }));
      this.button().load();
    },
    html() {
      return `<div>${this.counter().html() + this.button().html()}</div>`;
    },
    render() {
      document.getElementById('app').innerHTML = this.html();
      this.load();
    },
    init() {
      this.render();
    },
  }
});
