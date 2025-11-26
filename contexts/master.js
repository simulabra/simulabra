import { __, base } from '../src/base.js';
import live from '../src/live.js';

export default await async function (_, $, $$, $live) {
  $$.Class.new({
    name: 'WebsocketServer',
    slots: [
      $$.Var.new({ name: 'nodes' }),
      $$.Var.new({ name: 'handlers' }),
      $$.Method.new({
        name: 'registerHandler',
        do(handler) {
          this.handlers()[handler.topic()] = handler;
        }
      }),
      $$.Method.new({
        name: 'node',
        do(name) {
          return this.nodes()[name];
        }
      }),
      $$.Method.new({
        name: 'to',
        do(message) {
          return this.node(message._to);
        }
      }),
      $$.Method.new({
        name: 'from',
        do(message) {
          return this.node(message._from);
        }
      }),
      $$.Method.new({
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
      $$.Method.new({
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
      $$.After.new({
        name: 'init',
        do() {
          this.nodes({});
          this.handlers({});
          const handlers = [
            $.HandshakeHandler.new(),
          ];
          handlers.forEach(h => this.registerHandler(h));
        }
      }),
    ]
  });

  $$.Class.new({
    name: 'HandshakeHandler',
    slots: [
      $live.MessageHandler,
      $$.Constant.new({
        name: 'topic',
        value: 'handshake'
      }),
      $$.Method.new({
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

  const server = $.WebsocketServer.new();
  server.serve();
}.module({
  name: 'leader',
  imports: [base, live],
}).load();
