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
          const data = message.data();
          const { method, args, from } = data;
          if (client.uid() !== message.to()) {
            throw new Error(`received message not meant for me ${client.uid()} ${JSON.stringify(message)}`);
          }
          const responseValue = await client[method](...args);
          client.send($.LiveMessage.new({
            topic: 'response',
            to: from,
            data: {
              mid: message.mid(),
              value: responseValue
            }
          }))
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
          const data = message.data();
          const { mid, value } = data;
          client._responseMap[mid].resolve(data.value);
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'ErrorHandler',
    slots: [
      $.MessageHandler,
      $base.Constant.new({
        name: 'topic',
        value: 'error'
      }),
      $base.Method.new({
        name: 'handle',
        do({ client, message }) {
          const data = message.data();
          const { mid, value } = data;
          client._responseMap[mid].reject(data.value);
        }
      }),
    ]
  });

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
          const handler = this.handlers()[message.topic()];
          if (handler) {
            handler.handle({
              client: this,
              socket,
              message
            });
          } else {
            this.tlog(`couldn't find handler for message ${message.topic()}`);
          }
        }
      })
    ]
  });

  $base.Class.new({
    name: 'LiveMessage',
    slots: [
      $base.Clone,
      $base.JSON,
      $base.Var.new({
        name: 'mid',
      }),
      $base.Var.new({
        name: 'sent'
      }),
      $base.Var.new({
        name: 'from'
      }),
      $base.Var.new({
        name: 'to'
      }),
      $base.Var.new({
        name: 'topic'
      }),
      $base.Var.new({
        name: 'data'
      }),
    ]
  })

  $base.Class.new({
    name: 'LiveNode',
    slots: [
      $base.Var.new({ name: 'uid' }),
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
        do(message) {
          if (!this.connected()) {
            throw new Error('tried to send data on unconnected socket');
          }
          if (message.from() === undefined) {
            message.from(this.uid());
          }
          if (message.mid() === undefined) {
            message.mid(crypto.randomUUID());
          }
          this.tlog('send', message);
          this.socket().send(JSON.stringify(message.json()));
          return message;
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'NodeClient',
    slots: [
      $.LiveNode,
      $.MessageDispatcher,
      $base.Var.new({
        name: 'responseMap',
      }),
      $base.Method.new({
        name: 'base',
        do() {
          return this.class().name;
        }
      }),
      $base.Method.new({
        name: 'checkResponse',
        do(id) {
          return this._responseMap[id];
        }
      }),
      $base.Method.new({
        name: 'waitForResponse',
        do(id, timeout=5) {
          if (this._responseMap[id] === undefined) {
            this._responseMap[id] = $.ReifiedPromise.new();
          }
          setTimeout(() => {
            this._responseMap[id].reject(`message ${id}: timed out after ${timeout} seconds`)
          }, timeout * 1000);
          return this._responseMap[id].promise();
        }
      }),
      $base.Method.new({
        name: 'connect',
        do() {
          return new Promise((resolve, reject) => {
            const host = (typeof process !== 'undefined' && process.env['SIMULABRA_HOST']) || 'localhost';
            const port = (typeof process !== 'undefined' && process.env['SIMULABRA_PORT']) || 3030;
            this.socket(new WebSocket(`ws://${host}:${port}`));
            this.responseMap({});
            this.registerHandler($.RPCHandler.new());
            this.registerHandler($.ResponseHandler.new());
            this.registerHandler($.ErrorHandler.new());
            this.socket().addEventListener("open", event => {
              this.connected(true);
              this.send($.LiveMessage.new({
                topic: 'handshake',
                to: 'master',
              }));
              resolve();
            });
            this.socket().addEventListener("message", event => {
              const message = $.LiveMessage.new(JSON.parse(event.data));
              this.handle(this.socket(), message);
            });
            this.socket().addEventListener("error", event => {
              if (!this.connected()) {
                reject(event);
              } else {
                this.tlog('error', event)
              }
            });
            this.socket().addEventListener("close", event => {
              this.connected(false);
              this.tlog('close');
            });
          })
        }
      }),
      $base.Method.new({
        name: 'register',
        doc: 'makes the object available to other clients at the address',
        do(handle, object) {
          this.send($.LiveMessage.new({
            topic: 'register',
            to: 'master',
            data: { handle }
          }));
        }
      }),
      $base.Method.new({
        name: 'serviceProxy',
        async do(c) {
          const handle = c.name;
          const self = this;
          return new Proxy({}, {
            get(target, p, receiver) {
              if (["then"].includes(p)) {
                return target[p];
              }
              return async function (...args) {
                const rpcMessage = self.send($.LiveMessage.new({
                  topic: 'rpc',
                  to: handle,
                  data: {
                    method: p,
                    from: self.uid(),
                    args
                  }
                }));
                self.tlog("waitForResponse", rpcMessage.mid())
                return await self.waitForResponse(rpcMessage.mid());
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
