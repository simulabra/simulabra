import base from './base.js';
import http from './http.js';
import transform from './transform';
import { readFileSync } from 'fs';

export default await base.find('class', 'module').new({
  name: 'agent',
  imports: [base, http],
  async on_load(_, $) {
    $.http_server.new({
      port: 3031,
      handlers: [
        $.path_request_handler.new({
          path: '/',
          handler(req, res) {
            res.ok(readFileSync('./src/bootstrap.html').toString());
          }
        }),
        $.filetype_request_handler.new({
          filetypes: ['js', 'jsx'],
          async handler(req, res) {
            const fileName = './src/' + req.inner().url;
            res.ok(transform(fileName), 'application/javascript');
          }
        }),
      ]
    });

  }
}).load();
