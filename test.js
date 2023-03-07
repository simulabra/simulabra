import base_mod from './base.js';
var __ = globalThis.SIMULABRA;
const _ = __.mod().find('class', 'module').new({
  name: 'test',
  imports: [base_mod],
});
const $ = _.proxy('class');

$.class.new({
  name: 'case',
  components: [
    $.after.new({
      name: 'init',
      do() {
        this.do().apply(this);
        this.log('passed');
      }
    }),
    $.var.new({ name: 'do' }),
    $.method.new({
      name: 'assert-eq',
      do(a, b) {
        if (a !== b) {
          throw new Error(`assertion failed: ${a.description()} !== ${b.description()}`);
        }
      }
    })
  ]
});


export default _;
