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
          const children = [content.to_dom()].flat(Infinity);
          for (const c of children) {
            this.element().appendChild(c);
          }
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

    <$class name="window">
      <$$component />
      <$method name="container">{
        function container(...children) {
          return <div id={this.dom_id()} class={`windowed ${this.class().name()}`} ref={this.uri()}>
            <div class="window-title">{this.window_title()}</div>
            <div class="window-body">
              children
              {children}
            </div>
          </div>;
        }
      }</$method>
      <$method name="clear">{
        function clear() {
          const el = this.element().querySelector('.window-body');
          while (el.firstChild) {
            el.removeChild(el.firstChild);
          }
        }
      }</$method>
      <$method name="swap">{
        function swap(content) {
          this.clear();
          const children = [content.to_dom()].flat(Infinity);
          for (const c of children) {
            this.element().querySelector('.window-body').appendChild(c);
          }
          this.element().querySelector('.window-title').innerHTML = this.window_title();
        }
      }</$method>
      <$method name="window_title">{
        function window_title() {
          return this.title();
        }
      }</$method>
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
      <$var name="command_history" default={[]} />
      <$after name="init"
        do={function init() {
          this.addEventListener('command', (e) => {
            this.process_command(e.target);
          });
          const el = document.createElement('style');
          el.innerHTML = this.css();
          document.head.appendChild(el);
        }}
      />
      <$method name="process_command"
        do={function process_command(cmd) {
          cmd.run(this);
          this.command_history().push(cmd);
        }}
      />
    </$class>;
  }
}).load();
