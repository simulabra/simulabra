import { fetch } from 'node-fetch';
import { __, base } from '../src/base.js';
import test from '../src/test.js';
import http from '../src/http.js';

export default await function (_, $, $test, $http) {
  $test.AsyncCase.new({
    name: 'ServerCreation',
    async do() {
      const server = $http.HTTPServer.new({
        port: 3034,
        slots: [
          $http.PathRequestHandler.new({
            path: '/',
            handler(app, req, res) {
              this.log('handle http request');
              res.ok('<h1>hello world!!</h1>');
            },
          }),
        ]
      });
      const response = await fetch('http://localhost:3034');
      const text = await response.text();

      this.assertEq(response.status, 200);
      this.assertEq(text, '<h1>hello world!!</h1>');

      server.nodeServer().close();
    }
  });
}.module({
  name: 'test.http',
  imports: [test, http],
}).load();
