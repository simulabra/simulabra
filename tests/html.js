// tests/html.js
import { __, base }   from '../src/base.js';
import test           from '../src/test.js';

/* --- tiny DOM shim ------------------------------------------------------ */
(function mockDOM () {
  class Node {
    appendChild(n){(this.children??=[]).push(n);n.parentNode=this;return n}
    replaceChildren(){this.children=[]}
    get textContent(){return (this.children||[])
      .map(c=>c.textContent??c.nodeValue??'').join('')}
    replaceWith(n){const p=this.parentNode;if(!p)return;
      const i=p.children.indexOf(this);if(i>-1){p.children[i]=n;n.parentNode=p}}
    isEqualNode(o){return this===o}
    description(){return this.toString()}
  }
  class El extends Node{
    constructor(t){super();this.tagName=t.toUpperCase();this.attrs={};this.listeners={};this.nodeType=1}
    setAttribute(k,v){this.attrs[k]=String(v)}
    getAttribute(k){return this.attrs[k]}
    addEventListener(e,f){(this.listeners[e]??=[]).push(f)}
    dispatchEvent(ev){(this.listeners[ev.type]||[]).forEach(fn=>fn(ev))}
  }
  class Txt{constructor(t){this.nodeValue=String(t);this.nodeType=3}
    get textContent(){return this.nodeValue}}
  class Frag extends Node{
    constructor(){super();this.nodeType=11}
    dispatchEvent(ev){(this.children??=[]).forEach(n=>n.dispatchEvent?n.dispatchEvent(ev):'')}
  }
  globalThis.document={
    createElement:t=>new El(t),
    createTextNode:t=>new Txt(t),
    createDocumentFragment:()=>new Frag(),
  };
})();
/* ------------------------------------------------------------------------ */

const htmlModule = (await import('../src/html.js')).default;

export default await async function (_, $) {

  $.Class.new({
    name: 'TestCounter',
    slots: [
      $.Signal.new({ name:'count', default:0 }),
      $.Method.new({ name:'inc', do(){this.count(this.count()+1)} }),
      $.Method.new({
        name:'render',
        do(){return $.HTML.t`
          <button id="btn" onclick=${() => this.inc()}>
            clicked ${() => this.count()} times
          </button>`}
      })
    ]
  });

  $.Case.new({
    name: 'HTMLVNodeBasic',
    do(){
      const v=$.HTML.t`<div id="x" class="y"></div>`;
      this.assertEq(v.el().tagName,'DIV');
      this.assertEq(v.el().getAttribute('id'),'x');
      this.assertEq(v.el().getAttribute('class'),'y');
    }
  });

  $.AsyncCase.new({
    name: 'ReactiveTextUpdates',
    async do(){
      const c=$.TestCounter.new();
      const v=c.render();
      const root=document.createElement('div');
      v.mount(root);
      await __.reactor().flush();
      this.assertEq(root.textContent.trim(),'clicked 0 times');
      c.inc();
      await __.reactor().flush();
      this.assertEq(root.textContent.trim(),'clicked 1 times');
    }
  });

  $.AsyncCase.new({
    name: 'EventListenerWorks',
    async do(){
      const c=$.TestCounter.new();
      const v=c.render();
      const root=document.createElement('div');
      v.mount(root);
      await __.reactor().flush();
      v.el().dispatchEvent({type:'click'});
      await __.reactor().flush();
      this.assertEq(root.textContent.trim(),'clicked 1 times');
    }
  });

}.module({
  name: 'test.html',
  imports: [test, htmlModule],
}).load();
