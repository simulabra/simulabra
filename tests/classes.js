import base_mod from '../base.js';
import test_mod from '../test.js';
const __ = globalThis.SIMULABRA;
const _ = __.mod().find('class', 'module').new({
  name: 'test-classes',
  imports: [base_mod, test_mod],
});
const $ = _.proxy('class');

function ASSERT() {

}

$.class.new({
  name: 'color',
  components: [
    $.var.new({ name: 'r' }),
    $.var.new({ name: 'g' }),
    $.var.new({ name: 'b' }),
  ]
});

$.class.new({
  name: 'point',
  components: [
    $.var.new({ name: 'x' }),
    $.var.new({ name: 'y' }),
    function dist() {
      return (this.x().pow(2) + this.y().pow(2)).sqrt();
    }
  ]
});

$.class.new({
  name: 'color-point',
  components: [
    $.color,
    $.point,
    function g() {
      return this.dist();
    }
  ],
});

const cp = $.color_point.new({ r: 33, g: 55, b: 44, x: 3, y: 4 });
$.debug.log(cp.dist(), cp.g(), cp.r());
