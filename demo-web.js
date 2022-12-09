import { Class } from './base.js';
import { $Page, HTMLRequestHandler, WebServer } from './web.js';

const DemoPage = Class.new({
    name: 'DemoPage',
    implements: [$Page],
    slots: {
        render() {
            return
        }
    }
})

export const DemoHandler = HTMLRequestHandler.new({
  html: `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>WebSockets</title>
    </head>
    <body>
        <script type="module">
import { WebSocketClient } from './module/boot.js';
import { TodoApplication } from './module/todos.js';
console.log('hello????')
const wsClient = WebSocketClient.new();
const demo = TodoApplication.create();
demo.render();
</script>

        <div id="app">
        </div>
    </body>
    `,
});



export const Server = WebServer.defaultRoute(DemoHandler);

process.on('SIGINT', () => {

})
