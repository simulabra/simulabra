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
            const Demo = (await import('/module/demo')).default;
            const HTML = (await import('/module/html')).default;
const counter = Demo.Counter.new();

const button = HTML.Button.new({
    _inner: 'Add',
    _id: 'add-button',
});
            function draw() {
                document.getElementById('app').innerHTML = counter.html() + button.html();
            }
draw();
document.getElementById('add-button').addEventListener('click', () => {
console.log('click');
        counter.inc();
        draw();
});
        </script>
        <div id="app">
        </div>
    </body>
    `,
});

export default _;

Web.WebServer.defaultRoute(_DemoHandler);
