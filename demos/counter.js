import htmlModule from '../src/html.js';   // loads the classes
import { __, base } from '../src/base.js';

export default await function (_, $) {
  $.Class.new({
    name: 'Counter',
    slots: [
      $.Signal.new({ name: 'count', default: 0 }),
      $.Method.new({ name: 'inc', do() { this.count(this.count() + 1); } }),
      $.Method.new({
        name: 'render',
        do() { 
          return $.HTML.t`
            <button id="clicky" onclick=${() => this.inc()}>
              clicked ${() => this.count()} times
            </button>
          `; 
        }
      })
    ]
  });

  $.Class.new({
    name: 'App',
    slots: [
      $.Method.new({
        name: 'render',
        do() { 
          return $.HTML.t`
            <div>Here is a counter!
            <$Counter /></div>
          `; 
        }
      })
    ]
  });

  $.App.new().render().mount(document.body);
}.module({ name: 'demo.counter', imports: [base, htmlModule] }).load();
