import './base.js';
const __ = globalThis.SIMULABRA;
const _ = __.mod().find('class', 'module').new({
  name: 'test',
  imports: [__.mod()],
});
const $ = _.proxy('class');

$.class.new({
  name: 'case',
  components: [

  ]
})

export default _;
