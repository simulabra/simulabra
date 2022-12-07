import * as Base from './base.js';
import * as Demo from './demo.js';

export const ErrorStack = Base.Class.new({
  name: 'ErrorStack',
  static: {
    fromCommon: Base.Method.new({
      do: function fromCommon(err) {
        // parse error stack
        // bun's line numbers are off and indicating it is skipping comments/whitespace?
        console.log(err.stack);
      }
    }),
    fromV8: Base.Method.new({
      do: function fromV8(err) {
        // parse v8 error stack
        console.log(err.stack);
      }
    })
  },
  slots: {

  }
});

export const WebSocketClient = Base.Class.new({
  name: 'WebSocketClient',
  slots: {
    ws: Base.Var.new(),
    init() {
      console.log('ws init')
      this.ws(new WebSocket("ws://localhost:3000/socket"));
      this.ws().onmessage = (e) => {
      };
      this.ws().onopen = () => {
        console.log('connecting...');
        this.ws().send(JSON.stringify({ message: 'init' }));
      }
    }
  }
})
