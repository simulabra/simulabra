//~
//~
import Base from './base.js';
import Web from './web.js';

const DemoPage = Base.Class.new({
    _name: 'DemoPage',
    _implements: [Web.$Page],
    _slots: {
        render() {
            return
        }
    }
})


const _DemoHandler = Web.HTMLRequestHandler.new({
  _html: `
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
