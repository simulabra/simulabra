import { Class, Var, Method, Interface, Message } from './base.js';
import { $Command } from './commands.js';

export const Element = Class.new({
  name: 'Element',
  static: {
    text: Method.new({
      do(t) {
        return this.new({
          inner: t,
        });
      }
    }),
  },
  slots: {
    inner: Var.new(),
    id: Var.new(),
    load() {
      for (const child of this.children()) {
        child.load(this);
      }
      // console.log('load', this.id());
    },
    nameString() {
      return this.name().toString();
    },
    render() {
      document.getElementById(this.id()).innerHTML = this.html();
      this.load();
    },
    children() {
      return [];
    }
  }
});

export const $HTML = Interface.new({
  name: '$HTML',
  slots: {
    html: Message.new(),
  }
});

export const ListElement = Class.new({
  name: 'ListElement',
  implements: [$HTML],
  super: Element,
  slots: {
    html() {
      return `<div id="${this.id()}">${this.children().map(c => c.html()).join('')}</div>`;
    }
  }
});

export const Div = Class.new({
  name: 'Div',
  implements: [$HTML],
  super: Element,
  slots: {
    html() {
      return `<div id="${this.id()}">${this.inner().html()}</div>`;
    },
  }
});

export const Span = Class.new({
  name: 'Span',
  implements: [$HTML],
  super: Element,
  slots: {
    html() {
      return `<span id="${this.id()}">${this.inner().html()}</span>`;
    },
  }
});

export const Button = Class.new({
  name: 'Button',
  implements: [$HTML],
  super: Element,
  slots: {
    click: Var.new({ type: $Command }),
    html() {
      return `<button id="${this.id()}" type="button">${this.inner().html()}</div>`;
    },
    load(parent) {
      // console.log('Button load ', this.id())
      this.click().self(parent);
      document.getElementById(this.id()).addEventListener('click', (ev) => {
        this.click().run(ev);
      });
      return this.super('load', parent);
    }
  }
});

export const Input = Class.new({
  name: 'Input',
  implements: [$HTML],
  super: Element,
  slots: {
    keyup: Var.new({ type: $Command }),
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
