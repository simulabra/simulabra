import { readFileSync } from 'fs';
import { Class, Var, Method, Interface } from './base.js';
import { $HTML } from './html.js';

export const $Page = Interface.new({
  name: '$Page',
  protocol: [
    Method.new({
      name: 'render',
      ret: $HTML,
    }),
    Method.new({
      name: 'route',
      ret: String,
    })
  ],
});

export const SURL = Class.new({
  name: 'URL',
  static: {
    parse(urlString) {
      let url = new URL(urlString);
      let parts = url.pathname.match(/\/[^\/]*/g);
      return SURL.new({
        url,
        parts,
      });
    },
  },
  slots: {
    url: Var.new(),
    parts: Var.new(),
    host() {
      return this._url.host;
    },
    path() {
      return this.url().pathname;
    },
    pathEq(path) {
      return this.path() === path;
    },
    pathStart(path) {
      return this.path().indexOf(path) === 0;
    },
  },
});
export const SocketRequestHandler = Class.new({
  name: 'RequestHandler',
  slots: {
    handle(req, server) {
      if (server.upgrade(req.native())) {
        return new Response("", {
          status: 101,
        });
      } else {
        return new Response('upgrade failed?', {
          status: 400,
        });
      }
    },
  },
});

export const Request = Class.new({
  name: 'Request',
  slots: {
    url: Var.new(),
    native: Var.new(),
    init() {
      this.url(SURL.parse(this.native().url));
    },
  },
});

export const HTMLRequestHandler = Class.new({
  name: 'HTMLRequestHandler',
  slots: {
    html: Var.default('<h1>hello world!</h1'),
    handle(req, server) {
      return new Response(this.html(),
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      );
    }
  },
});

export const PageHandler = Class.new({
  name: 'HTMLRequestHandler',
  slots: {
    page: Var.new({
      type: $Page,
    }),
    html: Method.new({
      do: function html() {
        return this.page().render();
      },
    }),
  },
});

export const ModuleRequestHandler = Class.new({
  name: 'ModuleRequestHandler',
  slots: {
    handle(req, server) {
      let file = req.url().parts()[1].slice(1);
      // yikes, scoob!
      return new Response(readFileSync(file), {
        headers: {
          'Content-Type': 'text/javascript',
        },
      });
    }
  }
});

export const WebSocketServer = Class.new({
  name: 'WebSocketServer',
  slots: {
    connections: Var.new(),
    bunConfig: Method.new({
      do: function bunConfig() {
        return {
          message: (ws, msg) => {
            console.log('ws message')
            this.handle(ws, msg);
          }
        }
      }
    }),
    handle: Method.new({
      do: function handle(ws, msg) {
        console.log(msg);
      }
    }),
  }
})

export const WebServer = Class.new({
  name: 'WebServer',
  static: {
    defaultRoute: Method.do(function defaultRoute(route) {
      const ws = WebServer.new({
        handlers: {
          '/': route,
          '/socket': SocketRequestHandler.new(),
          '/module': ModuleRequestHandler.new(),
        }
      });
      ws.serve();
    }),
  },
  slots: {
    pages: Var.new({
      // type: $List.of(_$Page)
    }),
    sessions: Var.default({}),
    handlers: Var.default({}),
    sockets: Var.default(() => WebSocketServer.new()),
    serve() {
      const self = this;
      return Bun.serve({
        websocket: this.sockets().bunConfig(),
        fetch(req, server) {
          const _req = Request.new({ native: req });
          const basePath = _req.url().parts()[0];
          if (basePath in self.handlers()) {
            console.log('handle ' + basePath);
            return self.handlers()[basePath].handle(_req, server);
          } else {
            return new Response('404!', {
              status: 404,
            });
          }
        }
      });
    },
  },
});
