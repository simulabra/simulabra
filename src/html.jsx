import base from './base.js';

export default await base.find('class', 'module').new({
  name: 'html',
  imports: [base],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="component">
      <$method name="container"
        do={function container() {
          return <div class={this.class().name()} ref={this.uri()}></div>
        }}
      />
      <$method name="inner"
        do={function inner(...objs) {
          this.element(this.container());
          this.element().children(objs);
        }}
      />
      <$var name="element" />
      <$var name="children" default={[]} />
      <$method name="to_dom"
        do={function to_dom() {
          const rr = this.render();
          this.log('rendered', rr);
          return rr.to_dom();
        }}
      />
      <$method name="add_child"
        do={function add_child(child) {
          this.children().push(child);
        }}
      />
      <$after name="init"
        do={function init() {
          this.element(this.container());
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
