import Base from './base.js';

const _Element = Base.Class.new({
  _name: 'Element',
  _slots: {
    inner: Base.Var.new(),
    id: Base.Var.new(),
    load() {  },
    nameString() {
      return this.name().toString();
    },
  }
})
const _$HTML = Base.Interface.new({
  _name: '$HTML',
  _inherits: [
    Base.$ToString,
  ],
  _slots: [
    Base.Method.new({
      _name: 'html'
    }),
  ],
});

const _Div = Base.Class.new({
  _name: 'Div',
  _implements: [_$HTML],
  _super: _Element,
  _slots: {
    html() {
      return `<div>${this.inner().html()}</div>`;
    },
  }
});

const _Button = Base.Class.new({
  _name: 'Button',
  _implements: [_$HTML],
  _super: _Element,
  _slots: {
    click: Base.Var.new({ _type: Base.$Command }),
    html() {
      return `<button id="${this.id()}" type="button">${this.inner().html()}</div>`;
    },
    load() {
      document.getElementById(this.id()).addEventListener('click', (ev) => {
        this.click().do(this, ev);
      });
    }
  }
});

const _ = Base.Module.new({
  _exports: [
    _$HTML,
    _Element,
    _Div,
    _Button,
  ]
});

export default _;
