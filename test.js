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
      }
    }),
    $.var.new({ name: 'do' }),
  ]
});


export default _;
