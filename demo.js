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
            const mod = await import('/module/demo');
            const Demo = mod.default;
            console.log(Demo)
            document.getElementById('app').innerHTML = Demo.Demo.new().render();
        </script>
        <div id="app">
        </div>
    </body>
    `,
});

export default _;

Web.WebServer.defaultRoute(Web.HTMLRequestHandler.new());
