import { resolve } from 'path';
import { readFileSync } from 'fs';

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

  globalThis.window = globalThis;
  globalThis.HTMLElement = class HTMLElement {};
  globalThis.customElements = { define() {}, get() {} };

  // Mock localStorage/sessionStorage for browser-dependent modules
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
  globalThis.localStorage = createStorage();
  globalThis.sessionStorage = createStorage();
}

import { __, base } from '../src/base.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'ModuleLister',
    slots: [
      $.Method.new({
        name: 'loadFile',
        async: true,
        async do(filePath) {
          const esm = await import(filePath);
          // Handle default export
          if (esm.default) {
            return esm.default;
          }
          // Handle named exports - look for a Module instance
          for (const key of Object.keys(esm)) {
            const val = esm[key];
            if (val && typeof val.registry === 'function') {
              return val;
            }
          }
          return null;
        }
      }),
      $.Method.new({
        name: 'extractClassLines',
        do(source) {
          const lineMap = {};
          const lines = source.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for $.Class.new({ or Class.new({ patterns
            if (/\.Class\.new\s*\(\s*\{/.test(line)) {
              // Search nearby lines for name: 'ClassName' or name: "ClassName"
              for (let j = i; j < Math.min(i + 5, lines.length); j++) {
                const nameMatch = lines[j].match(/name:\s*['"]([^'"]+)['"]/);
                if (nameMatch) {
                  lineMap[nameMatch[1]] = i + 1; // 1-indexed line number
                  break;
                }
              }
            }
          }
          return lineMap;
        }
      }),
      $.Method.new({
        name: 'extractParams',
        do(fn) {
          if (!fn) return '';
          const str = fn.toString();
          const match = str.match(/^(?:async\s+)?(?:function\s*)?\w*\s*\(([^)]*)\)/);
          if (match && match[1].trim()) {
            return `(${match[1].trim()})`;
          }
          return '';
        }
      }),
      $.Method.new({
        name: 'formatSlot',
        do(slot) {
          if (typeof slot === 'function') {
            const params = this.extractParams(slot);
            return `  $.Method#${slot.name}${params}`;
          }
          if (!slot.class) return null;

          const typeName = slot.class().name;
          const slotName = slot.name;
          const doc = slot.doc?.() || '';

          let signature = `  $.${typeName}#${slotName}`;

          if (['Method', 'Before', 'After', 'Static'].includes(typeName)) {
            const fn = slot.do?.();
            signature += this.extractParams(fn);
          }

          if (doc) {
            signature += ` ${doc}`;
          }

          return signature;
        }
      }),
      $.Method.new({
        name: 'formatClass',
        do(cls, lineNum) {
          const header = lineNum ? `${cls.name}:${lineNum}` : cls.name;
          const lines = [header];
          for (const slot of cls.slots()) {
            if (slot.class?.().name === 'Class') continue;
            const formatted = this.formatSlot(slot);
            if (formatted) lines.push(formatted);
          }
          return lines.join('\n');
        }
      }),
      $.Method.new({
        name: 'listClasses',
        do(mod, lineMap = {}) {
          if (!mod || typeof mod.registry !== 'function') {
            return '(no classes found - module has no registry)';
          }
          const registry = mod.registry();
          if (!registry) {
            return '(no classes found - registry is null)';
          }
          const classes = registry.instances($.Class);
          return classes
            .map(cls => this.formatClass(cls, lineMap[cls.name]))
            .join('\n\n');
        }
      }),
      $.Method.new({
        name: 'run',
        async: true,
        async do(filePath) {
          const absolutePath = resolve(filePath);
          const source = readFileSync(absolutePath, 'utf-8');
          const lineMap = this.extractClassLines(source);
          const mod = await this.loadFile(absolutePath);
          const output = this.listClasses(mod, lineMap);
          console.log(output);
        }
      }),
    ]
  });

  if (require.main === module) {
    const filePath = process.argv[2];
    if (!filePath) {
      console.error('Usage: bun run bin/lister.js <file.js>');
      process.exit(1);
    }
    const lister = _.ModuleLister.new();
    await lister.run(filePath);
    process.exit(0);
  }
}.module({
  name: 'lister',
  imports: [base],
}).load();
