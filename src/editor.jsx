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
          return this.message_list().map(m => <div>{m}</div>);
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
          return this.objects().map(c => <div><a href="#" object={c} onclick={this.click()}>{__.deref(c).title()}</a></div>);
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
              }}
            />
          );
          this.explorer(<$object_explorer />);

          this.messages().add('hello there!');
          this.messages().render();
          this.browser().render();
          this.explorer().render();
        }}
      />
      <$$component />
      <$var name="messages" />
      <$var name="browser" />
      <$var name="explorer" />
      <$method name="render" override={true}
        do={function render() {
          return <span>
            <div class="col">
              {this.browser().render()}
            </div>
            <div class="col">
              <div class="code_editor">Code here</div>
            </div>
            <div class="col">
              {this.explorer().render()}
              {this.messages().render()}
            </div>
          </span>;
        }}
      />
    </$class>;
  }
}).load();
