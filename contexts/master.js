import { __, base } from '../src/base.js';
import live from '../src/live.js';

export default await async function (_, $, $base, $live) {
  $base.Class.new({
    name: 'WebsocketServer',
    slots: [
      $base.Var.new({
        name: 'handlers'
      }),
      $base.Method.new({
        name: 'registerHandler',
        do(handler) {
          this.handlers()[handler.topic()] = handler;
        }
      }),
      $base.Method.new({
        name: 'serve',
        do() {
          const self = this;
          Bun.serve({
            port: 3030,
            fetch(req, server) {
              if (server.upgrade(req)) {
                this.log('upgrade', req);
                return;
              }
              return new Response("failed upgrade", 500);
            },
            websocket: {
              message(socket, messageStr) {
                const message = JSON.parse(messageStr);
                console.log('message', message);
                const handler = self.handlers()[message.topic];
                if (handler) {
                  handler.handle({
                    master: self,
                    socket,
                    message
                  });
                } else {
                  self.log(`couldn't find handler for message ${messageStr}`);
                }
              },
              open(socket) {
                console.log('open');
              },
              close(socket, code, message) {
                console.log('close')
              },
              drain(socket) {
                console.log('drain');
              }
            }
          });
        }
      }),
      $base.Var.new({ name: 'nodes' }),
      $base.After.new({
        name: 'init',
        do() {
          this.nodes({});
          this.handlers({});
          const handlers = [
            $.HandshakeHandler.new(),
            $.RPCHandler.new()
          ];
          handlers.forEach(h => this.registerHandler(h));
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'MessageHandler',
    slots: [
      $base.Virtual.new({ name: 'topic' }),
      $base.Virtual.new({ name: 'handle' })
    ]
  });

  $base.Class.new({
    name: 'HandshakeHandler',
    slots: [
      $base.Constant.new({
        name: 'topic',
        value: 'handshake'
      }),
      $base.Method.new({
        name: 'handle',
        do({ master, message, socket }) {
          const { id } = message.data;
          master.nodes()[id] = $live.LiveNode.new({
            id,
            socket
          });
        }
      })
    ]
  });

  $base.Class.new({
    name: 'RPCHandler',
    slots: [
      $base.Constant.new({
        name: 'topic',
        value: 'rpc'
      }),
      $base.Method.new({
        name: 'handle',
        do({ master, message }) {
          const { id, method } = message.data;
          const node = master.nodes()[id];
          if (!node) {
            throw new Exception(`couldn't find node ${id}`);
          }
        }
      })
    ]
  });

  const server = $.WebsocketServer.new();
  server.serve();
}.module({
  name: 'leader',
  imports: [base, live],
}).load();
