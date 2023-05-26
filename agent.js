import base from './base.js';
import http from './http.js';
import { readFileSync } from 'fs';

export default await base.find('class', 'module').new({
  name: 'agent',
  imports: [base, http],
  async on_load(_, $) {
    $.http_server.new({
      port: 3031,
      handlers: [
        $.path_request_handler.new({
          path: '/',
          handler(req, res) {
            res.ok(`<html><body><script type="module">
import base from './base.js';
await base.find('class', 'module').new({
  name: 'client',
  imports: [base],
  on_load(_, $) {
    this.log('in client!');
  }
}).load();
</script></body></html>`);
          }
        }),
        $.filetype_request_handler.new({
          filetype: 'js',
          handler(req, res) {
            res.ok(readFileSync('.' + req.inner().url).toString(), 'application/javascript');
          }
        }),
      ]
    });

  }
}).load();
