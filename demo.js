import Base from './base';
import HTML from './html';

const _Counter = Base.Class.new({
  _name: Base.$$`Counter`,
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
  _name: Base.$$`CallbackCommand`,
  _slots: {
    fn: Base.Var.new(),
    do(...args) {
      return this.fn().apply(this, args);
    },
  }
});

const _Demo = Base.Class.new({
  _name: Base.$$`Demo`,
  _slots: {
    counter: Base.Var.default(() => _Counter.new()),
    button: Base.Var.default(() => HTML.Button.new({
      _inner: 'Add',
      _id: 'add-button',
    })),
    render: Base.Var.default(() => {}),
    load() {
      const self = this;
      this.counter().load();
      this.button().click(_CallbackCommand.new({
        _fn() {
          self.counter().inc();
          self.render();
        },
      }));
      this.button().load();
    },
    html() {
      return `<div>${this.counter().html() + this.button().html()}</div>`;
    },
  }
});

const _ = Base.Module.new({
  _exports: [
    _Counter,
    _Demo,
  ]
});

export default _;
