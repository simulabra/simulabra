import base from './base.jsx';

export default await base.find('class', 'module').new({
  name: 'html',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="component">
      <$method name="dom_id">{
        function dom_id() {
          return `${this.class().name()}--${this.id()}`;
        }
      }</$method>
      <$method name="element">{
        function element() {
          return document.getElementById(this.dom_id());
        }
      }</$method>
      <$method name="swap_target">{
        function swap_target() {
          return this.element().querySelector('.swap-target');
        }
      }</$method>
      <$method name="container">{
        function container(...children) {
          return <span id={this.dom_id()} class={this.class().name()} ref={this.uri()}><span class="swap-target">{children}</span></span>
        }
      }</$method>
      <$var name="parent" default={null} />
      <$method name="to_dom">{
        function to_dom() {
          return this.container(this.render()).to_dom();
        }
      }</$method>
      <$method name="clear">{
        function clear() {
          const st = this.swap_target();
          st.innerHTML = '';
        }
      }</$method>
      <$method name="swap">{
        function swap() {
          this.clear();
          const children = [this.render().to_dom()].flat(Infinity);
          for (const c of children) {
            this.swap_target().appendChild(c);
          }
        }
      }</$method>
      <$event name="update">{
        function update() {
          if (this.element()) {
            this.swap();
          }
        }
      }</$event>
      <$method name="dispatchEvent">{
        function dispatchEvent(event) {
          const observers = this.message_observers(event.type);
          if (observers.length === 0) {
            return this.parent()?.dispatchEvent(event);
          }
          let handled = false;
          for (const ob of observers) {
            handled = handled || ob(event);
          }
          return handled;
        }
      }</$method>
    </$class>;

    <$class name="window">
      <$$component />
      <$var name="minimized" default={false} />
      <$method name="toggle">{
        function toggle() {
          this.minimized(!this.minimized());
          if (this.minimized()) {
            this.clear();
          }
        }
      }</$method>
      <$method name="container">{
        function container(...children) {
          return <div id={this.dom_id()} class={`windowed ${this.class().name()}`} ref={this.uri()}>
            <div class="window-bar">
              <span class="window-info">
                <span
                  class="window-layout"
                  onclick={e => {
                    e.preventDefault();
                    this.toggle();
                  }}
                  onmousedown={e => e.preventDefault()}
                ></span>
                <span class="window-title">{this.window_title()}</span>
              </span>
              <span class="window-menu"></span>
            </div>
            <div class="window-body">
              <span class="swap-target">
                <$if when={!this.minimized()}>
                  {children}
                </$if>
              </span>
            </div>
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
      <$method name="domify">{
        function domify(node) {
          if (typeof node === 'object' && 'type' in node && typeof node.type === 'string') {
            return node;
          } else if (typeof node === 'string') {
            return document.createTextNode(node);
          } else {
            return node.to_dom();
          }
        }
      }</$method>
      <$method name="to_dom" override={true}>{
        function to_dom() {
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
        }
      }</$method>
    </$class>;

    <$class name="application">
      <$var name="command_history" default={[]} />
      <$after name="init">{
        function init() {
          this.addEventListener('command', (e) => {
            this.process_command(e.target);
          });
          const el = document.createElement('style');
          el.innerHTML = this.css();
          document.head.appendChild(el);
        }
      }</$after>
      <$method name="process_command">{
        async function process_command(cmd) {
          try {
            await cmd.run(this);
            this.command_history().push(cmd);
          } catch (err) {
            this.log('command failed', cmd, err);
            this.dispatchEvent({ type: 'error', cmd, err })
          }
        }
      }</$method>
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

    <$class name="if">
      <$var name="when" />
      <$var name="slots" default={[]} />
      <$method name="to_dom">{
        function to_dom() {
          if (this.when()) {
            return this.slots().to_dom();
          } else {
            return ''.to_dom();
          }
        }
      }</$method>
    </$class>
  }
}).load();
