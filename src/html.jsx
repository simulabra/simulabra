import base from './base.js';

export default await base.find('class', 'module').new({
  name: 'html',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="component">
      <$method name="dom_id"
        do={function dom_id() {
          return `${this.class().name()}--${this.id()}`;
        }}
      />
      <$method name="element"
        do={function element() {
          return document.getElementById(this.dom_id());
        }}
      />
      <$method name="container"
        do={function container(...children) {
          return <div id={this.dom_id()} class={this.class().name()} ref={this.uri()}>{children}</div>
        }}
      />
      <$var name="parent" def={null} />
      <$method name="to_dom"
        do={function to_dom() {
          return this.container(this.render()).to_dom();
        }}
      />
      <$method name="clear"
        do={function clear() {
          while (this.element().firstChild) {
            this.element().removeChild(this.element().firstChild);
          }
        }}
      />
      <$method name="swap"
        do={function swap(content) {
          this.clear();
          this.element().appendChild(content.to_dom());
        }}
      />
      <$after name="init"
        do={function init() {
          this.addEventListener('update', function() {
            if (this.element()) {
              this.swap(this.render());
            }
          });
        }}
      />
      <$method name="dispatchEvent"
        do={function dispatchEvent(event) {
          const observers = this.message_observers(event.type);
          /* this.log('dispatchEvent', event.type, observers.length, this.parent()); */
          if (observers.length === 0) {
            return this.parent()?.dispatchEvent(event);
          }
          let handled = false;
          for (const ob of observers) {
            handled = handled || ob(event);
          }
          return handled;
        }}
      />
    </$class>;


    <$class name="html_element">
      <$$component />
      <$var name="tag" default={'div'} />
      <$var name="properties" default={{}} />
      <$var name="events" default={{}} />
      <$var name="children" default={[]} />
      <$method name="domify"
        do={function domify(node) {
          if (typeof node === 'object' && 'type' in node && typeof node.type === 'string') {
            return node;
          } else if (typeof node === 'string') {
            return document.createTextNode(node);
          } else {
            return node.to_dom();
          }
        }}
      />
      <$method name="to_dom" override={true}
        do={function to_dom() {
          const elem = document.createElement(this.tag());
          for (const pkey of Object.keys(this.properties())) {
            const prop = this.properties()[pkey];
            if (typeof prop === 'string') {
              elem.setAttribute(pkey, prop);
            } else {
              elem.setAttribute('directed', pkey);
              if (pkey.startsWith('on')) {
                const eventName = pkey.slice(2).toLowerCase();
                elem.addEventListener(eventName, prop);
              } else {
                elem[pkey] = prop;
              }
            }
          }
          for (const child of this.children()) {
            // TODO: handle nested arrays
            if (Array.isArray(child)) {
              for (const n of child) {
                elem.appendChild(this.domify(n));
              }
            } else {
              elem.appendChild(this.domify(child));
            }
          }
          return elem;
        }}
      />
    </$class>;

    <$class name="application">
      <$after name="init"
        do={function init() {
          this.addEventListener('command', (e) => {
            this.process_command(e.target);
          });
        }}
      />
      <$method name="process_command"
        do={function process_command(cmd) {
          cmd.run(this);
        }}
      />
    </$class>;
  }
}).load();
