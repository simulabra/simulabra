//~
//~
import Base from './base.js';
import Web from './web.js';

const DemoPage = Base.Class.new({
    name: 'DemoPage',
    implements: [Web.$Page],
    slots: {
        render() {
            return
        }
    }
})


const _DemoHandler = Web.HTMLRequestHandler.new({
  html: `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>WebSockets</title>
    </head>
    <body>
        <script type="module" src="module/boot.js"></script>
        <script type="module">
console.log('hello????')
demo.counter().inc();
demo.render();
</script>

        <div id="app">
        </div>
    </body>
    `,
});

Web.WebServer.defaultRoute(_DemoHandler);
