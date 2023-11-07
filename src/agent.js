import base from './base.js';
import http from './http.js';
import { readFileSync } from 'fs';

export default await base.find('class', 'module').new({
  name: 'agent',
  imports: [base, http],
  async on_load(_, $) {
    $.http_server.new({
      port: 3031,
      slots: [
        $.path_request_handler.new({
          path: '/',
          handler(req, res) {
            res.ok(readFileSync('./src/index.html').toString());
          }
        }),
        $.path_request_handler.new({
          path: '/completion',
          handler(req, res) {
            res.ok(readFileSync('./src/completion.html').toString());
          }
        }),
        $.filetype_request_handler.new({
          filetypes: ['js'],
          handler(req, res) {
            const path = req.inner().url;
            let fileName = '.' + path;
            res.ok(readFileSync(fileName).toString(), 'application/javascript');
          }
        }),
        $.filetype_request_handler.new({
          filetypes: ['css'],
          handler(req, res) {
            const path = req.inner().url;
            let fileName = '.' + path;
            res.ok(readFileSync(fileName).toString(), 'text/css');
          }
        })
      ]
    });
  }
}).load();
