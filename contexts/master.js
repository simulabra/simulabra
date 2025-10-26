import { __, base } from '../src/base.js';
import live from '../src/live.js';

export default await async function (_, $, $base, $live) {
  $base.Class.new({
    name: 'WebsocketServer',
    slots: [
      $base.Var.new({ name: 'nodes' }),
      $base.Var.new({ name: 'handlers' }),
      $base.Method.new({
        name: 'registerHandler',
        do(handler) {
          this.handlers()[handler.topic()] = handler;
        }
      }),
      $base.Method.new({
        name: 'routeMessage',
        do(message) {
          const to = message.to();
          const node = this.nodes()[to];
          if (!node) {
            throw new Error(`couldn't find node ${to}`);
          }
          node.send(message);
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
                const message = $live.LiveMessage.new(JSON.parse(messageStr));
                self.log('message', message);
                if (message.to() !== 'master') {
                  return self.routeMessage(message);
                }
                const handler = self.handlers()[message.topic()];
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
      $base.After.new({
        name: 'init',
        do() {
          this.nodes({});
          this.handlers({});
          const handlers = [
            $.HandshakeHandler.new(),
            $.RPCHandler.new(),
            $.ResponseHandler.new()
          ];
          handlers.forEach(h => this.registerHandler(h));
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'HandshakeHandler',
    slots: [
      $live.MessageHandler,
      $base.Constant.new({
        name: 'topic',
        value: 'handshake'
      }),
      $base.Method.new({
        name: 'handle',
        do({ master, message, socket }) {
          const from = message.from();
          const node = $live.NodeClient.new({
            socket
          });
          node.id(from);
          node.connected(true);
          master.nodes()[from] = node;
        }
      })
    ]
  });

  $base.Class.new({
    name: 'RPCHandler',
    slots: [
      $live.MessageHandler,
      $base.Constant.new({
        name: 'topic',
        value: 'rpc'
      }),
      $base.Method.new({
        name: 'handle',
        do({ master, message }) {
          console.log(message);
          const { id, to, from, data } = message;
          data.id = id;
          const node = master.nodes()[to];
          if (!node) {
            throw new Error(`couldn't find node ${to}`);
          }
          node.send($live.LiveMessage.new({
            topic: 'rpc',
            to,
            data
          }))
        }
      })
    ]
  });

  $base.Class.new({
    name: 'ResponseHandler',
    slots: [
      $live.MessageHandler,
      $base.Constant.new({
        name: 'topic',
        value: 'response'
      }),
      $base.Method.new({
        name: 'handle',
        do({ master, message }) {
          const { id, to, from, data } = message;
          const node = master.nodes()[to];
          if (!node) {
            throw new Error(`couldn't find node ${to}`);
          }
          node.send($live.LiveMessage.new({
            topic: 'response',
            to,
            data
          }))
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
