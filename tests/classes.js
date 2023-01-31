import { $s } from '../base.js';
const __ = globalThis.SIMULABRA;
const _ = __.mod('lisp2');
const $ = _.class_proxy();

function ASSERT()

$.class.new({
  name: 'color',
  slots: {
    r: $.var.new(),
    g: $.var.new(),
    b: $.var.new(),
  }
});

$.class.new({
  name: 'point',
  slots: {
    x: $.var.new(),
    y: $.var.new(),
    dist() {
      return (this.x().pow(2) + this.y().pow(2)).sqrt();
    }
  }
});

$.class.new({
  name: 'color-point',
  components: [$.color, $.point],
  slots: {
    g() {
      return this.dist();
    }
  }
});

const cp = $.color_point.new({ r: 33, g: 55, b: 44, x: 3, y: 4 });
$.debug.log(cp.dist(), cp.g(), cp.r());
