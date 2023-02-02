import { $s } from '../base.js';
const __ = globalThis.SIMULABRA;
const _ = __.mod('test-classes');
const $ = _.class_proxy();

function ASSERT() {

}

$.class.new({
  name: 'color',
  components: [
    $.var.new({ name: 'r'.s }),
    $.var.new({ name: 'g'.s }),
    $.var.new({ name: 'b'.s }),
  ]
});

$.class.new({
  name: 'point',
  components: [
    $.var.new({ name: 'x'.s }),
    $.var.new({ name: 'y'.s }),
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
