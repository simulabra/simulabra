import base from './base.jsx';
import html from './html.jsx';
import completion from './completion.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html, completion],
  on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    function debounce(func, wait) {
      var timeout;
      return function () {
        var context = this, args = arguments;
        var later = function () {
          timeout = null;
          func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };

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

    <$class name="explorer_select_link">
      <$$link />
      <$method name="command">{
        function command() {
          return <$explorer_select_command target={this.object()} />
        }
      }</$method>
    </$class>;

    <$class name="completor_fetch_next_command">
      <$$command />
      <$var name="target" />
      <$method name="run">{
        async function run(ctx) {
          this.log(this.target());
          this.target().completion_candidates().reset();
          let logit_bias = [];
          for (let i = 0; i < 4; i++) {
            this.log(this.target().text());
            const completion = await (<$local_llama_completion_command
              prompt={this.target().text()}
              logit_bias={logit_bias}
            />).run();
            this.log(completion);
            this.target().completion_candidates().add(completion);
            const tokens = await (<$local_llama_tokenize_command
              prompt={completion}
            />).run();
            for (const tok of tokens) {
              const logit = logit_bias.find(l => l[0] === tok);
              if (logit) {
                logit[1] -= 1.0;
              } else {
                logit_bias.push([tok, -1.0]);
              }
            }
          }
        }
      }</$method>
      <$method name="description">{
        function description() {
          return `<${this.title()} target={${this.target().title()}} />`;
        }
      }</$method>
    </$class>;

    <$class name="completor_fetch_next_link">
      <$$link />
      <$method name="link_text">{
        function link_text() {
          return 'think!';
        }
      }</$method>
      <$method name="command">{
        function command() {
          return <$completor_fetch_next_command target={this.object()} />
        }
      }</$method>
    </$class>;

    <$class name="completor_add_link">
      <$$link />
      <$var name="target" />
      <$var name="text" />
      <$method name="command">{
        function command() {
          return <$completor_add_text target={this.target()} text={this.text()} />
        }
      }</$method>
    </$class>;

    <$class name="completion_candidates">
      <$$component />
      <$var name="candidates" default={[]} />
      <$method name="render">{
        function render() {
          return <div>
            {this.candidates().map(cc => <div>{cc}</div>)}
          </div>;
        }
      }</$method>
      <$method name="add">{
        function add(it) {
          this.candidates([...this.candidates(), it]);
        }
      }</$method>
      <$method name="reset">{
        function reset() {
          this.candidates([]);
        }
      }</$method>
    </$class>;

    <$class name="completor">
      <$$window />
      <$var name="text" observable={false} />
      <$var name="completion_candidates" />
      <$var name="textarea" />
      <$after name="init">{
        function init() {
          let self = this;
          this.textarea(<textarea
              oninput={debounce(function (e) {
                e.preventDefault();
                self.text(this.value);
                return;
                self.dispatchEvent({
                  type: 'command',
                  target: <$completor_fetch_next_command text={this.value} target={self} />
                });
              }, 1000)}
            >{this.text()}</textarea>);
          this.completion_candidates(<$completion_candidates />);
        }
      }</$after>
      <$method name="window_title">{
        function window_title() {
          return `let's imagine!`;
        }
      }</$method>
      <$method name="render">{
        function render() {
          return <div>
            {this.textarea()}
            <$completor_fetch_next_link object={this} parent={this} />
            {this.completion_candidates()}
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
                return <$explorer_select_link object={c} parent={this} />;
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
            return <$explorer_select_link object={value} parent={this} />;
          } else if (Array.isArray(value)) {
            return value.map(it => this.display(it));
          } else if ('to_dom' in Object.getPrototypeOf(value)) {
            return value;
          } else if (value instanceof WeakRef) {
            const ref = value.deref();
            if (ref !== undefined) {
              return this.display(ref);
            } else {
              return <div>(empty ref)</div>
            }
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
            <$explorer_select_link object={this.object().class()} parent={this} />
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
          this.completor(<$completor parent={this} text="" />);
        }}
      />
      <$$window />
      <$$application />
      <$var name="messages" />
      <$var name="browser" />
      <$var name="explorer" />
      <$var name="completor" />
      <$before name="process_command"
        do={function process_command(cmd) {
          console.log(cmd);
          this.messages().add('run: ' + cmd.description());
        }}
      />
      <$method name="render">{
        function render() {
          return <div class="container">
            <div class="col">
              {$.module.instances().map(it => <$module_browser module={it.deref()} parent={this} />)}
            </div>
            <div class="col">
              {this.explorer()}
            </div>
            <div class="col">
              {this.completor()}
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
    --background-secondary: #EFB072;
  }
  body, html {
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
    max-height: 100%;
  }

  .window-bar {
    background: var(--background-secondary);
    border-bottom: 1px solid var(--primary);
    display: flex;
    justify-content: space-between;
  }

  .window-layout {
    width: 18px;
    height: 7px;
    display: inline-block;
    background: var(--primary);
    align-self: flex-start;
  }

  .window-menu {
    width: 18px;
    height: 6px;
    display: inline-block;
    border-top: 1px solid var(--primary);
    border-bottom: 1px solid var(--primary);
    align-self: center;
  }

  .window-title {
    font-style: italic;
    padding: 2px;
  }

  a {
    color: var(--secondary);
  }

  .window-body {
    padding: 2px;
    max-height: 100%;
  }
  .message_log {}
`;
        }
      }</$method>
    </$class>;
  }
}).load();
