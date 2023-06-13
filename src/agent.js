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
          handler(req, res) {
            // TODO: apply transform here?
            console.log('handle', req.inner().url);
            res.ok(transform('./src/' + req.inner().url), 'application/javascript');
            // <a href="#">test</a>
          }
        }),
      ]
    });

  }
}).load();
