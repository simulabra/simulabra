import { __, base } from './base.js';

export default await function (_, $, $base) {
  $base.Class.new({
    name: 'WebsocketClient',
    slots: [
      $base.Var.new({
        name: 'socket',
      }),
      $base.Var.new({
        name: 'localname'
      }),
      $base.Method.new({
        name: 'open',
        do(event) {
          this.log('socket open', event);
        }
      }),
      $base.Method.new({
        name: 'message',
        do(event) {
          this.log('socket message', event);
        }
      }),
      $base.Method.new({
        name: 'error',
        do(event) {
          this.log('socket error', event);
        }
      }),
      $base.Method.new({
        name: 'close',
        do(event) {
          this.log('socket close', event);
        }
      }),
      $base.Var.new({
        name: 'messageIdCounter',
        default: 1
      }),
      $base.Method.new({
        name: 'genMessageId',
        do() {
          const id = this.messageIdCounter();
          this.messageIdCounter(id + 1);
          return id;
        }
      }),
      $base.Method.new({
        name: 'send',
        do(topic, message) {
          const sendData = {
            id: this.genMessageId(),
            sent: new Date().toISOString(),
            from: this.localname(),
            topic,
            message
          };
          this.socket().send(JSON.stringify(sendData));
          return sendData;
        }
      }),
      $base.Method.new({
        name: 'connect',
        do() {
          const host = process.env['SIMULABRA_HOST'] || 'localhost';
          this.socket(new WebSocket(`ws://${host}`));
          this.socket().addEventListener("open", event => this.open(event));
          this.socket().addEventListener("message", event => this.message(event));
          this.socket().addEventListener("error", event => this.error(event));
          this.socket().addEventListener("close", event => this.close(event));
          this.send('handshake', { localname: this.localname() })
        }
      }),
      $base.Method.new({
        name: 'register',
        doc: 'makes the object available to other clients at the address',
        do(handle, object) {
          this.send('register', {
            handle,
          })
        }
      }),
    ]
  })
}.module({
  name: 'live',
  imports: [base],
}).load();
