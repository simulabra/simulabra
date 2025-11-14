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
        name: 'node',
        do(name) {
          return this.nodes()[name];
        }
      }),
      $base.Method.new({
        name: 'to',
        do(message) {
          return this.node(message._to);
        }
      }),
      $base.Method.new({
        name: 'from',
        do(message) {
          return this.node(message._from);
        }
      }),
      $base.Method.new({
        name: 'routeMessage',
        do(message, socket) {
          const node = this.to(message);
          if (!node) {
            this.tlog('node not found', message._to);
            this.from(message).send($live.LiveMessage.new({
              topic: 'error',
              to: message.from(),
              from: 'master',
              data: {
                mid: message.mid(),
                value: `unknown node ${message._to}`
              }
            }));
          } else {
            node.send(message, message.from());
          }
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
                return;
              }
              return new Response("failed upgrade", 500);
            },
            websocket: {
              message(socket, messageStr) {
                const message = $live.LiveMessage.new(JSON.parse(messageStr));
                self.tlog('message', message);
                if (message.to() !== 'master') {
                  return self.routeMessage(message, socket);
                }
                const handler = self.handlers()[message.topic()];
                if (handler) {
                  handler.handle({
                    master: self,
                    socket,
                    message
                  });
                } else {
                  self.tlog(`couldn't find handler for message ${messageStr}`);
                }
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
            socket,
          });
          node.uid(from);
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
          const { id, to, from, data } = message;
          data.id = id;
          data.from = from;
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
