import base from './base.jsx';
import html from './html.jsx';

export default await base.find('class', 'module').new({
  name: 'editor',
  imports: [base, html],
  on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="message">
      <$$component />
      <$var name="text" />
      <$var name="time" />
      <$method name="render">{
        function render() {
          return <div><span class="time">{this.time().toISOString()}</span> {this.text()}</div>;
        }
      }</$method>
    </$class>;

    <$class name="message_log">
      <$$window />
      <$var name="message_list"
            default={[]} />
      <$method name="add">{
        function add(mstr) {
          this.message_list().push(<$message text={mstr} time={new Date()} />);
          this.dispatchEvent({ type: 'update' });
        }
      }</$method>
      <$method name="render">{
        function render() {
          return <div>{this.message_list().map(m => m.render())}</div>;
        }
      }</$method>
    </$class>;

    <$class name="explorer_select_link">
      <$$link />
      <$var name="target" />
      <$var name="object" />
      <$method name="command">{
        function command() {
          return <$explorer_select_command target={this.target()} object={this.object()} />
        }
      }</$method>
    </$class>;

    <$class name="intro">
      <$$window />
      <$method name="render">{
        function render() {
          return <div>
            <div class="intro-title">SIMULABRA</div>
            <div class="intro-infinite">alpha - "infinite software"</div>
            <div>a software construction kit for the web</div>
            <div>try exploring some classes or adding some todos</div>
            <div>soon: modifying values in the explorer, drag and drop, basic code editing</div>
            <div>behold the source at the <a href="https://github.com/simulabra/simulabra">github repo</a></div>
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
                return <$explorer_select_link object={c} target={this.parent().explorer()}/>;
              })
          }</div>;
        }
      }</$method>
    </$class>;

    <$class name="slot_value">
      <$$component />
      <$var name="slot_name" />
      <$var name="value" />
      <$method name="display">{
        function display() {
          if (this.value() !== null && typeof this.value() === 'object' && '_id' in this.value()) {
            return <$explorer_select_link target={this.parent()} object={this.value()} />;
          } else if (Array.isArray(this.value())) {
            return <span>list({this.value().length}){this.value().map(it => <div class="array-item">  <$explorer_select_link object={it} target={this.parent()} /></div>)}</span>;
          } else if (this.value() !== null && 'to_dom' in (Object.getPrototypeOf(this.value()) || {})) {
            return this.value();
          } else if (this.value() instanceof WeakRef) {
            const ref = this.value().deref();
            if (ref !== undefined) {
              return (<$slot_value slot_name={this.slot_name()} value={value} />).display();
            } else {
              return <span>(empty ref)</span>
            }
          } else {
            return <span>{this.value().toString()}</span>;
          }
        }
      }</$method>
      <$method name="render">{
        function render() {
          return <div>{this.slot_name()}: {this.display()}</div>;
        }
      }</$method>
    </$class>;

    <$class name="object_explorer">
      <$$window />
      <$var name="object" />
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
                   class <$explorer_select_link target={this} object={this.object().class()} />
                   {this.object().state().map(v => {
                     const [name, value] = v.kv();
                     return <$slot_value slot_name={name} value={value} />
                   })}
            {this.object().class() === $.class ?
             <$slot_value slot_name="instances" value={this.object().instances()} />
             : ''
            }
          </>;
        }
      }</$method>
    </$class>;

    <$class name="explorer_select_command">
      <$$command />
      <$var name="target" />
      <$var name="object" />
      <$var name="previous" />
      <$method name="run">{
        function run() {
          this.previous(this.target().object());
          this.target().object(this.object());
        }
      }</$method>
      <$method name="description">{
        function description() {
          return `~explorer_select_command target=${this.target().title()}`;
        }
      }</$method>
    </$class>;

    <$class name="task_finish_command">
      <$$command />
      <$var name="target" />
      <$method name="run">{
        function run() {
          this.target().completed(true);
        }
      }</$method>
      <$method name="undo">{
        function undo() {
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
              <$button command={<$task_finish_command target={this} />}>{"finish"}</$button>
            </$if>
          </span>;
        }
      }</$method>
    </$class>;

    <$class name="task_submit_command">
      <$$command />
      <$var name="target" />
      <$method name="run">{
        function run() {
          this.target().submit();
        }
      }</$method>
    </$class>;

    <$class name="task_remove_command">
      <$$command />
      <$var name="target" />
      <$var name="task" />
      <$method name="run">{
        function run() {
          this.target().remove_task(this.task());
        }
      }</$method>
    </$class>;

    <$class name="todo_list">
      <$$component />
      <$var name="tasks" default={[]} />
      <$method name="load_tasks_from_storage">{
        function load_tasks_from_storage() {
          const storedTasks = JSON.parse(localStorage.getItem('tasks'));
          if (storedTasks) {
            this.tasks(storedTasks.map(taskData => {
              const task = <$task description={taskData.description} completed={taskData.completed} />;
              return task;
            }));
          }
        }
      }</$method>
      <$method name="save_tasks_to_storage">{
        function save_tasks_to_storage() {
          const taskData = this.tasks().map(task => ({
            description: task.description(),
            completed: task.completed(),
          }));
          localStorage.setItem('tasks', JSON.stringify(taskData));
        }
      }</$method>
      <$method name="add_task">{
        function add_task(description) {
          const task = <$task description={description} />;
          this.tasks([...this.tasks(), task]);
          this.save_tasks_to_storage();
        }
      }</$method>
      <$method name="remove_task">{
        function remove_task(task) {
          this.tasks(this.tasks().filter(t => t !== task));
          this.save_tasks_to_storage();
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
      <$method name="render">{
        function render() {
          return <div>
                     <div>what needs to be done?</div>
                     <input
                       type="text"
                       onkeydown={e => {
                         if (e.key === 'Enter') {
                           return this.dispatchEvent({
                             type: 'command',
                             target: <$task_submit_command target={this} />,
                           });
                         }
                       }}
                     />
                     <$button command={<$task_submit_command target={this} />}>add</$button>
                     <ul>
                       {this.tasks().map(task =>
                         <li>
                           {task}
                           <$button command={<$task_remove_command target={this} task={task} />}>delete</$button>
                         </li>
                       )}
                     </ul>
                   </div>;
        }
      }</$method>
      <$after name="init">{
        function init() {
          this.load_tasks_from_storage();
        }
      }</$after>
    </$class>;

    <$class name="todos">
      <$$window />
      <$var name="todo_list" />
      <$after name="init">{
        function init() {
          this.todo_list(<$todo_list />);
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
          this.explorer(<$object_explorer />);
          this.messages().add('STARTING SIMULABRA');
          this.todos(<$todos />);
          this.modules(__.base().instances($.module).map(it => <$module_browser module={it} />));
          this.addEventListener('error', evt => {
            this.messages().add(`error: ${evt.err.toString()}`);
          });
        }
      }</$after>
      <$$window />
      <$$application />
      <$var name="messages" />
      <$var name="explorer" />
      <$var name="modules" />
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
              <$intro />
              {this.modules()}
            </div>
            <div class="col">
              {this.todos()}
              {this.explorer()}
              {this.messages()}
            </div>
          </div>;
        }
      }</$method>
      <$method name="css">{
        function css() {
          return `
.message_log {}

.time {
  font-style: italic;
  font-size: 11px;
}

.explorer_select_link {
  margin: 2px;
}

.completor-link-pre {
  color: var(--secondary-2);
}

.completor-link-pre-emphasize {
  color: var(--secondary-2);
}

.completed-true {
  text-decoration: line-through;
}

.intro-title {
  font-weight: bold;
  font-style: italic;
  font-size: 24px;
}

.intro-infinite {
  font-style: italic;
}
`;
        }
      }</$method>
    </$class>;
  }
}).load();
