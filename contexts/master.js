import { __, base } from '../src/base.js';
import live from '../src/live.js';

export default await async function (_, $, $base, $live) {
  $base.Class.new({
    name: 'WebsocketServer',
    slots: [
      $base.Method.new({
        name: 'serve',
        do() {
          Bun.serve({
            fetch(req, server) {
              if (server.upgrade(req)) return;
              return new Response("failed upgrade", 500);
            },
            websocket: {
              message(socket, message) {},
              open(socket) {},
              close(socket, code, message) {},
              drain(socket) {}
            }
          });
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
