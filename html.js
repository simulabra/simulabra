import Base from './base.js';

const _Element = Base.Class.new({
  name: 'Element',
  slots: {
    inner: Base.Var.new(),
    id: Base.Var.new(),
    load() {  },
    nameString() {
      return this.name().toString();
    },
  }
})
const _$HTML = Base.Interface.new({
  name: '$HTML',
  slots: {
    html: Base.Message.new(),
  }
});

const _Div = Base.Class.new({
  name: 'Div',
  implements: [_$HTML],
  super: _Element,
  slots: {
    html() {
      return `<div>${this.inner().html()}</div>`;
    },
  }
});

const _Button = Base.Class.new({
  name: 'Button',
  implements: [_$HTML],
  super: _Element,
  slots: {
    click: Base.Var.new({ type: Base.$Command }),
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
  exports: [
    _$HTML,
    _Element,
    _Div,
    _Button,
  ]
});

export default _;
