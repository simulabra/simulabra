import base from './base.js';
import http from './http.js';
import { readFileSync } from 'fs';

export default await base.find('class', 'module').new({
  name: 'agent',
  imports: [base, http],
  async on_load(_, $) {
    $.class.new({
      name: 'agent_server',
      slots: [
        $.http_server,
        $.method.new({
          name: 'templatize',
          do: function templatize(moduleName) {
            return readFileSync('./src/module_template.html').toString().replaceAll('%%MODULE%%', moduleName);
          }
        }),
      ]
    });

    $.agent_server.new({
      port: 3031,
      slots: [
        $.path_request_handler.new({
          path: '/',
          handler(app, req, res) {
            res.ok(readFileSync('./src/index.html').toString());
          }
        }),
        $.path_request_handler.new({
          path: '/completion',
          handler(app, req, res) {
            res.ok(app.templatize('completion'));
          }
        }),
        $.path_request_handler.new({
          path: '/agenda',
          handler(app, req, res) {
            res.ok(app.templatize('agenda'));
          }
        }),
        $.path_request_handler.new({
          path: '/bootstrap',
          handler(app, req, res) {
            res.ok(app.templatize('bootstrap'));
          }
        }),
        $.filetype_request_handler.new({
          filetypes: ['js'],
          mime_type: 'application/javascript',
        }),
        $.filetype_request_handler.new({
          filetypes: ['css'],
          mime_type: 'text/css',
        })
      ]
    });
  }
}).load();
