import base from './base.js';
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
                /* temperature: 0.7, */
                /* top_k: 40, */
                /* top_p: 0.9, */
                /* repeat_penalty: 1.3, */
                n_predict: 16,
                stream: true,
              }}
            />).run();
            let out = '';
            res.data.on('data', chunk => {
              const t = Buffer.from(chunk).toString('utf8');
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

    const prompt = 'Your name: ';
    const result = await (<$local_llama_completion_command
                            server_url="http://localhost:3731"
                            prompt={prompt}
                          />).run();
    this.log(prompt + result);
  }
}).load();
