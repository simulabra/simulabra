import base from './base.js';
import { createServer } from 'http';

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
                  handler.handle(req, res);
                }
              }
            }));
            this.node_server().listen(this.port());
          }
        }),
        $.method.new({
          name: 'close',
          do() {
            this.http_server.close();
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
        $.method.new({
          name: 'handle',
          do(...args) {
            this.handler().apply(this, args)
          }
        })
      ]
    });
  },
}).load();
