import base from './base.js';
import { createServer } from 'http';
var __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'http',
  imports: [base],
  on_load(_, $) {
    $.class.new({
      name: 'http_server',
      components: [
        $.var.new({ name: 'node_server' }),
        $.var.new({
          name: 'port',
          default: '3030',
        }),
        $.var.new({
          name: 'handlers',
          default: [],
        }),
        $.after.new({
          name: 'init',
          do() {
            this.node_server(createServer((req, res) => {
              for (const handler of this.handlers()) {
                if (handler.path() === req.url) {
                  handler.handler().apply(this, [req, res]);
                  break; // Exit the loop after finding the correct handler
                }
              }
            }));
            this.node_server().listen(this.port());
          }
        }),
        $.method.new({
          name: 'create',
          do(port, handler) {
            this.http_server = node_http.createServer(handler);
            this.http_server.listen(port);
            // this.log(`Server running at port ${port}`);
          }
        }),
        $.method.new({
          name: 'close',
          do() {
            this.http_server.close();
            // this.log('Server closed');
          }
        })
      ]
    });
    $.class.new({
      name: 'request_handler',
      components: [
        $.var.new({
          name: 'path',
        }),
        $.var.new({
          name: 'handler',
        }),
      ]
    });
  },
}).load();
