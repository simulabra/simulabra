import base from './base.jsx';
import http from './http.js';

export default await base.find('class', 'module').new({
  name: 'completion',
  imports: [base, http],
  async on_load(_, $) {
    const __ = globalThis.SIMULABRA;

    <$class name="local_llama_completion_command">
      <$$command />
      <$var name="prompt"/>
      <$var name="server_url"/>
      <$var name="n_predict" default={8} />
      <$method name="run"
        do={function run() {
          return new Promise(async (resolve, reject) => {
            const res = await (<$http_request_command
              url={`${this.server_url()}/completion`}
              method="post"
              response_type="stream"
              data={{
                prompt: this.prompt(),
                temperature: 0.8,
                top_k: 40,
                top_p: 0.9,
                n_predict: this.n_predict(),
                stream: true,
                /* logit_bias: [ */
                /*   [29896, false], */
                /* ] */
              }}
            />).run();
            let out = '';
            res.data.on('data', chunk => {
              this.log('receive data');
              const t = Buffer.from(chunk).toString('utf8');
              // Bun doesn't support data streaming with fetch, so it all comes at once
              t.split('\n').forEach(l => {
                if (l.startsWith('data: ')) {
                  const message = JSON.parse(l.substring(6));
                  out += message.content;
                }
              });
            });
            res.data.on('end', () => resolve(out));
          });
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

    let prompt = process.argv[2] || 'Simulabra was passed no prompt because';
    let count_toks = false;
    for (let i = 0; i < 100; i++) {
      const start = +new Date();
      const result = await (<$local_llama_completion_command
        server_url="http://localhost:3731"
        prompt={prompt}
        n_predict={1}
      />).run();
      const completion_ms = +new Date() - start;
      prompt += result;
      if (count_toks) {
        const tokens = await (<$local_llama_tokenize_command
          server_url="http://localhost:3731"
          prompt={prompt}
        />).run();
        this.log(`(${tokens.length} toks in ${completion_ms}ms)`, prompt);
      } else {
        this.log(`(${completion_ms}ms)`, prompt);
      }
    }
    process.exit(0);
  }
}).load();
