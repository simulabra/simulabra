import * as Base from './base.js';
import * as Web from './web.js';

const DemoPage = Base.Class.new({
    name: 'DemoPage',
    implements: [Web.$Page],
    slots: {
        render() {
            return
        }
    }
})

export const DemoHandler = Web.HTMLRequestHandler.new({
  html: `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>WebSockets</title>
    </head>
    <body>
        <script type="module">
import { Application } from './module/demo.js';
console.log('hello????')
const demo = Application.new();
demo.counter().inc();
demo.render();
</script>

        <div id="app">
        </div>
    </body>
    `,
});

Web.WebServer.defaultRoute(DemoHandler);
