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

          console.log(res);
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
      <$var name="prompt"/>
      <$var name="server_url"/>
      <$method name="run"
        do={async function run() {
          const res = await (<$http_request_command
            url={`${this.server_url()}/tokenize`}
            method="post"
            data={{
              content: this.prompt(),
            }}
          />).run();
          return res.data.tokens;
        }} />
    </$class>;

    async function cmdPrompt() {
      let prompt = process.argv[2] || 'Simulabra was passed no prompt because';
      let count_toks = false;
      for (let j = 0; j < 8; j++) {
        let res = '';
        let logit_bias = [];
        for (let i = 0; i < 4; i++) {
          const start = +new Date();
          const result = await(<$local_llama_completion_command
            server_url="http://localhost:3731"
            prompt={prompt + res}
            n_predict={1}
            logit_bias={logit_bias}
          />).run();
          const completion_ms = +new Date() - start;
          res += result;
          if (count_toks) {
            const tokens = await(<$local_llama_tokenize_command
              server_url="http://localhost:3731"
              prompt={res}
            />).run();
            // this.log(`(${tokens.length} toks in ${completion_ms}ms)`, prompt);
          } else {
            // this.log(`(${completion_ms}ms)`, res);
          }
        }
        this.log(res);
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
      }
      process.exit(0);
    }
  }
}).load();
