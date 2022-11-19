import { readFileSync } from 'fs';
import Base from './base';

const _$HTML = Base.Interface.new({
  _inherits: [
    Base.$ToString,
  ],
  _protocol: [
    Base.Method.new({
      _name: Base.$$`tag`
    })
  ]
})
const _$Page = Base.Interface.new({
  _protocol: [
    Base.Method.new({
      _name: Base.$$`render`,
      _ret: _$HTML,
    }),
    Base.Method.new({
      _name: Base.$$`route`,
      _ret: Base.String,
    })
  ],
});

const _URL = Base.Class.new({
  _name: Base.$$`URL`,
  parse(urlString) {
    let _url = new URL(urlString);
    let _parts = _url.pathname.match(/\/[^\/]*/g);
    return _URL.new({
      _url,
      _parts,
    });
  },
  _slots: {
    _url: null,
    parts: Base.Var.new(),
    host() {
      return this._url.host;
    },
    path() {
      return this._url.pathname;
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
  _name: Base.$$`RequestHandler`,
  _slots: {
    handle(req, server) {
      if (server.upgrade(req.native())) {
        return new Response("", {
          status: 101,
        });
      } else {
        throw new Error('upgrade failed?');
      }
    },
  },
});

const _Request = Base.Class.new({
  _name: Base.$$`Request`,
  _slots: {
    url: Base.Var.new(),
    native: Base.Var.new(),
    init() {
      this.url(_URL.parse(this.native().url));
    },
  },
})

const _HTMLRequestHandler = Base.Class.new({
  _name: Base.$$`HTMLRequestHandler`,
  _slots: {
    handle(req, server) {
      return new Response(
        `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>WebSockets</title>
    </head>
    <body>
        <script type="module">
            const ws = new WebSocket("ws://localhost:3000/socket");
            ws.onmessage = (e) => {
            };
            ws.onconnect = () => {
              ws.send(JSON.stringify({ message: 'init' }));
            }
            const mod = await import('/module/demo');
            const Demo = mod.default;
            console.log(Demo)
            document.getElementById('app').innerHTML = Demo.Demo.new().render();
        </script>
        <div id="app">
        </div>
    </body>

    `,
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
  _name: Base.$$`ModuleRequestHandler`,
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
  _name: Base.$$`WebServer`,
  _slots: {
    pages: Base.Var.new({
      // type: Base.$List.of(_$Page)
    }),
    sessions: Base.Var.default({}),
    handlers: Base.Var.default({}),
    serve() {
      Bun.serve({
        websocket: {
          message: (ws, msg) => {
            // route message to
            ws.count ||= 0;
            ws.count++;
            // console.log(ws, msg);
          },
        },
        fetch: (req, server) => {
          const _req = _Request.new({ _native: req });
          const basePath = _req.url().parts()[0];
          if (basePath in this.handlers()) {
            console.log('handle ' + basePath);
            return this.handlers()[basePath].handle(_req);
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

const ws = _WebServer.new({
  _handlers: {
    '/': _HTMLRequestHandler.new(),
    '/socket': _SocketRequestHandler.new(),
    '/module': _ModuleRequestHandler.new(),
  }
});
ws.serve();
