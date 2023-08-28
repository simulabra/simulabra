import base from './base.jsx';

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
      <$event name="update"
        do={function () {
          if (this.element()) {
            Idiomorph.morph(this.element(), this.to_dom());
          }
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
      <$var name="minimized" default={false} />
      <$method name="container">{
        function container(...children) {
          return <div id={this.dom_id()} class={`windowed ${this.class().name()}`} ref={this.uri()}>
            <div class="window-bar">
              <span class="window-layout">
              </span>
              <span class="window-title">{this.window_title()}</span>
              <span class="window-menu"></span>
            </div>
            {this.minimized() ? '' : <div class="window-body">
              children
              {children}
            </div>}
          </div>;
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
            if (Array.isArray(child)) {
              for (const n of child) {
                elem.appendChild(this.domify(n));
              }
            } else {
              elem.appendChild(this.domify(child));
            }
          }
          elem.dispatchEvent(new Event('load'));
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
        do={async function process_command(cmd) {
          try {
            await cmd.run(this);
            this.command_history().push(cmd);
          } catch (err) {
            this.log('command failed', cmd, err);
            this.dispatchEvent({ type: 'error', cmd, err })
          }
        }}
      />
    </$class>;

    <$class name="link">
      <$$component />
      <$var name="object" />
      <$method name="link_text">{
         function link_text() {
           return this.object().title();
        }
      }</$method>
      <$method name="render">{
        function render() {
          const uri = this.object().uri();
          return <div>
            <a href="#"
              id={`link-${this.id()}`}
              object={uri}
              onclick={e => {
                return this.dispatchEvent({
                  type: 'command',
                  target: this.command(),
                });
              }}
            >
              {this.link_text()}
            </a>
          </div>;
        }
      }</$method>
    </$class>;
  }
}).load();
