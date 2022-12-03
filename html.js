import * as Base from './base.js';

export const Element = Base.Class.new({
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
export const $HTML = Base.Interface.new({
  name: '$HTML',
  slots: {
    html: Base.Message.new(),
  }
});

export const Div = Base.Class.new({
  name: 'Div',
  implements: [$HTML],
  super: Element,
  slots: {
    html() {
      return `<div>${this.inner().html()}</div>`;
    },
  }
});

export const Button = Base.Class.new({
  name: 'Button',
  implements: [$HTML],
  super: Element,
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
