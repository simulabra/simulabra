import base from './base.js';
const __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'html',
  imports: [base],
  async on_load(_, $) {
  }
}).load();
