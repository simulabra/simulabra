import Base from './base';
import HTML from './html';

const _Counter = Base.Class.new({
  _name: Base.$$`Counter`,
  _slots: {
    count: Base.Var.default(0),
    inc: Base.Method.do(function inc() {
      this.count(this.count() + 1);
      console.log(this._count);
      return this;
    }),
    html() {
      return HTML.Div.new({
        _inner: `Count: ${this.count()}`,
      }).html();
    },
  },
});

const _Button = Base.Class.new({
  _name: Base.$$`Button`,
  _slots: {
    text: Base.Var.default('Submit'),
    click: Base.Var.new({ _type: Base.$Command }), //???
    render() {
      return HTML.Button.new({

      })
    }
  }
});

const _ = Base.Module.new({
  _exports: [
    _Counter,
    _Button,
  ]
});

export default _;
