import base from '../src/base';
import test from '../src/test.js';
import html from '../src/html.js';

const __ = globalThis.SIMULABRA;

export default await __.$().Module.new({
  name: 'test.html',
  imports: [test, html],
  mod(_, $) {
  }
});
