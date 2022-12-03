import { readFileSync } from 'fs';
import * as Base from './base';
import * as HTML from './html';

export const $Page = Base.Interface.new({
  name: '$Page',
  protocol: [
    Base.Method.new({
      name: 'render',
      ret: HTML.$HTML,
    }),
    Base.Method.new({
      name: 'route',
      ret: Base.String,
    })
  ],
});

export const SURL = Base.Class.new({
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
    url: Base.Var.new(),
    parts: Base.Var.new(),
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
export const SocketRequestHandler = Base.Class.new({
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

export const Request = Base.Class.new({
  name: 'Request',
  slots: {
    url: Base.Var.new(),
    native: Base.Var.new(),
    init() {
      this.url(SURL.parse(this.native().url));
    },
  },
});

export const HTMLRequestHandler = Base.Class.new({
  name: 'HTMLRequestHandler',
  slots: {
    html: Base.Var.default('<h1>hello world!</h1'),
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

export const PageHandler = Base.Class.new({
  name: 'HTMLRequestHandler',
  slots: {
    page: Base.Var.new({
      type: $Page,
    }),
    html: Base.Method.new({
      do: function html() {
        return this.page().render();
      },
    }),
  },
});

export const ModuleRequestHandler = Base.Class.new({
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
})
export const WebServer = Base.Class.new({
  name: 'WebServer',
  static: {
    defaultRoute: Base.Method.do(function defaultRoute(route) {
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
    pages: Base.Var.new({
      // type: Base.$List.of(_$Page)
    }),
    sessions: Base.Var.default({}),
    handlers: Base.Var.default({}),
    serve() {
      const self = this;
      return Bun.serve({
        websocket: {
          message: (ws, msg) => {
            // route message to
            ws.count ||= 0;
            ws.count++;
            // console.log(ws, msg);
          },
        },
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
