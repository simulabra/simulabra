import base from '../src/base.jsx';
import test from '../src/test.js';
const __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'test_match',
  imports: [test],
  on_load(_, $) {
    $.case.new({
      name: 'basic matching',
      do() {
        this.assert_eq($.wildcard_pattern.new().match(1).ok(), true);
        this.assert_eq($.wildcard_pattern.new().match(1).value(), 1);
      }
    });
  }
}).load();
