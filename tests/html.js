import base from '../src/base';
import test from '../src/test.js';
import html from '../src/html.js';
const __ = globalThis.SIMULABRA;

export default await base.find('Class', 'Module').new({
  name: 'TestHTML',
  registry: base.find('Class', 'ObjectRegistry').new(),
  imports: [test, html],
  on_load(_, $) {
  }
});
