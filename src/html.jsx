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
      <$var name="children" default={[]} />
      <$method name="to_dom"
        do={function to_dom() {
          return this.container(this.render()).to_dom();
        }}
      />
      <$method name="swap"
        do={function swap(content) {
          this.log(content);
          this.element().innerHTML = content.to_dom();
        }}
      />
    </$class>;

    <$class name="html_element">
      <$var name="tag" default={'div'} />
      <$var name="properties" default={{}} />
      <$var name="events" default={{}} />
      <$var name="children" default={[]} />
      <$method name="to_dom" override={true}
        do={function to_dom() {
          this.log(this);
          const elem = document.createElement(this.tag());
          for (const prop of Object.keys(this.properties())) {
            if (prop.indexOf('on') === 0) {
              const fn = this.properties()[prop];
              const self = this;
              elem.addEventListener(prop.slice(2), e => {
                fn.apply(self, [e]);
              });
            } else {
              elem.setAttribute(prop, this.properties()[prop]);
            }
          }
          for (const child of this.children()) {
            const domify = (node) => {
              console.log(node);
              if (typeof node === 'object' && 'type' in node && typeof node.type === 'string') {
                return node;
              } else if (typeof node === 'string') {
                return document.createTextNode(node);
              } else {
                return node.to_dom();
              }
            }
            if (Array.isArray(child)) {
              for (const n of child) {
                elem.appendChild(domify(n));
              }
            } else {
              elem.appendChild(domify(child));
            }
          }
          for (const [name, fn] of Object.entries(this.events())) {
            elem['on' + name] = fn.bind(this);
          }
          return elem;
        }}
      />
    </$class>;

  }
}).load();
