import { fetch } from 'node-fetch';
import base from '../src/base.js';
import test from '../src/test.js';
import http from '../src/http.js';
const __ = globalThis.SIMULABRA;

export default await __.$().Module.new({
  name: 'TestHTTP',
  imports: [test, http],
  on_load(_, $) {
    $.AsyncCase.new({
      name: 'ServerCreation',
      async do() {
        const server = $.HTTPServer.new({
          port: 3030,
          slots: [
            $.PathRequestHandler.new({
              path: '/',
              handler(app, req, res) {
                this.log('handle http request');
                res.ok('<h1>hello world!!</h1>');
              },
            }),
          ]
        });
        const response = await fetch('http://localhost:3030');
        const text = await response.text();

        this.assertEq(response.status, 200);
        this.assertEq(text, '<h1>hello world!!</h1>');

        server.nodeServer().close();
      }
    });
  }
}).load();
