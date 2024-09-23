import base from './base.js';
import { createServer } from 'http';
import axios from 'axios';
import { readFileSync } from 'fs';

export default await base.find('Class', 'Module').new({
  name: 'HTTP',
  imports: [base],
  on_load(_, $) {
    $.Class.new({
      name: 'HTTPRequest',
      slots: [
        $.Var.new({
          name: 'inner'
        }),
        $.Var.new({
          name: 'start'
        }),
        $.Method.new({
          name: 'elapsed',
          do() {
            return +new Date() - +this.start();
          }
        }),
        $.Method.new({
          name: 'drain',
          do: function drain() {
            const req = this.inner();
            return new Promise((resolve, reject) => {
              if (req.Method !== 'POST' || req.headers['content-type'] !== 'application/json') {
                return reject('malformed request');
              }
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const parsed = JSON.parse(body);
                  return resolve(parsed);
                } catch (e) {
                  return reject(e);
                }
              });
            });
          },
        }),
      ]
    });
    $.Class.new({
      name: 'HTTPResponse',
      slots: [
        $.Var.new({
          name: 'inner'
        }),
        $.Method.new({
          name: 'ok',
          do(message, ct = 'text/html') {
            this.inner().writeHead(200, { 'Content-type': ct });
            this.inner().end(message);
          }
        }),
      ]
    });
    $.Class.new({
      name: 'HTTPServer',
      slots: [
        $.Var.new({ name: 'nodeServer' }),
        $.Var.new({
          name: 'port',
          default: '3030',
        }),
        $.Var.new({
          name: 'slots',
          default: [],
        }),
        $.after.new({
          name: 'init',
          do() {
            this.nodeServer(createServer((req, res) => {
              for (const handler of this.slots()) {
                if (handler.match(req.url)) {
                  return handler.handle(this, $.HTTPRequest.new({ inner: req, start: new Date() }), $.HTTPResponse.new({ inner: res }));
                }
              }
              res.writeHead(404);
              res.end();
            }));
            this.nodeServer().listen(this.port());
          }
        }),
      ]
    });
    $.Class.new({
      name: 'RequestHandler',
      slots: [
        $.virtual.new({
          name: 'match'
        }),
        $.virtual.new({
          name: 'handle',
        }),
      ]
    });

    $.Class.new({
      name: 'HandlerLogger',
      slots: [
        $.after.new({
          name: 'handle',
          do(app, req, res) {
            this.log(`handle ${req.inner().url} in ${req.elapsed()} ms`);
          }
        })
      ]
    })
    $.Class.new({
      name: 'VarHandler',
      slots: [
        $.Var.new({
          name: 'handler',
        }),
        $.Method.new({
          name: 'handle',
          do(...args) {
            this.handler().apply(this, args)
          }
        }),
      ]
    });
    $.Class.new({
      name: 'PathRequestHandler',
      slots: [
        $.RequestHandler,
        $.VarHandler,
        $.HandlerLogger,
        $.Var.new({
          name: 'path',
        }),
        $.Method.new({
          name: 'match',
          do(url) {
            return this.path() === url;
          }
        }),
      ]
    });
    $.Class.new({
      name: 'FiletypeRequestHandler',
      slots: [
        $.RequestHandler,
        $.HandlerLogger,
        $.Var.new({ name: 'filetypes' }),
        $.Var.new({ name: 'mimeType' }),
        $.Method.new({
          name: 'match',
          do(url) {
            const filetype = /\.([^\.]+)$/.exec(url)[1];
            this.log(filetype, this.filetypes());
            return this.filetypes().includes(filetype);
          }
        }),
        $.Method.new({
          name: 'handle',
          do: function handle(app, req, res) {
            const path = req.inner().url;
            let fileName = '.' + path;
            res.ok(readFileSync(fileName).toString(), this.mimeType());
          }
        }),
      ]
    });

    $.Class.new({
      name: 'HTTPRequestCommand',
      slots: [
        $.command,
        $.Var.new({ name: 'url' }),
        $.Var.new({ name: 'Method' }),
        $.Var.new({ name: 'responseType' }),
        $.Var.new({ name: 'data' }),
        $.Method.new({
          name: 'run',
          async: true,
          do: function run() {
            return axios({
              url: this.url(),
              Method: this.Method(),
              data: this.data(),
              responseType: this.responseType(),
            });
          }
        }),
      ]
    });
  },
}).load();
