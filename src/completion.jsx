import base from './base.jsx';
import html from './html.jsx';

export default await base.find('class', 'module').new({
  name: 'completion',
  imports: [base, html],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    // TODO: queue these so only one is running on the backend at the time, add load balancer, or make own API
    // to prevent llama.cpp server segfaulting
    <$class name="local_llama_completion_command">
      <$$command />
      <$var name="prompt"/>
      <$var name="server_url" default="http://localhost:3731" />
      <$var name="n_predict" default={4} />
      <$var name="logit_bias" default={[]} />
      <$method name="run"
        do={async function run() {
          const res = await fetch(`${this.server_url()}/completion`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt: this.prompt(),
              temperature: 0.9,
              top_k: 40,
              top_p: 0.8,
              n_predict: this.n_predict(),
              stream: true,
              logit_bias: this.logit_bias(),
            })
          });

          let t = await res.text();
          let out = '';

          // Bun doesn't support data streaming with fetch, so it all comes at once
          t.split('\n').forEach(l => {
            if (l.startsWith('data: ')) {
              const message = JSON.parse(l.substring(6));
              out += message.content;
            }
          });
          return out;
        }} />
    </$class>;

    <$class name="local_llama_tokenize_command">
      <$$command />
      <$var name="prompt" />
      <$var name="server_url" default="http://localhost:3731" />
      <$method name="run"
        do={async function run() {
          const res = await fetch(`${this.server_url()}/tokenize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: this.prompt(),
            })
          });

          if (!res.ok) {
            console.error('Error:', res.status, res.statusText);
            return;
          }

          let result = await res.json();
          return result.tokens;
        }} />
    </$class>;

    <$class name="cmd_prompt">
      <$var name="prompt" default={'Simulabra was passed no prompt because'} />
      <$var name="count_tokens" default={false} />

      <$method name="execute" do={ async function execute() {
        for (let j = 0; j < 5; j++) {
          let res = '';
          let logit_bias = [];
          const start = +new Date();
          for (let i = 0; i < 10; i++) {
            const result = await(<$local_llama_completion_command
              server_url="http://localhost:3731"
              prompt={this.prompt() + res}
              n_predict={1}
              logit_bias={logit_bias}
            />).run();
            res += result;
            if (this.count_tokens()) {
              const tokens = await(<$local_llama_tokenize_command
                server_url="http://localhost:3731"
                prompt={res}
              />).run();
              this.log(`(${tokens.length} toks in ${completion_ms}ms)`, this.prompt());
            }
          }
          const tokens = await(<$local_llama_tokenize_command
            server_url="http://localhost:3731"
            prompt={res}
          />).run();
          for (const tok of tokens) {
            const logit = logit_bias.find(l => l[0] === tok);
            if (logit) {
              logit[1] -= 1.0;
            } else {
              logit_bias.push([tok, -1.0]);
            }
          }
          const completion_ms = +new Date() - start;
          this.log(`(${completion_ms}ms)`, res);
        }
        process.exit(0);
      }}/>
    </$class>;

    if (window.process && process?.argv[1].indexOf('completion.jsx') >= 0) {
      const cmd = <$cmd_prompt prompt={process.argv[2]} />;
      cmd.execute();
    }

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

    <$class name="completor_insert_command">
      <$$command />
      <$var name="target" />
      <$var name="text" />
      <$method name="run">{
        async function run(ctx) {
          this.log('run', this.text(), this.target().text());
          this.target().text(this.target().text() + this.text());
          await (<$completor_fetch_next_command target={this.target()} />).run(ctx);
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
      <$var name="text" />
      <$method name="link_text">{
        function link_text() {
          return `'${this.text()}'`;
        }
      }</$method>
      <$method name="command">{
        function command() {
          return <$completor_insert_command target={this.object()} text={this.text()} />
        }
      }</$method>
    </$class>;

    <$class name="completion_candidates">
      <$$component />
      <$var name="candidates" default={[]} />
      <$method name="render">{
        function render() {
          return <div>
            {this.candidates().map(cc => <$completor_add_link object={this.parent()} text={cc} parent={this} />)}
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
      <$var name="text" />
      <$var name="completion_candidates" />
      <$var name="textarea" />
      <$after name="init">{
        function init() {
          this.completion_candidates(<$completion_candidates parent={this} />);
        }
      }</$after>
      <$method name="window_title">{
        function window_title() {
          return `let's imagine!`;
        }
      }</$method>
      <$method name="render">{
        function render() {
          let self = this;
          return <div>
            <textarea
              oninput={function (e) {
                e.preventDefault();
                self.text(this.value, false);
              }}
            >{this.text()}</textarea>
            <$completor_fetch_next_link object={this} parent={this} />
            {this.completion_candidates()}
          </div>;
        }
      }</$method>
    </$class>;
  }
}).load();
