import base from './base.js';
import html from './html.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="message_log">
      <$$component />
      <$var name="message_list" default={[]} />
      <$method name="add"
        do={function add(message) {
          this.message_list().push(message);
          this.children([<div>{message}</div>]);
        }}
      />
      <$method name="render"
        do={function render() {
          return <div>{this.message_list().map(m => <div>{m}</div>)}</div>;
        }}
      />
    </$class>;

    <$class name="object_browser">
      <$$component />
      <$var name="click" />
      <$var name="objects" />
      <$after name="init"
        do={function init() {
          this.linkify();
        }}
      />
      <$method name="linkify"
        do={function linkify() {
          this.children();
        }}
      />
      <$method name="render"
        do={function render() {
          return <div>{this.objects().map(c => <div><a href="#" object={c} onclick={this.click()}>{__.deref(c).title()}</a></div>)}</div>;
        }}
      />
    </$class>;

    <$class name="object_explorer">
      <$$component />
      <$var name="object" />
      <$method name="render"
        do={function render() {
          return <div>{this.object()?.name() ?? '<none>'}</div>;
        }}
      />
    </$class>;
    <$class name="editor">
      <$before name="init"
        do={function init() {
          const self = this;
          this.messages(<$message_log />);
          this.browser(
            <$object_browser
              objects={Object.keys(__.tracked())}
              click={function click(e) {
                this.log('click');
                self.messages().add(__.deref(this.properties().object).title());
                self.messages().swap(self.messages().render());
              }}
            />
          );
          this.explorer(<$object_explorer />);

          this.messages().add('hello there!');
          /* this.swap(this.render()); */
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
