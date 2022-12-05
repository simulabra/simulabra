import * as Base from './base.js';

export const Element = Base.Class.new({
  name: 'Element',
  slots: {
    inner: Base.Var.new(),
    id: Base.Var.new(),
    load() {
      for (const child of this.children()) {
        child.load(this);
      }
      console.log('load', this.id());
    },
    nameString() {
      return this.name().toString();
    },
    render() {
      console.log(this)
      document.getElementById(this.id()).innerHTML = this.html();
      this.load();
    },
    html() {
      return `<div id="${this.id()}">${this.children().map(c => c.html()).join('')}</div>`;
    },
    children() {
      return [];
    }
  }
});

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
      return `<div id="${this.id()}">${this.inner().html()}</div>`;
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
    load(parent) {
      console.log('Button load ', this.id())
      this.click().self(parent);
      document.getElementById(this.id()).addEventListener('click', (ev) => {
        this.click().run(ev);
      });
      return this.super('load', parent);
    }
  }
});

export const Input = Base.Class.new({
  name: 'Input',
  implements: [$HTML],
  super: Element,
  slots: {
    keyup: Base.Var.new({ type: Base.$Command }),
    html() {
      return `<input id="${this.id()}" type="text">`;
    },
    load(parent) {
      this.keyup().self(parent);
      document.getElementById(this.id()).addEventListener('keyup', (ev) => {
        this.keyup().run(ev);
      });
    }
  }
});
