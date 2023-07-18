import base from './base.jsx';
import html from './html.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html],
  on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="message_log">
      <$$window />
      <$var name="message_list"
            default={[]} />
      <$method name="add">{
        function add(message) {
          this.message_list().push(message);
          this.dispatchEvent({ type: 'update' });
        }
      }</$method>
      <$method name="title">{
         function title() {
           return 'messages';
        }
      }</$method>
      <$method name="render">{
        function render() {
          return <div>{this.message_list().map(m => <div>{m}</div>)}</div>;
        }
      }</$method>
    </$class>;

    <$class name="link">
      <$$component />
      <$var name="object" />
      <$method name="render">{
        function render() {
          return <div>
            <a href="#"
              id={`link-${this.id()}`}
              object={this.object().uri()}
              onclick={e => this.dispatchEvent({
                type: 'command',
                target: <$explorer_select_command target={__.deref(e.target.attributes.object.value)} />, })}
            >
              {this.object().title()}
            </a>
          </div>;
        }
      }</$method>
    </$class>;

    <$class name="module_browser">
      <$$window />
      <$method name="objects">{
        function objects() {
          return this.module().classes();
        }
      }</$method>
      <$method name="title">{
        function title() {
          return `module ${this.module().name()}`;
        }
      }</$method>
      <$var name="module" />
      <$method name="render">{
        function render() {
          return <div>{
            this.objects()
              .map(c => {
                return <$link object={c} parent={this} />;
              })
          }</div>;
        }
      }</$method>
    </$class>;

    <$class name="object_explorer">
      <$$window />
      <$var name="history" default={[]} />
      <$var name="object" />
      <$method name="select">{
        function select(value) {
          this.history().push(this.object());
          this.object(value);
        }
      }</$method>
      <$method name="back">{
        function back() {
          this.object(this.history().pop());
        }
      }</$method>
      <$method name="display">{
        function display(value) {
          if (typeof value === 'object' && '_id' in value) {
            return <$link object={value} parent={this} />;
          } else if (Array.isArray(value)) {
            return value.map(it => this.display(it));
          } else if ('to_dom' in Object.getPrototypeOf(value)) {
            return value;
          } else {
            return <div>???</div>;
          }
        }
      }</$method>
      <$method name="window_title">{
        function window_title() {
          return `explorer of ${this.object()?.title() ?? 'nothing'}`;
        }
      }</$method>
      <$method name="render">{
        function render() {
          if (!this.object()) {
            return <span>(no object)</span>;
          }
          return <>
            <$link object={this.object().class()} parent={this} />
            {this.object().state().map(v => {
              const name = v.var_ref().name();
              const value = v.value();
              return <div>{name}={this.display(value)}</div>;
            })}
          </>;
        }
      }</$method>
    </$class>;

    <$class name="explorer_select_command">
      <$$command />
      <$var name="target" />
      <$var name="previous" />
      <$method name="run">{
        function run(ctx) {
          this.previous(ctx.explorer().object());
          ctx.explorer().object(this.target());
        }
      }</$method>
      <$method name="undo">{
        function undo(ctx) {
          ctx.explorer().object(this.previous());
        }
      }</$method>
      <$method name="description">{
        function description() {
          return `~explorer_select_command target=${this.target().title()}`;
        }
      }</$method>
    </$class>;

    <$class name="editor">
      <$before name="init"
        do={function init() {
          this.messages(<$message_log />);
          this.browser(
            <$module_browser
              module={_}
              parent={this}
            />
          );
          this.explorer(<$object_explorer parent={this} />);
          this.messages().add('STARTING SIMULABRA: INFINITE SOFTWARE');
        }}
      />
      <$$window />
      <$$application />
      <$var name="messages" />
      <$var name="browser" />
      <$var name="explorer" />
      <$before name="process_command"
        do={function process_command(cmd) {
          this.messages().add('run: ' + cmd.description());
        }}
      />
      <$method name="render">{
        function render() {
          return <div class="container">
            <div class="col">
              {$.module.instances().map(it => <$module_browser module={it} parent={this} />)}
            </div>
            <div class="col">
              {this.explorer()}
            </div>
            <div class="col">
              {this.messages()}
            </div>
          </div>;
        }
      }</$method>
      <$method name="css">{
        function css() {
          return `
  :root {
    --primary: #663C3C;
    --secondary: #50666B;
    --background: #EFCA9D;
  }
  body, html {
    height: 100%;
    margin: 0;
    padding: 0;
    font-size: 13px;
    background: var(--background);
    color: var(--primary);
  }

  .editor, .container {
    height: 100%;
  }
  .container {
    display: flex;
  }

  .col {
    flex: 1;
    overflow: auto;
    padding: 2px;
  }

  .module_browser {}
  .code_editor {}
  .object_explorer {
  }

  .windowed {
    border: 1px solid var(--primary);
    margin-bottom: 2px;
  }

  .window-title {
    border-bottom: 1px solid var(--primary);
    font-style: italic;
    padding: 2px;
  }

  a {
    color: var(--secondary);
  }

  .window-body {
    padding: 2px;
  }
  .message_log {}
`;
        }
      }</$method>
    </$class>;
  }
}).load();
