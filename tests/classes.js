import base_mod from '../base.js';
import test_mod from '../test.js';
const __ = globalThis.SIMULABRA;
const _ = __.mod().find('class', 'module').new({
  name: 'test-classes',
  imports: [base_mod, test_mod],
});
const $ = _.proxy('class');

$.class.new({
  name: 'basic',
  components: []
});

$.case.new({
  name: 'test-class-def',
  do() {
    const b = $.basic.new();
    this.assert_eq(b.class(), $.basic);
  }
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

$.case.new({
  name: 'test-class-def-var',
  do() {
    const p = $.point.new({ x: 2 });
    this.assert_eq(p.x(), 2);
  }
});

$.case.new({
  name: 'test-class-set-var',
  do() {
    const p = $.point.new({ x: 2 });
    p.x(3);
    this.assert_eq(p.x(), 3);
  }
});

$.class.new({
  name: 'point-extended',
  components: [
    $.point,
    $.var.new({ name: 'phi' }),
    $.method.new({
      name: 'phi-shift',
      do() {
        return this.dist() * this.phi() / Math.PI;
      }
    })
  ]
});

$.case.new({
  name: 'test-class-inheritance-phi',
  do() {
    const pe = $.point_extended.new({ x: 3, y: 4, phi: Math.PI });
    this.assert_eq(pe.phi_shift(), 5);
  }
});

$.class.new({
  name: 'color',
  components: [
    $.var.new({ name: 'r' }),
    $.var.new({ name: 'g' }),
    $.var.new({ name: 'b' }),
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

$.case.new({
  name: 'test-class-multiple-inheritance-override',
  do() {
    const cp = $.color_point.new({ r: 33, g: 55, b: 44, x: 3, y: 4 });
    this.assert_eq(cp.dist(), 5);
    this.assert_eq(cp.g(), 5);
    this.assert_eq(cp.r(), 33);
  }
});

