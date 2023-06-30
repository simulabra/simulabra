import base from './base.js';
import { createServer } from 'http';

export default await base.find('class', 'module').new({
  name: 'http',
  package: 'simulabra',
  imports: [base],
  on_load(_, $) {
    $.class.new({
      name: 'http_request',
      slots: [
        $.var.new({
          name: 'inner'
        }),
      ]
    });
    $.class.new({
      name: 'http_response',
      slots: [
        $.var.new({
          name: 'inner'
        }),
        $.method.new({
          name: 'ok',
          do(message, ct = 'text/html') {
            this.inner().writeHead(200, { 'Content-type': ct });
            this.inner().end(message);
          }
        }),
      ]
    });
    $.class.new({
      name: 'http_server',
      slots: [
        $.var.new({ name: 'node_server' }),
        $.var.new({
          name: 'port',
          default: '3030',
        }),
        $.var.new({
          name: 'slots',
          default: [],
        }),
        $.after.new({
          name: 'init',
          do() {
            this.node_server(createServer((req, res) => {
              for (const handler of this.slots()) {
                if (handler.match(req.url)) {
                  return handler.handle($.http_request.new({ inner: req }), $.http_response.new({ inner: res }));
                }
              }
              res.writeHead(404);
              res.end();
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
      slots: [
        $.virtual.new({
          name: 'match'
        }),
        $.virtual.new({
          name: 'handle',
        }),
      ]
    });
    $.class.new({
      name: 'var_handler',
      slots: [
        $.var.new({
          name: 'handler',
        }),
        $.method.new({
          name: 'handle',
          do(...args) {
            this.handler().apply(this, args)
          }
        }),
      ]
    });
    $.class.new({
      name: 'path_request_handler',
      slots: [
        $.request_handler,
        $.var_handler,
        $.var.new({
          name: 'path',
        }),
        $.method.new({
          name: 'match',
          do(url) {
            return this.path() === url;
          }
        }),
      ]
    });
    $.class.new({
      name: 'filetype_request_handler',
      slots: [
        $.request_handler,
        $.var_handler,
        $.var.new({ name: 'filetypes' }),
        $.method.new({
          name: 'match',
          do(url) {
            const filetype = /\.([^\.]+)$/.exec(url)[1];
            this.log(filetype, this.filetypes());
            return this.filetypes().includes(filetype);
          }
        }),
      ]
    });
  },
}).load();
