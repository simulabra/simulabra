// tests/html.js
import { __, base } from '../src/base.js';
import test from '../src/test.js';

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
    remove() {
      const parent = this.parentNode;
      if (!parent) return;
      const idx = parent.children.indexOf(this);
      if (idx > -1) {
        parent.children.splice(idx, 1);
        this.parentNode = null;
      }
    }
    insertBefore(newNode, referenceNode) {
      this.children = this.children || [];
      if (!referenceNode) {
        this.appendChild(newNode);
        return newNode;
      }
      const idx = this.children.indexOf(referenceNode);
      if (idx > -1) {
        this.children.splice(idx, 0, newNode);
        newNode.parentNode = this;
      }
      return newNode;
    }
    isEqualNode(other) {
      return this === other;
    }
    description() {
      return this.toString();
    }
    get firstChild() {
      return this.children && this.children[0];
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

  class TextNode extends Node {
    constructor(text) {
      super();
      this.nodeValue = String(text);
      this.nodeType  = 3;
    }
    get textContent() {
      return this.nodeValue;
    }
  }

  class CommentNode extends Node {
    constructor(text) {
      super();
      this.nodeValue = String(text);
      this.nodeType  = 8;
    }
    get textContent() {
      return ''; // Comments don't contribute to textContent
    }
  }

  class Fragment extends Node {
    constructor() {
      super();
      this.nodeType = 11;
    }
    appendChild(child) {
      // When appending a fragment to a parent, move all its children
      if (this.parentNode && child instanceof Fragment) {
        const children = [...(child.children || [])];
        children.forEach(c => this.appendChild(c));
        return child;
      }
      return super.appendChild(child);
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
    createDocumentFragment: () => new Fragment(),
    createComment: txt => new CommentNode(txt)
  };
})();

const htmlModule = (await import('../src/html.js')).default;

export default await function (_, $, $base, $test, $html) {

  $base.Class.new({
    name: 'TestCounter',
    slots: [
      $base.Signal.new({ name:'count', default: 0 }),
      $base.Method.new({ name:'inc', do(){this.count(this.count()+1)} }),
      $base.Method.new({
        name:'render',
        do(){
          return $html.HTML.t`
          <button id="btn" onclick=${() => this.inc()}>
            clicked ${() => this.count()} times
          </button>`;
        }
      })
    ]
  });

  $test.Case.new({
    name: 'HTMLVNodeBasic',
    do(){
      const v = $html.HTML.t`<div id="x" class="y"></div>`;
      this.assertEq(v.el().tagName, 'DIV');
      this.assertEq(v.el().getAttribute('id'), 'x');
      this.assertEq(v.el().getAttribute('class'), 'y');
    }
  });

  $test.AsyncCase.new({
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

  $test.AsyncCase.new({
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
  imports: [base, test, htmlModule],
}).load();
