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
            res.ok(readFileSync('./src/bootstrap.html').toString());
          }
        }),
        $.filetype_request_handler.new({
          filetypes: ['js'],
          handler(req, res) {
            const path = req.inner().url;
            let fileName;

            // Regex to match if the filename ends with '.demo.js'
            if (/\.demo\.js$/.test(path)) {
              fileName = './demos' + path.replace(`.demo`, '');
            } else if (path.includes('/vendor/')) {
              fileName = '.' + path;
            } else {
              fileName = './src' + path;
            }
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