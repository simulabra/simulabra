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
      <$var name="temperature" default={0.7} />
      <$var name="top_k" default={200} />
      <$var name="top_p" default={0.95} />
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
              temperature: this.temperature(),
              top_k: this.top_k(),
              top_p: this.top_p(),
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

    let completor_fetch_next_lock = null;
    <$class name="completor_fetch_next_command">
      <$$command />
      <$var name="target" />
      <$method name="acquire_lock">{
        function acquire_lock() {
          if (completor_fetch_next_lock === null) {
            // If no lock currently exists, create a new one
            let resolveLock;
            completor_fetch_next_lock = new Promise(resolve => resolveLock = resolve);

            // Return a function that "releases" the lock
            return async () => {
              resolveLock();
              await completor_fetch_next_lock;
              completor_fetch_next_lock = null;
            }
          } else {
            // If a lock already exists, wait for it to be released
            // and then acquire a new one
            return new Promise(async resolveOuter => {
              await completor_fetch_next_lock;
              resolveOuter(this.acquire_lock());
            });
          }
        }
      }</$method>
      <$method name="run">{
        async function run(ctx) {
          const lock = await this.acquire_lock();
          try {
            let completions = [];
            const server_url = `http://${window.location.hostname}:3731`;
            this.target().completion_candidates().reset();
            let logit_bias = [];
            let temperature = 0.7;
            for (let i = 0; i < 8; i++) {
              const completion = await (<$local_llama_completion_command
                server_url={server_url}
                prompt={this.target().prompt()}
                logit_bias={logit_bias}
                n_predict={5}
                temperature={temperature}
              />).run();
              completions.push(completion);
              this.target().completion_candidates().add(completion);
              const tokens = await (<$local_llama_tokenize_command
                server_url={server_url}
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
              temperature += 0.2;
            }

            const best_prompt = `
Be an interesting, smart guide to your own latent space.
### Instruction:
Choose the most interesting and true completion for the prompt. Respond with only the number.
Prompt:
${this.target().prompt()}
Completion choices:
${completions.map((c, i) => `[${i}] ${c}`).join('\n')}
### Response:
 `;
            const best = await (<$local_llama_completion_command
              server_url={server_url}
              prompt={best_prompt}
              logit_bias={logit_bias}
              n_predict={1}
              temperature={temperature}
            />).run();
            this.log(best_prompt, best);
            this.target().completion_candidates().emphasized(+best);
          } finally {
            lock();
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
          this.target().insert(this.text());
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
      <$var name="emphasize" />
      <$method name="link_text">{
        function link_text() {
          return <>{this.emphasize() ? '> ' : ''}<span class="completor-link-pre">{this.object().choices().slice(-2).join('')}</span>{this.text()}</>;
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
      <$var name="emphasized" />
      <$method name="render">{
        function render() {
          return <div>
            {this.candidates().map((cc, i) => <$completor_add_link object={this.parent()} text={cc} parent={this} emphasize={i === this.emphasized()} />)}
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
          this.emphasized(null);
          this.candidates([]);
        }
      }</$method>
    </$class>;

    <$class name="completor">
      <$$window />
      <$var name="text" />
      <$var name="completion_candidates" />
      <$var name="textarea" />
      <$var name="choices" default={[]} />
      <$after name="init">{
        function init() {
          this.completion_candidates(<$completion_candidates parent={this} />);
        }
      }</$after>
      <$method name="window_title">{
        function window_title() {
          return `imagine anything`;
        }
      }</$method>
      <$method name="insert">{
        function insert(it) {
          this.choices().push(it);
          this.text(this.text() + it);
        }
      }</$method>
      <$method name="prompt">{
        function prompt() {
          return this.text();
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
                self.completion_candidates().clear();
                self.choices([self.text().slice(-10)], false);
              }}
              onload={function (e) {
                self.log('textarea onload', this);
                setTimeout(() => {
                  this.scrollTop = this.scrollHeight;
                }, 0);
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
