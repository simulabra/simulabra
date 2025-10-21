import { __, base } from './base.js';

export default await function (_, $, $base) {
  $base.Class.new({
    name: 'MessageHandler',
    slots: [
      $base.Virtual.new({ name: 'topic' }),
      $base.Virtual.new({ name: 'handle' })
    ]
  });

  $base.Class.new({
    name: 'RpcMethod',
    slots: [
      $base.Method
    ]
  });

  $base.Class.new({
    name: 'RPCHandler',
    slots: [
      $.MessageHandler,
      $base.Constant.new({
        name: 'topic',
        value: 'rpc'
      }),
      $base.Method.new({
        name: 'handle',
        async do({ client, message }) {
          const { id, from, data } = message;
          const { to, method, args } = data;
          if (client.id() !== to) {
            throw new Error(`received message not meant for me ${client.id()} ${JSON.stringify(message)}`);
          }
          this.log('rpc', method, from);
          const responseValue = await client[method](...args);
          client.send('response', { to: from, value: responseValue });
        }
      })
    ]
  });

  $base.Class.new({
    name: 'ResponseHandler',
    slots: [
      $.MessageHandler,
      $base.Constant.new({
        name: 'topic',
        value: 'response'
      }),
      $base.Method.new({
        name: 'handle',
        do({ client, message }) {
          const { id, data } = message;
          if (client.checkResponse(id)) {
            client.checkResponse(id).resolve(data)
          }
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'MessageDispatcher',
    slots: [
      $base.Var.new({ name: 'handlers' }),
      $base.After.new({
        name: 'init',
        do() {
          this.handlers({});
        }
      }),
      $base.Method.new({
        name: 'registerHandler',
        do(handler) {
          this.handlers()[handler.topic()] = handler;
        }
      }),
      $base.Method.new({
        name: 'handle',
        do(socket, message) {
          const handler = this.handlers()[message.topic];
          if (handler) {
            handler.handle({
              client: this,
              socket,
              message
            });
          } else {
            this.log(`couldn't find handler for message ${messageStr}`);
          }
        }
      })
    ]
  })

  $base.Class.new({
    name: 'ReifiedPromise',
    slots: [
      $base.Var.new({ name: 'promise' }),
      $base.Var.new({ name: 'resolveFn' }),
      $base.Var.new({ name: 'rejectFn' }),
      $base.After.new({
        name: 'init',
        do() {
          return this.promise(new Promise((resolve, reject) => {
            this.resolveFn(resolve);
            this.rejectFn(reject);
          }));
        }
      }),
      $base.Method.new({
        name: 'resolve',
        do(value) {
          this.resolveFn()(value);
        }
      }),
      $base.Method.new({
        name: 'reject',
        do(value) {
          this.rejectFn()(value);
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'LiveNode',
    slots: [
      $base.Var.new({ name: 'id' }),
      $base.Var.new({ name: 'socket' }),
      $base.Var.new({
        name: 'connected',
        default: false
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
            from: this.id(),
            topic,
            data
          };
          this.socket().send(JSON.stringify(msg));
          return msg;
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'NodeClient',
    slots: [
      $.LiveNode,
      $.MessageDispatcher,
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
        name: 'responseMap',
      }),
      $base.Method.new({
        name: 'checkResponse',
        do(id) {
          return this.responseMap()[id];
        }
      }),
      $base.Method.new({
        name: 'waitForResponse',
        do(id, timeout=3) {
          if (this.checkResponse(id) === undefined) {
            this.responseMap()[id] = $.ReifiedPromise.new();
          }
          setTimeout(() => {
            this.checkResponse(id).reject(`message ${id}: timed out after ${timeout} seconds`)
          }, timeout * 1000);
          return this.checkResponse(id).promise();
        }
      }),
      $base.Method.new({
        name: 'connect',
        do() {
          return new Promise((resolve, reject) => {
            if (!this.id()) {
              throw new Error('cannot connect without id set!');
            }
            const host = process.env['SIMULABRA_HOST'] || 'localhost';
            const port = process.env['SIMULABRA_PORT'] || 3030;
            this.socket(new WebSocket(`ws://${host}:${port}`));
            this.responseMap({});
            this.registerHandler($.RPCHandler.new());
            this.socket().addEventListener("open", event => {
              this.connected(true);
              this.send('handshake', { id: this.id() })
              resolve();
            });
            this.socket().addEventListener("message", event => {
              const message = JSON.parse(event.data);
              this.handle(this.socket(), message);
            });
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
          const self = this;
          return new Proxy({}, {
            get(target, p, receiver) {
              if (["then"].includes(p)) {
                return target[p];
              }
              return async function (...args) {
                const rpcMessage = self.send('rpc', {
                  method: p,
                  from: self.id(),
                  to: handle,
                  args
                });
                return await self.waitForResponse(rpcMessage.id);
              };
            }
          });
        }
      })
    ]
  });
}.module({
  name: 'live',
  imports: [base],
}).load();
