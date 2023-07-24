import base from './base.jsx';

export default await base.find('class', 'module').new({
  name: 'completion',
  imports: [base],
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
      <$var name="prompt" default={process.argv[2] || 'Simulabra was passed no prompt because'} />
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

    if (process.argv[1].indexOf('completion.jsx') >= 0) {
      const cmd = <$cmd_prompt />;
      cmd.execute();
    }
  }
}).load();
