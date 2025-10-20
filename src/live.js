import { __, base } from './base.js';

export default await function (_, $, $base) {
  $base.Class.new({
    name: 'NodeClient',
    slots: [
      $base.Var.new({
        name: 'socket',
      }),
      $base.Var.new({
        name: 'localname'
      }),
      $base.Var.new({
        name: 'connected',
        default: false
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
        do(topic, data) {
          if (!this.connected()) {
            throw new Error('tried to send data on unconnected socket');
          }
          const msg = {
            id: this.genMessageId(),
            sent: new Date().toISOString(),
            from: this.localname(),
            topic,
            data
          };
          this.socket().send(JSON.stringify(msg));
          return msg;
        }
      }),
      $base.Method.new({
        name: 'connect',
        do() {
          return new Promise((resolve, reject) => {
            if (!this.localname()) {
              throw new Error('cannot connect without localname set!');
            }
            const host = process.env['SIMULABRA_HOST'] || 'localhost';
            const port = process.env['SIMULABRA_PORT'] || 3030;
            this.socket(new WebSocket(`ws://${host}:${port}`));
            this.socket().addEventListener("open", event => {
              this.connected(true);
              this.send('handshake', { nodeId: this.localname() })
              resolve();
            });
            this.socket().addEventListener("message", event => this.message(event));
            this.socket().addEventListener("error", event => {
              if (!this.connected()) {
                reject(event);
              } else {
                this.error(event)
              }
            });
            this.socket().addEventListener("close", event => {
              this.connected(false);
            });
          })
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
      $base.Method.new({
        name: 'serviceProxy',
        async do(handle) {

        }
      })
    ]
  });

  $base.Class.new({
    name: 'LiveNode',
    slots: [
      $base.Var.new({ name: 'id' }),
      $base.Var.new({ name: 'socket' }),
    ]
  });
}.module({
  name: 'live',
  imports: [base],
}).load();
