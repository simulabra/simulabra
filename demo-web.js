import Base from './base';
import Web from './web';

const _Demo = Base.Class.new({
  _name: Base.$$`Demo`,
  _slots: {
    render() {
      return '<h1>hello from simulabra !</h1>';
    }
  }
});

const _ = Base.Module.new({
  _exports: [
    _Demo,
  ],
});

const _DemoHandler = Web.HTMLRequestHandler.new({
  _html: `
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
            const Base = (await import('/module/base')).default;
            const HTML = (await import('/module/html')).default;
            const Demo = (await import('/module/demo')).default;
            const App = Base.Class.new({
                _super: Demo.Demo,
                _slots: {
                    render() {
                        document.getElementById('app').innerHTML = this.html();
                        this.load();
                    },
                    init() {
                        this.render();
                    },
                },
            });

            App.new();
        </script>
        <div id="app">
        </div>
    </body>
    `,
});

export default _;

Web.WebServer.defaultRoute(_DemoHandler);
