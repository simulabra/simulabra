// tests/html.js
import { __, base }   from '../src/base.js';
import test           from '../src/test.js';

/* --- tiny DOM shim ------------------------------------------------------ */
(function mockDOM() {
  class Node {
    appendChild(child) {
      this.children = this.children || [];
      this.children.push(child);
      child.parentNode = this;
      return child;
    }
    replaceChildren() {
      this.children = [];
    }
    get textContent() {
      const list = this.children || [];
      return list
        .map(node => node.textContent ?? node.nodeValue ?? '')
        .join('');
    }
    replaceWith(newNode) {
      const parent = this.parentNode;
      if (!parent) return;
      const idx = parent.children.indexOf(this);
      if (idx > -1) {
        parent.children[idx] = newNode;
        newNode.parentNode = parent;
      }
    }
    isEqualNode(other) {
      return this === other;
    }
    description() {
      return this.toString();
    }
  }

  class Element extends Node {
    constructor(tag) {
      super();
      this.tagName   = tag.toUpperCase();
      this.attrs     = {};
      this.listeners = {};
      this.nodeType  = 1;
    }
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    }
    getAttribute(name) {
      return this.attrs[name];
    }
    addEventListener(type, handler) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(handler);
    }
    dispatchEvent(evt) {
      const handlers = this.listeners[evt.type] || [];
      handlers.forEach(fn => fn(evt));
    }
  }

  class TextNode {
    constructor(text) {
      this.nodeValue = String(text);
      this.nodeType  = 3;
    }
    get textContent() {
      return this.nodeValue;
    }
  }

  class Fragment extends Node {
    constructor() {
      super();
      this.nodeType = 11;
    }
    dispatchEvent(evt) {
      const list = this.children || [];
      list.forEach(node => {
        if (node.dispatchEvent) {
          node.dispatchEvent(evt);
        }
      });
    }
  }

  globalThis.document = {
    createElement: tag => new Element(tag),
    createTextNode: txt => new TextNode(txt),
    createDocumentFragment: () => new Fragment()
  };
})();
 /* ------------------------------------------------------------------------ */

const htmlModule = (await import('../src/html.js')).default;

export default await async function (_, $) {

  $.Class.new({
    name: 'TestCounter',
    slots: [
      $.Signal.new({ name:'count', default: 0 }),
      $.Method.new({ name:'inc', do(){this.count(this.count()+1)} }),
      $.Method.new({
        name:'render',
        do(){
          return $.HTML.t`
          <button id="btn" onclick=${() => this.inc()}>
            clicked ${() => this.count()} times
          </button>`;
        }
      })
    ]
  });

  $.Case.new({
    name: 'HTMLVNodeBasic',
    do(){
      const v = $.HTML.t`<div id="x" class="y"></div>`;
      this.assertEq(v.el().tagName, 'DIV');
      this.assertEq(v.el().getAttribute('id'), 'x');
      this.assertEq(v.el().getAttribute('class'), 'y');
    }
  });

  $.AsyncCase.new({
    name: 'ReactiveTextUpdates',
    async do(){
      const counter = $.TestCounter.new();
      const v = counter.render();
      const root = document.createElement('div');
      v.mount(root);
      await __.reactor().flush();
      this.assertEq(root.textContent.trim(), 'clicked 0 times');
      counter.inc();
      await __.reactor().flush();
      this.assertEq(root.textContent.trim(), 'clicked 1 times');
    }
  });

  $.AsyncCase.new({
    name: 'EventListenerWorks',
    async do() {
      const counter = $.TestCounter.new();
      const v = counter.render();
      const root = document.createElement('div');
      v.mount(root);
      await __.reactor().flush();
      v.el().dispatchEvent({ type:'click' });
      await __.reactor().flush();
      this.assertEq(root.textContent.trim(), 'clicked 1 times');
    }
  });

}.module({
  name: 'test.html',
  imports: [test, htmlModule],
}).load();
