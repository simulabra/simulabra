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
      <$method name="run"
        do={function run() {
          return new Promise(async (resolve, reject) => {
            const res = await (<$http_request_command
              url={`${this.server_url()}/completion`}
              method="post"
              response_type="stream"
              data={{
                prompt: this.prompt(),
                temperature: 0.7,
                top_k: 100,
                top_p: 2.0,
                n_predict: 50,
                stream: true,
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

    const prompt = process.argv[2] || 'Simulabra was passed no prompt because';
    const result = await (<$local_llama_completion_command
                            server_url="http://localhost:3731"
                            prompt={prompt}
                          />).run();
    this.log(prompt + result);
    process.exit(0);
  }
}).load();
