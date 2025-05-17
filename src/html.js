import { __, base } from './base.js';

const TEMPLATE_CACHE = new Map(); // Cache for compiled template factories

export default await function (_, $) {

  $.Class.new({
    name: 'AstNodeCompilerBase',
    slots: [
      $.Virtual.new({ name: 'compile' }), // (node, env, compileRecursiveFn) -> VNode | ComponentInstance | string | array | any
    ],
  });

  $.Class.new({
    name: 'ElementNodeCompiler',
    slots: [
      $.AstNodeCompilerBase,
      $.Method.new({
        name: 'compile',
        do(node, env, compileRecursiveFn) {
          const props = {};
          node.attrs.forEach(attr => {
            props[attr.name] = attr.kind === 'expr' ? env[attr.idx] : attr.value;
          });

          const kids = node.children.map(childNode => {
            return compileRecursiveFn(childNode, env);
          });

          return $.VNode.h(node.tag, props, ...kids);
        },
      }),
    ],
  });

  $.Class.new({
    name: 'ComponentNodeCompiler',
    slots: [
      $.AstNodeCompilerBase,
      $.Method.new({
        name: 'compile',
        do(node, env, compileRecursiveFn) {
          const ComponentClass = __.$()[node.tag.slice(1)]; // Remove '$' prefix
          if (!ComponentClass) {
            throw new Error(`Component ${node.tag} not found.`);
          }

          const props = {};
          node.attrs.forEach(attr => {
            props[attr.name] = attr.kind === 'expr' ? env[attr.idx] : attr.value;
          });
          // Children for components are not directly passed during VNode creation here.
          // Components are responsible for handling their children, often via props or slots.
          // If children were to be compiled and passed, it'd be via props:
          // props.children = node.children.map(childNode => compileRecursiveFn(childNode, env));
          // For now, matching existing behavior: children are not automatically compiled and passed.

          return $.ComponentInstance.new({ comp: ComponentClass.new(props) });
        },
      }),
    ],
  });

  $.Class.new({
    name: 'FragmentNodeCompiler',
    slots: [
      $.AstNodeCompilerBase,
      $.Method.new({
        name: 'compile',
        do(node, env, compileRecursiveFn) {
          return node.children.map(childNode => {
            return compileRecursiveFn(childNode, env);
          });
        },
      }),
    ],
  });

  $.Class.new({
    name: 'TextNodeCompiler',
    slots: [
      $.AstNodeCompilerBase,
      $.Method.new({
        name: 'compile',
        do(node, env, compileRecursiveFn) {
          return node.value;
        },
      }),
    ],
  });

  $.Class.new({
    name: 'ExprNodeCompiler',
    slots: [
      $.AstNodeCompilerBase,
      $.Method.new({
        name: 'compile',
        do(node, env, compileRecursiveFn) {
          return env[node.idx];
        },
      }),
    ],
  });

  $.Class.new({
    name: 'VNode',
    slots: [
      $.Var.new({ 
        name: 'el',
        doc: 'Native DOM element or DocumentFragment',
      }),

      $.Method.new({
        name: 'mount',
        do(parentElement) {
          parentElement.appendChild(this.el());
        },
      }),

      $.Static.new({
        name: 'h',
        doc: 'Hyperscript-like helper',
        do(tag, props = {}, ...children) {
          const el = document.createElement(tag);

          Object.entries(props).forEach(([key, value]) => {
            if (key.startsWith('on') && typeof value === 'function') {
              el.addEventListener(key.substring(2).toLowerCase(), value);
            } else if (value != null && value !== false) {
              // Set other attributes, skip null/undefined/false
              // For boolean attributes like 'disabled', presence matters.
              // If value is true, set attribute name. If false, it's skipped.
              el.setAttribute(key, value === true ? '' : value);
            }
          });

          const appendChildToElement = (child) => {
            if (child == null) {
              return;
            }
            if (__.instanceOf(child, $.VNode) || __.instanceOf(child, $.ComponentInstance)) {
              el.appendChild(child.el());
            } else if (typeof child === 'function') { // Reactive text node
              let node = document.createElement('span');
              el.appendChild(node);
              $.Effect.create(() => {
                const newNode = child();
                node.innerHTML = newNode;
              });
            } else if (Array.isArray(child)) {
              child.forEach(appendChildToElement); // Flatten arrays of children
            } else {
              el.appendChild(document.createTextNode(String(child)));
            }
          };

          children.flat().forEach(appendChildToElement);

          return $.VNode.new({ el: el });
        },
      }),
    ],
  });

  $.Class.new({
    name: 'HTML',
    doc: 'HTML utilities for manipulating the DOM',
    slots: [
      $.Static.new({
        name: 'patch',
        doc: 'Naive DOM patch: replaces the old element with the new one if different.',
        do(oldEl, newEl) {
          if (oldEl && newEl && !oldEl.isEqualNode(newEl)) {
            oldEl.replaceWith(newEl);
          }
        },
      }),

      $.Static.new({
        name: 't',
        doc: 'Tagged template literal entry point for creating HTML structures.',
        do(strings, ...expressions) {
          const templateKey = strings.join('${expr}'); // Create a unique key for the template structure
          let factory = TEMPLATE_CACHE.get(templateKey);

          if (!factory) {
            const ast = $.HTML.parseTemplate(strings);
            factory = $.HTML.compileAstToFactory(ast);
            TEMPLATE_CACHE.set(templateKey, factory);
          }
          return factory(...expressions);
        },
      }),

      $.Static.new({
        name: 'parseTemplate',
        doc: 'Converts template literal strings and expressions into an AST.',
        do(strings) {
          let source = '';
          for (let i = 0; i < strings.length; i++) {
            source += strings[i];
            if (i < strings.length - 1) {
              source += `{{${i}}}`; // Placeholder for expressions
            }
          }

          const TOKEN_REGEX = /<\/?>|<[^>]+>|<>|<\/>|<\/[^>]+>|{{\d+}}|[^<]+/g;
          const OPEN_TAG_REGEX = /^<([\w$][\w$-]*)([^>]*)>/;
          const CLOSE_TAG_REGEX = /^<\/([\w$][\w$-]*)>/;
          const SELF_CLOSING_REGEX = /\/>$/;
          const EXPR_PLACEHOLDER_REGEX = /{{(\d+)}}/g;

          const rootNode = { kind: 'root', children: [] };
          const stack = [rootNode];

          let match;
          while ((match = TOKEN_REGEX.exec(source)) !== null) {
            const token = match[0];

            if (token === '<>') {
              pushNode({ kind: 'fragment', children: [] }, true);
              continue;
            }
            if (token === '</>') {
              stack.pop();
              continue;
            }

            if (/^{{\d+}}$/.test(token)) { // Top-level expression like `${foo}`
              pushNode({ kind: 'expr', idx: Number(token.slice(2, -2)) });
              continue;
            }

            const closeTagMatch = token.match(CLOSE_TAG_REGEX);
            if (closeTagMatch) {
              stack.pop();
              continue;
            }

            const openTagMatch = token.match(OPEN_TAG_REGEX);
            if (openTagMatch) {
              const [, tagName, rawAttrs] = openTagMatch;
              const node = {
                kind: tagName.startsWith('$') ? 'component' : 'element',
                tag: tagName,
                attrs: [],
                children: [],
              };
              parseAttributes(rawAttrs, node.attrs);
              pushNode(node, !SELF_CLOSING_REGEX.test(token));
              continue;
            }

            // Text content, possibly with inline expressions
            let lastIndex = 0;
            let exprMatch;
            while ((exprMatch = EXPR_PLACEHOLDER_REGEX.exec(token)) !== null) {
              if (exprMatch.index > lastIndex) {
                pushNode({ kind: 'text', value: token.slice(lastIndex, exprMatch.index) });
              }
              pushNode({ kind: 'expr', idx: Number(exprMatch[1]) });
              lastIndex = EXPR_PLACEHOLDER_REGEX.lastIndex;
            }
            if (lastIndex < token.length) {
              pushNode({ kind: 'text', value: token.slice(lastIndex) });
            }
          }

          // If root has only one child, return it directly, otherwise wrap in a fragment
          if (rootNode.children.length === 1) {
            return rootNode.children[0];
          } else {
            return { kind: 'fragment', children: rootNode.children };
          }

          function pushNode(node, pushToStack = false) {
            stack[stack.length - 1].children.push(node);
            if (pushToStack) {
              stack.push(node);
            }
          }

          function parseAttributes(rawAttributesString, attributesArray) {
            const ATTR_REGEX = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\{(\d+)}}|([^\s>]+)))?/g;
            let attrMatch;
            while ((attrMatch = ATTR_REGEX.exec(rawAttributesString)) !== null) {
              const name = attrMatch[1];
              let attrNode;
              if (attrMatch[2] != null || attrMatch[3] != null) { // Quoted value: "value" or 'value'
                const value = attrMatch[2] ?? attrMatch[3];
                const exprInAttrMatch = value.match(/^\{\{(\d+)}}$/);
                if (exprInAttrMatch) {
                  attrNode = { name, kind: 'expr', idx: Number(exprInAttrMatch[1]) };
                } else {
                  attrNode = { name, value: value };
                }
              } else if (attrMatch[4] != null) { // Unquoted expression: ={{exprIndex}}
                attrNode = { name, kind: 'expr', idx: Number(attrMatch[4]) };
              } else if (attrMatch[5] != null) { // Unquoted value: =value
                attrNode = { name, value: attrMatch[5] };
              } else { // Boolean attribute: disabled
                attrNode = { name, value: true };
              }
              attributesArray.push(attrNode);
            }
          }
        },
      }),

      $.Static.new({
        name: 'compileAstToFactory',
        doc: 'Compiles an AST into a factory function that generates VNodes or ComponentInstances.',
        do(ast) {
          const compilers = {
            element: $.ElementNodeCompiler.new(),
            component: $.ComponentNodeCompiler.new(),
            fragment: $.FragmentNodeCompiler.new(),
            text: $.TextNodeCompiler.new(),
            expr: $.ExprNodeCompiler.new(),
          };

          const compileRecursive = (node, env) => {
            const compiler = compilers[node.kind];
            if (!compiler) {
              throw new Error(`No compiler for AST node kind: ${node.kind}`);
            }
            return compiler.compile(node, env, compileRecursive);
          };

          return (...expressions) => {
            const compiledRoot = compileRecursive(ast, expressions);

            // Normalize the output to always be something mountable (VNode or ComponentInstance)
            if (Array.isArray(compiledRoot)) { // Result from FragmentNodeCompiler
              const fragmentElement = document.createDocumentFragment();
              compiledRoot.forEach(child => {
                if (child == null) {
                  return;
                }
                if (__.instanceOf(child, $.VNode) || __.instanceOf(child, $.ComponentInstance)) {
                  fragmentElement.appendChild(child.el());
                } else if (typeof child === 'function') { // Reactive text from an expression
                  const textNode = document.createTextNode('');
                  fragmentElement.appendChild(textNode);
                  $.Effect.create(() => {
                    textNode.nodeValue = String(child() ?? '');
                  });
                } else {
                  fragmentElement.appendChild(document.createTextNode(String(child)));
                }
              });
              return $.VNode.new({ el: fragmentElement });
            }

            if (
              typeof compiledRoot === 'string' ||
              typeof compiledRoot === 'number' ||
              typeof compiledRoot === 'boolean' ||
              compiledRoot == null
            ) {
              return $.VNode.new({ el: document.createTextNode(String(compiledRoot ?? '')) });
            }

            if (typeof compiledRoot === 'function') { // Top-level reactive expression
              const textNode = document.createTextNode('');
              // This VNode will manage the reactive text update.
              const fragmentParent = document.createDocumentFragment();
              fragmentParent.appendChild(textNode);
              $.Effect.create(() => {
                textNode.nodeValue = String(compiledRoot() ?? '');
              });
              return $.VNode.new({ el: fragmentParent });
            }

            // Should be a VNode or ComponentInstance
            return compiledRoot;
          };
        },
      }),
    ],
  });

  $.Class.new({
    name: 'ComponentInstance',
    doc: 'Wraps a Simulabra component instance, managing its rendering and reactivity.',
    slots: [
      $.Var.new({ name: 'comp' }),   // The actual Simulabra component instance
      $.Var.new({ name: 'vnode' }),  // The VNode rendered by this component
      $.Var.new({ name: 'effect' }), // The reactive effect for re-rendering

      $.After.new({
        name: 'init',
        do() {
          // Initial render
          const initialVNode = this.comp().render();
          this.vnode(initialVNode);

          // Set up reactive re-rendering
          this.effect($.Effect.create(() => {
            const newVNode = this.comp().render();
            if (this.vnode() && this.vnode().el() && newVNode && newVNode.el()) {
              $.HTML.patch(this.vnode().el(), newVNode.el());
            }
            this.vnode(newVNode);
          }));
        },
      }),

      $.Method.new({
        name: 'el',
        doc: 'Returns the root DOM element of this component instance.',
        do() {
          return this.vnode()?.el();
        },
      }),

      $.Method.new({
        name: 'mount',
        doc: 'Appends this component instance to a parent DOM element.',
        do(parentElement) {
          if (this.vnode()) {
            this.vnode().mount(parentElement);
          }
        },
      }),

      $.Method.new({
        name: 'dispose',
        doc: 'Cleans up the component instance, removing its reactive effect.',
        do() {
          if (this.effect()) {
            this.effect().dispose();
            this.effect(null);
          }
          // Optionally, remove element from DOM if managed here,
          // but typically parent handles removal.
          this.vnode(null);
          this.comp(null);
        },
      }),
    ],
  });

}.module({
  name: 'HTML',
  doc: 'Simulabra HTML rendering utilities, including VDOM, components, and reactive updates.',
  imports: [base],
}).load();
