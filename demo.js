import Base from './base.js';
import HTML from './html.js';

const _Counter = Base.Class.new({
  _name: 'Counter',
  _super: HTML.Element,
  _slots: {
    count: Base.Var.default(0),
    inc: Base.Method.do(function inc() {
      this.count(this.count() + 1);
      return this;
    }),
    html() {
      return HTML.Div.new({
        _inner: `Count: ${this.count()}`,
      }).html();
    },
  },
});

const _CallbackCommand = Base.Class.new({
  _name: 'CallbackCommand',
  _slots: {
    self: Base.Var.new(),
    fn: Base.Var.new(),
    do(...args) {
      return this.fn().apply(this.self(), args);
    },
  }
});

const _Application = Base.Class.new({
  _name: 'Application',
  _slots: {
    counter: Base.Var.default(() => _Counter.new()),
    button: Base.Var.default(() => HTML.Button.new({
      _inner: 'Add',
      _id: 'add-button',
    })),
    load() {
      this.counter().load();
      this.button().click(_CallbackCommand.new({
        _self: this,
        _fn() {
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

const _ = Base.Module.new({
  _name: 'Demo',
  _exports: [
    _Counter,
    _Application,
  ]
});

export default _;
