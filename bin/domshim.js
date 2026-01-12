if (typeof document === 'undefined') {
  const createNode = (tag) => ({
    tagName: tag,
    children: [],
    attributes: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { return child; },
    insertBefore(node, ref) { return node; },
    replaceChild(newNode, oldNode) { return oldNode; },
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    removeAttribute(k) { delete this.attributes[k]; },
    hasAttribute(k) { return k in this.attributes; },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    replaceWith() {},
    remove() {},
    focus() {},
    blur() {},
    click() {},
    get textContent() { return ''; },
    set textContent(v) {},
    get innerHTML() { return ''; },
    set innerHTML(v) {},
    get value() { return ''; },
    set value(v) {},
  });

  const createStorage = () => {
    const store = {};
    return {
      getItem(key) { return store[key] ?? null; },
      setItem(key, value) { store[key] = String(value); },
      removeItem(key) { delete store[key]; },
      clear() { for (const k in store) delete store[k]; },
      get length() { return Object.keys(store).length; },
      key(i) { return Object.keys(store)[i] ?? null; }
    };
  };

  globalThis.document = {
    createElement: createNode,
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    createComment: (text) => ({ nodeType: 8, textContent: text }),
    createDocumentFragment: () => ({
      children: [],
      appendChild(child) { this.children.push(child); return child; },
      querySelectorAll() { return []; },
    }),
    body: createNode('body'),
    head: createNode('head'),
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    activeElement: null,
  };

  globalThis.location = {
    hostname: 'localhost',
    host: 'localhost',
    href: 'http://localhost/',
    origin: 'http://localhost',
    pathname: '/',
    port: '',
    protocol: 'http:',
    search: '',
    hash: '',
  };
  globalThis.window = globalThis;
  globalThis.HTMLElement = class HTMLElement {};
  globalThis.customElements = { define() {}, get() {} };
  globalThis.localStorage = createStorage();
  globalThis.sessionStorage = createStorage();
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
