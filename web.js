import { readFileSync } from 'fs';
import Base from './base';
import HTML from './html';

const _$Page = Base.Interface.new({
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

const _URL = Base.Class.new({
  name: 'URL',
  parse(urlString) {
    let url = new URL(urlString);
    let parts = _url.pathname.match(/\/[^\/]*/g);
    return _URL.new({
      url,
      parts,
    });
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
const _SocketRequestHandler = Base.Class.new({
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

const _Request = Base.Class.new({
  name: 'Request',
  slots: {
    url: Base.Var.new(),
    native: Base.Var.new(),
    init() {
      this.url(_URL.parse(this.native().url));
    },
  },
});

const _HTMLRequestHandler = Base.Class.new({
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

const _PageHandler = Base.Class.new({
  name: 'HTMLRequestHandler',
  slots: {
    page: Base.Var.new({
      type: _$Page,
    }),
    html: Base.Method.new({
      do: function html() {
        return this.page().render();
      },
    }),
  },
});

const _ModuleRequestHandler = Base.Class.new({
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
const _WebServer = Base.Class.new({
  name: 'WebServer',
  static: {
    defaultRoute: Base.Method.do(function defaultRoute(route) {
      const ws = _WebServer.new({
        handlers: {
          '/': route,
          '/socket': _SocketRequestHandler.new(),
          '/module': _ModuleRequestHandler.new(),
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
          const _req = _Request.new({ _native: req });
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

const _ = Base.Module.new({
  exports: [
    _WebServer,
    _HTMLRequestHandler,
    _Request,
    _URL,
    _$Page,
  ]
});

export default _;
