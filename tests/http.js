import fetch from 'node-fetch';
import base from '../base.js';
import test from '../test.js';
import http from '../http.js';
const __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'test_http',
  imports: [test, http],
  on_load(_, $) {
    $.async_case.new({
      name: 'server_creation',
      async do() {
        const server = $.http_server.new({
          port: 3030,
          handlers: [
            $.path_request_handler.new({
              path: '/',
              handler(req, res) {
                this.log('handle http request');
                res.ok('<h1>hello world!!</h1>');
              },
            }),
          ]
        });
        const response = await fetch('http://localhost:3030');
        const text = await response.text();

        this.assert_eq(response.status, 200);
        this.assert_eq(text, '<h1>hello world!!</h1>');

        server.node_server().close();
      }
    });
  }
}).load();