import { readFileSync } from 'fs';
import Base from './base';
import HTML from './html';

const _$Page = Base.Interface.new({
  _name: '$Page',
  _protocol: [
    Base.Method.new({
      _name: 'render',
      _ret: HTML.$HTML,
    }),
    Base.Method.new({
      _name: 'route',
      _ret: Base.String,
    })
  ],
});

const _URL = Base.Class.new({
  _name: 'URL',
  parse(urlString) {
    let _url = new URL(urlString);
    let _parts = _url.pathname.match(/\/[^\/]*/g);
    return _URL.new({
      _url,
      _parts,
    });
  },
  _slots: {
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
  _name: 'RequestHandler',
  _slots: {
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
  _name: 'Request',
  _slots: {
    url: Base.Var.new(),
    native: Base.Var.new(),
    init() {
      this.url(_URL.parse(this.native().url));
    },
  },
});

const _HTMLRequestHandler = Base.Class.new({
  _name: 'HTMLRequestHandler',
  _slots: {
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

const _ModuleRequestHandler = Base.Class.new({
  _name: 'ModuleRequestHandler',
  _slots: {
    handle(req, server) {
      let _file = req.url().parts()[1].slice(1);
      return new Response(readFileSync(_file + '.js'), {
        headers: {
          'Content-Type': 'text/javascript',
        },
      });
    }
  }
})
const _WebServer = Base.Class.new({
  _name: 'WebServer',
  defaultRoute(route) {
    const ws = _WebServer.new({
      _handlers: {
        '/': route,
        '/socket': _SocketRequestHandler.new(),
        '/module': _ModuleRequestHandler.new(),
      }
    });
    ws.serve();
  },
  _slots: {
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
  _exports: [
    _WebServer,
    _HTMLRequestHandler,
    _Request,
    _URL,
    _$Page,
  ]
});

export default _;
