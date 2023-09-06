import base from './base.jsx';
import html from './html.jsx';
import completion from './completion.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html, completion],
  on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="message">
      <$virtual name="text" />
    </$class>;

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
      <$method name="render">{
        function render() {
          return <div>{this.message_list().map(m => <div>{m}</div>)}</div>;
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

    <$class name="module_browser">
      <$$window />
      <$method name="objects">{
        function objects() {
          return this.module().classes();
        }
      }</$method>
      <$method name="window_title">{
        function window_title() {
          return `${this.title()} (${this.module().name()})`;
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
      <$var name="object" />
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
          return `${this.title()} (${this.object()?.title() ?? 'nothing'})`;
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

    <$class name="task_finish_command">
      <$$command />
      <$var name="target" />
      <$method name="run">{
        function run(ctx) {
          this.log('run');
          this.target().completed(true);
        }
      }</$method>
      <$method name="undo">{
        function undo(ctx) {
          this.target().completed(false);
        }
      }</$method>
    </$class>;

    <$class name="task">
      <$$component />
      <$var name="description" default={''} />
      <$var name="completed" default={false} />
      <$method name="render">{
        function render() {
          return <span>
            <span class={`completed-${this.completed()}`}>{this.description()}</span>
            <$if when={!this.completed()}>
              <$button command={<$task_finish_command target={this} parent={this} />}>{"finish"}</$button>
            </$if>
          </span>;
        }
      }</$method>
    </$class>;

    <$class name="todo_list">
      <$$component />
      <$var name="tasks" default={[]} />
      <$method name="add_task">{
        function add_task(description) {
          const task = <$task description={description} parent={this} />;
          this.tasks([...this.tasks(), task]);
        }
      }</$method>
      <$method name="submit">{
        function submit() {
          const input = this.element().querySelector('input');
          const description = input.value;
          if (description) {
            this.add_task(description);
            input.value = '';
          }
        }
      }</$method>
      <$method name="remove_task">{
        function remove_task(task) {
          this.tasks(this.tasks().filter(t => t !== task));
        }
      }</$method>
      <$method name="render">{
        function render() {
          return <div>
            <div>what needs to be done?</div>
            <input
              type="text"
              onkeydown={e => {
                if (e.key === 'Enter') {
                  this.submit();
                }
              }}
            />
            <button onclick={() => this.submit()}>add</button>
            <ul>
              {this.tasks().map(task =>
                <li>
                  {task}
                  <button onclick={() => this.remove_task(task)}>delete</button>
                </li>
              )}
            </ul>
          </div>;
        }
      }</$method>
    </$class>;

    <$class name="todos">
      <$$window />
      <$var name="todo_list" />
      <$after name="init">{
        function init() {
          this.todo_list(<$todo_list parent={this} />);
        }
      }</$after>
      <$method name="render">{
        function render() {
          return this.todo_list();
        }
      }</$method>
    </$class>;

    <$class name="editor">
      <$after name="init">{
        function init() {
          this.messages(<$message_log />);
          this.explorer(<$object_explorer parent={this} />);
          this.messages().add('STARTING SIMULABRA: INFINITE SOFTWARE');
          this.completor(<$completor parent={this} text="" />);
          this.todos(<$todos parent={this} />);
          this.addEventListener('error', evt => {
            this.messages().add(`error: ${evt.err.toString()}`);
          });
        }
      }</$after>
      <$$window />
      <$$application />
      <$var name="messages" />
      <$var name="explorer" />
      <$var name="completor" />
      <$var name="todos" />
      <$before name="process_command">{
        function process_command(cmd) {
          this.messages().add('run: ' + cmd.description());
        }
      }</$before>
      <$method name="render">{
        function render() {
          return <div class="container">
            <div class="col">
              {$.module.instances().map(it => <$module_browser module={it.deref()} parent={this} />)}
            </div>
            <div class="col">
              {this.todos()}
              {this.completor()}
              {this.explorer()}
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
  --secondary: #50668B;
  --secondary-2: #72868B;
  --background: #E9CA9D;
  --background-secondary: #E2B072;
  --background-text: #F3DAAA;
}

::selection {
  background-color: var(--secondary);
  color: var(--background);
}

body, html {
  margin: 0;
  padding: 0;
  font-size: 14px;
  background: var(--background);
  color: var(--primary);
}

.container {
  display: flex;
}

.col {
  flex: 1;
  overflow: auto;
  padding: 2px;
}

.windowed {
  border: 1px solid var(--primary);
  border-bottom: 0px;
  margin-bottom: 2px;
  max-height: 100%;
}

.window-bar {
  background: var(--background-secondary);
  border-bottom: 1px solid var(--primary);
  display: flex;
  justify-content: space-between;
}

.window-info {
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

.window-layout:hover {
  background: var(--secondary);
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

ul {
  margin: 0;
}

textarea {
  box-sizing: border-box;
  width: 100%;
  height: 30vh;
}

input, textarea {
  background: var(--background-text);
  border: 1px solid var(--primary);
}

input:focus, textarea:focus {
  outline: solid var(--secondary) 1px;
  box-shadow: 0 0 0px var(--secondary);
}

.window-body {
  padding: 2px;
  max-height: 100%;
  overflow-wrap: break-word;
  word-break: break-all;
  border-bottom: 1px solid var(--primary);
}
.message_log {}

.completor-link-pre {
  color: var(--secondary-2);
}

.completor-link-pre-emphasize {
  color: var(--secondary-2);
}

.completed-true {
  text-decoration: line-through;
}

button {
  background: var(--background-secondary);
  border: 1px solid var(--primary);
}

button:hover {
  border: 1px solid var(--secondary);
}

button:active {
  background: var(--background);
}
`;
        }
      }</$method>
    </$class>;
  }
}).load();
