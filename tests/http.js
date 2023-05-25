import base from '../base.js';
import test from '../test.js';
import http from '../http.js';
import fetch from 'node-fetch';
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
            $.request_handler.new({
              path: '/',
              handler(req, res) {
                this.log('handle http request');
                res.writeHead(200, { 'Content-type': 'text/html' });
                res.end('<h1>hello world!!</h1>');
              },
            }),
          ]
        });

        // Assert that the server is listening
        this.assert_eq(server.node_server().listening, true);

        // Fetch the route and assert the response
        const response = await fetch('http://localhost:3030');

        const text = await response.text();

        // Assert that the response status is 200
        this.assert_eq(response.status, 200);

        // Assert that the response body is as expected
        this.assert_eq(text, '<h1>hello world!!</h1>');

        // server.node_server().close();
      }
    });
  }
}).load();
