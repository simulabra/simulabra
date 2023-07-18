import base from './base.jsx';
import http from './http.js';
import transform from './transform.js';
import { readFileSync } from 'fs';

export default await base.find('class', 'module').new({
  name: 'agent',
  imports: [base, http],
  async on_load(_, $) {
    <$http_server port={3031}>
      <$path_request_handler
        path="/"
        handler={function (req, res) {
          res.ok(readFileSync('./src/bootstrap.html').toString());
        }}
      />
      <$filetype_request_handler
        filetypes={['js', 'jsx']}
        handler={function (req, res) {
            const fileName = './src/' + req.inner().url;
            res.ok(transform(fileName), 'application/javascript');
        }}
      />
    </$http_server>
  }
}).load();
