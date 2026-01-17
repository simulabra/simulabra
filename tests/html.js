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

/* --- WebSocket mock for LiveBrowserClient tests -------------------------- */
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];
  static clear() { MockWebSocket.instances = []; }

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.sentMessages = [];
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sentMessages.push(JSON.parse(data));
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000 });
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen({});
  }

  simulateMessage(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }

  simulateError(err) {
    if (this.onerror) this.onerror(err || new Error('mock error'));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000 });
  }
}
globalThis.WebSocket = MockWebSocket;

const htmlModule = (await import('../src/html.js')).default;

export default await async function (_, $, $test, $html) {

  $.Class.new({
    name: 'TestCounter',
    slots: [
      $.Signal.new({ name:'count', default: 0 }),
      $.Method.new({ name:'inc', do(){this.count(this.count()+1)} }),
      $.Method.new({
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
      const counter = _.TestCounter.new();
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
      const counter = _.TestCounter.new();
      const v = counter.render();
      const root = document.createElement('div');
      v.mount(root);
      await __.reactor().flush();
      v.el().dispatchEvent({ type:'click' });
      await __.reactor().flush();
      this.assertEq(root.textContent.trim(), 'clicked 1 times');
    }
  });

  $test.AsyncCase.new({
    name: 'LiveBrowserClientConnects',
    async do() {
      MockWebSocket.clear();
      const client = $html.LiveBrowserClient.new({ port: 3030, autoReconnect: false });
      const connectPromise = client.connect();
      this.assertEq(MockWebSocket.instances.length, 1);
      const ws = MockWebSocket.instances[0];
      this.assertEq(ws.url, 'ws://localhost:3030');
      this.assertEq(client.connected(), false);
      ws.simulateOpen();
      await connectPromise;
      this.assertEq(client.connected(), true);
      client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'LiveBrowserClientRpcCall',
    async do() {
      MockWebSocket.clear();
      const client = $html.LiveBrowserClient.new({ port: 3030, autoReconnect: false });
      const connectPromise = client.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      await connectPromise;
      const rpcPromise = client.rpcCall('TestService', 'testMethod', ['arg1', 42]);
      this.assertEq(ws.sentMessages.length, 1);
      this.assertEq(ws.sentMessages[0].type, 'rpc');
      this.assertEq(ws.sentMessages[0].service, 'TestService');
      this.assertEq(ws.sentMessages[0].method, 'testMethod');
      this.assertEq(ws.sentMessages[0].args[0], 'arg1');
      this.assertEq(ws.sentMessages[0].args[1], 42);
      ws.simulateMessage({ callId: ws.sentMessages[0].callId, result: 'success' });
      const result = await rpcPromise;
      this.assertEq(result, 'success');
      client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'LiveBrowserClientRpcError',
    async do() {
      MockWebSocket.clear();
      const client = $html.LiveBrowserClient.new({ port: 3030, autoReconnect: false });
      const connectPromise = client.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      await connectPromise;
      const rpcPromise = client.rpcCall('TestService', 'failingMethod', []);
      ws.simulateMessage({ callId: ws.sentMessages[0].callId, error: 'test error' });
      let caughtError = null;
      try {
        await rpcPromise;
      } catch (e) {
        caughtError = e;
      }
      this.assert(caughtError !== null, 'expected error to be thrown');
      this.assertEq(caughtError.message, 'test error');
      client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'LiveBrowserClientServiceProxy',
    async do() {
      MockWebSocket.clear();
      const client = $html.LiveBrowserClient.new({ port: 3030, autoReconnect: false });
      const connectPromise = client.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      await connectPromise;
      const proxy = client.serviceProxy('DatabaseService');
      const callPromise = proxy.listTasks({ active: true });
      this.assertEq(ws.sentMessages.length, 1);
      this.assertEq(ws.sentMessages[0].service, 'DatabaseService');
      this.assertEq(ws.sentMessages[0].method, 'listTasks');
      ws.simulateMessage({ callId: ws.sentMessages[0].callId, result: [{ id: 1, title: 'task1' }] });
      const tasks = await callPromise;
      this.assertEq(tasks.length, 1);
      this.assertEq(tasks[0].title, 'task1');
      client.disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'LiveBrowserClientDisconnectSignal',
    async do() {
      MockWebSocket.clear();
      const client = $html.LiveBrowserClient.new({ port: 3030, autoReconnect: false });
      const connectPromise = client.connect();
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      await connectPromise;
      this.assertEq(client.connected(), true);
      ws.simulateClose();
      this.assertEq(client.connected(), false);
    }
  });

  $test.Case.new({
    name: 'LiveBrowserClientServiceProxyStringArg',
    do() {
      MockWebSocket.clear();
      const client = $html.LiveBrowserClient.new({ port: 3030, autoReconnect: false });
      const proxy = client.serviceProxy('TestService');
      this.assert(typeof proxy.anyMethod === 'function');
    }
  });

}.module({
  name: 'test.html',
  imports: [base, test, htmlModule],
}).load();
