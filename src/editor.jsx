import base from './base.js';
import html from './html.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html],
  on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="message_log">
      <$$component />
      <$var name="message_list"
            default={[]} />
      <$method name="add"
        do={function add(message) {
          this.message_list().push(message); // need proxy/wrapper to trigger update
          this.dispatchEvent({ type: 'update' }); // so we do it manual
        }}
      />
      <$method name="render"
        do={function render() {
          return <div>{this.message_list().map(m => <div>{m}</div>)}</div>;
        }}
      />
    </$class>;

    <$class name="link">
      <$$component />
      <$var name="object" />
      <$method name="render"
        do={function render() {
          return <div><a href="#" id={`link-${this.id()}`} object={this.object().uri()} onclick={e => this.dispatchEvent({ type: 'select', target: e.target })}>
            {this.object().title()}
          </a></div>;
        }}
      />
    </$class>;

    <$class name="object_browser">
      <$$component />
      <$var name="objects"
        desc="list of object urls"
      />
      <$method name="render"
        do={function render() {
          return <div>{
            this.objects()
              .map(c => {
                return <$link object={c} parent={this} />;
              })
          }</div>;
        }}
      />
    </$class>;

    <$class name="object_explorer">
      <$$component />
      <$var name="history" default={[]} />
      <$var name="object" />
      <$method name="select"
        do={function select(value) {
          this.history().push(this.object());
          this.object(value);
        }}
      />
      <$method name="back"
        do={function back() {
          this.object(this.history().pop());
        }}
      />
      <$method name="display"
        do={function display(value) {
          if (typeof value === 'object' && '_id' in value) {
            return <$link object={value} parent={this} />;
          } else if (Array.isArray(value)) {
            return value.map(it => this.display(it));
          } else if ('to_dom' in Object.getPrototypeOf(value)) {
            return value;
          } else {
            return <div>???</div>;
          }
        }}
      />
      <$method name="render"
        do={function render() {
          if (!this.object()) {
            return <span>(no object)</span>;
          }
          return <div>
            <a href="#" onclick={e => this.back()}>back</a>
            <$link object={this.object().class()} parent={this} />
            {this.object().state().map(v => {
              const name = v.var_ref().name();
              const value = v.value();
              return <div>{name}={this.display(value)}</div>;
            })}
          </div>;
        }}
      />
    </$class>;

    <$class name="editor">
      <$before name="init"
        do={function init() {
          this.messages(<$message_log />);
          this.browser(
            <$object_browser
              // list of classes in the selected module
              objects={_.classes()}
              parent={this}
            />
          );
          this.explorer(<$object_explorer parent={this} />);
          this.addEventListener('select', (e) => {
            const ref = __.deref(e.target.attributes.object.value);
            this.messages().add('select: ' + ref.title());
            this.explorer().select(ref);
          });

          this.messages().add('STARTING SIMULABRA: INFINITE SOFTWARE');
        }}
      />
      <$$component />
      <$var name="messages" />
      <$var name="browser" />
      <$var name="explorer" />
      <$method name="render" override={true}
        do={function render() {
          return <div class="container">
            <div class="col">
              {this.browser()}
            </div>
            <div class="col">
              <div class="code_editor">Code here</div>
            </div>
            <div class="col">
              {this.explorer()}
              {this.messages()}
            </div>
          </div>;
        }}
      />
    </$class>;
  }
}).load();
