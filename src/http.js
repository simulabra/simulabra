import { __, base } from './base.js';
import { createServer } from 'http';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';

export default await function (_, $, $base) {
 $base.Class.new({
   name: 'HTTPRequest',
   slots: [
     $base.Var.new({
       name: 'inner'
     }),
     $base.Var.new({
       name: 'start'
     }),
     $base.Method.new({
       name: 'elapsed',
       do() {
         return +new Date() - +this.start();
       }
     }),
     $base.Method.new({
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
 $base.Class.new({
   name: 'HTTPResponse',
   slots: [
     $base.Var.new({
       name: 'inner'
     }),
     $base.Method.new({
       name: 'ok',
       do(message, ct = 'text/html') {
         this.inner().writeHead(200, { 'Content-type': ct });
         this.inner().end(message);
       }
     }),
   ]
 });
 $base.Class.new({
   name: 'HTTPServer',
   slots: [
     $base.Var.new({ name: 'nodeServer' }),
     $base.Var.new({
       name: 'port',
       default: '3030',
     }),
     $base.Var.new({
       name: 'slots',
       default: [],
     }),
     $base.After.new({
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
 $base.Class.new({
   name: 'RequestHandler',
   slots: [
     $base.Virtual.new({
       name: 'match'
     }),
     $base.Virtual.new({
       name: 'handle',
     }),
   ]
 });

 $base.Class.new({
   name: 'HandlerLogger',
   slots: [
     $base.After.new({
       name: 'handle',
       do(app, req, res) {
         this.log(`handle ${req.inner().url} in ${req.elapsed()} ms`);
       }
     })
   ]
 })
 $base.Class.new({
   name: 'VarHandler',
   slots: [
     $base.Var.new({
       name: 'handler',
     }),
     $base.Method.new({
       name: 'handle',
       do(...args) {
         this.handler().apply(this, args)
       }
     }),
   ]
 });
 $base.Class.new({
   name: 'PathRequestHandler',
   slots: [
     $.RequestHandler,
     $.VarHandler,
     $.HandlerLogger,
     $base.Var.new({
       name: 'path',
     }),
     $base.Method.new({
       name: 'match',
       do(url) {
         return this.path() === url;
       }
     }),
   ]
 });
 $base.Class.new({
   name: 'FiletypeRequestHandler',
   slots: [
     $.RequestHandler,
     $.HandlerLogger,
     $base.Var.new({ name: 'filetypes' }),
     $base.Var.new({ name: 'mimeType' }),
     $base.Method.new({
       name: 'match',
       do(url) {
         const filetype = /\.([^\.]+)$/.exec(url)[1];
         this.log(filetype, this.filetypes());
         return this.filetypes().includes(filetype);
       }
     }),
     $base.Method.new({
       name: 'handle',
       do: function handle(app, req, res) {
         const path = req.inner().url;
         let fileName = '.' + path;
         res.ok(readFileSync(fileName).toString(), this.mimeType());
       }
     }),
   ]
 });

 $base.Class.new({
   name: 'HTTPRequestCommand',
   slots: [
     $base.Command,
     $base.Var.new({ name: 'url' }),
     $base.Var.new({ name: 'Method' }),
     $base.Var.new({ name: 'responseType' }),
     $base.Var.new({ name: 'data' }),
     $base.Method.new({
       name: 'run',
       async: true,
       do: async function run() {
         const options = {
           method: this.Method(),
           headers: {
             'Content-Type': 'application/json'
           }
         };
         
         if (this.data()) {
           options.body = JSON.stringify(this.data());
         }
         
         const response = await fetch(this.url(), options);
         
         // Handle different response types
         if (this.responseType() === 'json') {
           return response.json();
         } else if (this.responseType() === 'text') {
           return response.text();
         } else if (this.responseType() === 'arrayBuffer') {
           return response.arrayBuffer();
         } else if (this.responseType() === 'blob') {
           return response.blob();
         } else {
           return response;
         }
       }
     }),
   ]
 });
}.module({
 name: 'HTTP',
 imports: [base],
}).load();
