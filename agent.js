
import base from './base.js';
import http from './http.js';

export default await base.find('class', 'module').new({
  name: 'agent',
  imports: [base, http],
  async on_load(_, $) {
    $.http_server.new({
      handlers: [
        $.request_handler.new({
          handler(req, res) {

          }
        })
      ]
    })
  }
}).load();
