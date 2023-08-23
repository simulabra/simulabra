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

    <$class name="explorer_select_link">
      <$$link />
      <$method name="command">{
        function command() {
          return <$explorer_select_command target={this.object()} />
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
    <$class name="task">
      <$var name="title" default={''} />
      <$var name="completed" default={false} />
      <$method name="toggle_completion">
        do={function toggle_completion() {
          this.completed(!this.completed());
        }}
      </$method>
    </$class>;

    <$class name="todo_list">
      <$$component />
      <$var name="tasks" default={[]} />
      <$method name="add_task">
        do={function add_task(title) {
          const task = <$task title={title} />;
          this.tasks([...this.tasks(), task]);
        }}
      </$method>
      <$method name="remove_task">
        do={function remove_task(task) {
          this.tasks(this.tasks().filter(t => t !== task));
        }}
      </$method>
      <$method name="render">
        do={function render() {
          return <div>
            <h2>Todo List</h2>
            <input type="text" id="new-task-title" />
            <button onclick={() => {
              const title = document.getElementById('new-task-title').value;
              console.log(title);
              if (title) {
                this.add_task(title);
                document.getElementById('new-task-title').value = '';
              }
            }}>
              Add Task
            </button>
            <ul>
              {this.tasks().map(task =>
                <li>
                  <span>{task.title()}</span>
                  <button onclick={() => task.toggle_completion()}>
                    {task.completed() ? 'Undo' : 'Complete'}
                  </button>
                  <button onclick={() => this.remove_task(task)}>Delete</button>
                </li>
              )}
            </ul>
          </div>;
        }}
      </$method>
    </$class>;

    <$class name="todos">
      <$$window />
      <$var name="todo_list" default={<$todo_list />} />
      <$method name="window_title">
        do={function window_title() {
          return 'Todo List Application';
        }}
      </$method>
      <$method name="render">
        do={function render() {
          return this.todo_list().render();
        }}
      </$method>
    </$class>;

    <$class name="editor">
      <$after name="init"
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
          this.todos(<$todos parent={this} />);
          this.addEventListener('error', evt => {
            this.messages().add(`error: ${evt.err.toString()}`);
          })
        }}
      />
      <$$window />
      <$$application />
      <$var name="messages" />
      <$var name="browser" />
      <$var name="explorer" />
      <$var name="completor" />
      <$var name="todos" />
      <$before name="process_command"
        do={function process_command(cmd) {
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
  --secondary: #50666B;
  --secondary-2: #72868B;
  --background: #EFCA9D;
  --background-secondary: #EFB072;
  --background-text: #F3DAAA;
}

body, html {
  margin: 0;
  padding: 0;
  font-size: 14px;
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

textarea {
  box-sizing: border-box;
  width: 100%;
  height: 30vh;
  background: var(--background-text);
  border: 1px solid var(--primary);
}

.window-body {
  padding: 2px;
  max-height: 100%;
  overflow-wrap: break-word;
  word-break: break-all;
}
.message_log {}

.completor-link-pre {
  color: var(--secondary-2);
}

.completor-link-pre-emphasize {
  color: var(--secondary-2);
}
`;
        }
      }</$method>
    </$class>;
  }
}).load();
