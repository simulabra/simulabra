import Web from './web.js';

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
            const Demo = (await import('/module/demo.js')).default;

            Demo.Demo.new();
        </script>
        <div id="app">
        </div>
    </body>
    `,
});

Web.WebServer.defaultRoute(_DemoHandler);
