import { fetch } from 'node-fetch';
import base from '../src/base';
import test from '../src/test.js';
import html from '../src/html.jsx';
const __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'test_http',
  imports: [test, html],
  on_load(_, $) {
  }
});
