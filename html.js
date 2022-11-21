import Base from './base';

const _$HTML = Base.Interface.new({
  _name: Base.$$`$HTML`,
  _inherits: [
    Base.$ToString,
  ],
  _protocol: [
    Base.Method.new({
      _name: Base.$$`tag`
    })
  ]
})

const _Div = Base.Class.new({
  _name: Base.$$`Div`,
  _implements: [_$HTML],
  _slots: {
    inner: Base.Var.new({ _type: _$HTML }),
    html: Base.Method.new({
      _do: function html() {
        return `<div>${this.inner().html()}</div>`;
      }
    }),
  }
});

const _Button = Base.Class.new({
  _name: Base.$$`Button`,
  _implements: [_$HTML],
  _slots: {
    inner: Base.Var.new({ _type: _$HTML }),
    click: Base.Var.new({ _type: Base.$Command }),
    html: Base.Method.new({
      _do: function html() {
        return `<button id="${this._id}" type="button">${this.inner().html()}</div>`;
      },
    }),
  }
})

const _ = Base.Module.new({
  _exports: [
    _$HTML,
    _Div,
    _Button,
  ]
});

export default _;
