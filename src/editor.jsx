import base from './base.js';
import html from './html.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html],
  on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="message_log">
      <$$component />
      <$var name="message_list" default={[]} />
      <$method name="add"
        do={function add(message) {
          this.message_list().push(message); // need proxy/wrapper to trigger update
          this.emit('update'); // so we do it manual
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
          return <div><a href="#" object={this.object()} onclick={e => this.emit('select', e)}>
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
          return <div>{this.objects().map(c =>
            <div><a href="#" object={c} onclick={e => this.emit('select', e)}>
              {__.deref(c).title()}
            </a></div>)}</div>;
        }}
      />
    </$class>;

    <$class name="object_explorer">
      <$$component />
      <$var name="object" />
      <$method name="render"
        do={function render() {
          if (!this.object()) {
            return <span>(no object)</span>;
          }
          this.log(this.object().state());
          return <div>
                   <h4>{this.object().title()}</h4>
                   {this.object().state().map(v => {
                     const name = v.var_ref().name();
                     const value = v.value();
                     return <div>{`${v.var_ref().name()}=${v.value()}`}</div>
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
              objects={Object.keys(__.tracked())}
            />
          );
          this.browser().on('select', (e) => {
            const ref = e.target.attributes.object.value;
            this.messages().add('select: ' + __.deref(ref).title());
            this.explorer().object(__.deref(ref));
          });
          this.explorer(<$object_explorer />);

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
