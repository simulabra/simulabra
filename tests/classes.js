import base from '../base.js';
import test from '../test.js';
const __ = globalThis.SIMULABRA;

export default await base.find('class', 'module').new({
  name: 'test_classes',
  imports: [test],
  on_load(_, $) {
    $.class.new({
      name: 'basic',
      components: []
    });

    $.case.new({
      name: 'class_def',
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
      name: 'class_def_var',
      do() {
        const p = $.point.new({ x: 2 });
        this.assert_eq(p.x(), 2);
      }
    });

    $.case.new({
      name: 'class_set_var',
      do() {
        const p = $.point.new({ x: 2 });
        p.x(3);
        this.assert_eq(p.x(), 3);
      }
    });

    $.class.new({
      name: 'point_extended',
      components: [
        $.point,
        $.var.new({ name: 'phi' }),
        $.method.new({
          name: 'phi_shift',
          do() {
            return this.dist() * this.phi() / Math.PI;
          }
        })
      ]
    });

    $.case.new({
      name: 'class_name',
      do() {
        this.assert_eq($.point.name(), 'point');
        this.assert_eq($.point_extended.name(), 'point_extended');
      }
    });

    $.case.new({
      name: 'class_inheritance_phi',
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
      name: 'color_point',
      components: [
        $.color,
        $.point,
        function g() {
          return this.dist();
        }
      ],
    });

    $.case.new({
      name: 'class_multiple_inheritance_override',
      do() {
        const cp = $.color_point.new({ r: 33, g: 55, b: 44, x: 3, y: 4 });
        this.assert_eq(cp.dist(), 5);
        this.assert_eq(cp.g(), 5);
        this.assert_eq(cp.r(), 33);
      }
    });

    $.class.new({
      name: 'before_basic',
      components: [
        $.var.new({ name: 'x', default: 0 }),
        $.method.new({
          name: 'bump',
          do() {
            return this.x(this.x() + 2);
          }
        }),
        $.before.new({
          name: 'bump',
          do() {
            return this.x(this.x() + 1);
          }
        })
      ]
    });

    $.case.new({
      name: 'before_basic',
      do() {
        const ab = $.before_basic.new();
        ab.bump();
        this.assert_eq(ab.x(), 3);
      }
    });

    $.class.new({
      name: 'after_basic',
      components: [
        $.var.new({ name: 'x', default: 0 }),
        $.method.new({
          name: 'bump',
          do() {
            return this.x(this.x() + 2);
          }
        }),
        $.after.new({
          name: 'bump',
          do() {
            return this.x(this.x() + 1);
          }
        })
      ]
    });


    $.case.new({
      name: 'after_basic',
      do() {
        const ab = $.after_basic.new();
        ab.bump();
        this.assert_eq(ab.x(), 3);
      }
    });

    $.class.new({
      name: 'after_before_combined',
      components: [
        $.before_basic,
        $.after.new({
          name: 'bump',
          do() {
            return this.x(this.x() * 2);
          }
        })
      ]
    });

    $.case.new({
      name: 'after_before_combined',
      do() {
        const ab = $.after_before_combined.new();
        ab.bump();
        this.assert_eq(ab.x(), 6);
      }
    });

    $.class.new({
      name: 'after_before_combined_method',
      components: [
        $.after_before_combined,
        $.method.new({
          name: 'bump',
          override: true,
          do() {
            return this.x(this.x() + 3);
          }
        })
      ]
    });

    $.case.new({
      name: 'after_before_combined_method',
      do() {
        const abc = $.after_before_combined_method.new();
        abc.bump();
        this.assert_eq(abc.x(), 8);
      }
    });
    $.class.new({
      name: 'after_multiple',
      components: [
        $.after_basic,
        $.after.new({
          name: 'bump',
          do() {
            return this.x(this.x() + 1);
          }
        })
      ]
    });

    $.case.new({
      name: 'after_multiple',
      do() {

        const am = $.after_multiple.new();
        am.bump();
        this.assert_eq(am.x(), 4);
        this.log($.after_multiple.src_line());
      }
    });
  }
}).load();
