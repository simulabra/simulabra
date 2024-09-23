import base from '../src/base.js';
import test from '../src/test.js';
const __ = globalThis.SIMULABRA;

export default await base.find('Class', 'Module').new({
  name: 'test_classes',
  imports: [test],
  registry: base.find('Class', 'object_registry').new(),
  on_load(_, $) {
    $.Class.new({
      name: 'basic',
      slots: []
    });

    $.Case.new({
      name: 'class_def',
      do() {
        const b = $.basic.new();
        this.assertEq(b.class(), $.basic);
      }
    });

    $.Class.new({
      name: 'point',
      slots: [
        $.Var.new({ name: 'x' }),
        $.Var.new({ name: 'y' }),
        function dist() {
          return Math.sqrt(this.x() ** 2 + this.y() ** 2);
        }
      ]
    });

    $.Case.new({
      name: 'class_def_Var',
      do() {
        const p = $.point.new({ x: 2 });
        this.assertEq(p.x(), 2);
      }
    });

    $.Case.new({
      name: 'class_set_Var',
      do() {
        const p = $.point.new({ x: 2 });
        p.x(3);
        this.assertEq(p.x(), 3);
      }
    });

    $.Class.new({
      name: 'point_extended',
      slots: [
        $.point,
        $.Var.new({ name: 'phi' }),
        $.Method.new({
          name: 'phi_shift',
          do() {
            return this.dist() * this.phi() / Math.PI;
          }
        })
      ]
    });

    $.Case.new({
      name: 'class_name',
      do() {
        this.assertEq($.point.name(), 'point');
        this.assertEq($.point_extended.name(), 'point_extended');
      }
    });

    $.Case.new({
      name: 'class_inheritance_phi',
      do() {
        const pe = $.point_extended.new({ x: 3, y: 4, phi: Math.PI });
        this.assertEq(pe.phi_shift(), 5);
      }
    });

    $.Class.new({
      name: 'color',
      slots: [
        $.Var.new({ name: 'r' }),
        $.Var.new({ name: 'g' }),
        $.Var.new({ name: 'b' }),
      ]
    });

    $.Class.new({
      name: 'color_point',
      slots: [
        $.color,
        $.point,
        function g() {
          return this.dist();
        }
      ],
    });

    $.Case.new({
      name: 'class_multiple_inheritance_override',
      do() {
        const cp = $.color_point.new({ r: 33, g: 55, b: 44, x: 3, y: 4 });
        this.assertEq(cp.dist(), 5);
        this.assertEq(cp.g(), 5);
        this.assertEq(cp.r(), 33);
      }
    });

    $.Class.new({
      name: 'before_basic',
      slots: [
        $.Var.new({ name: 'x', default: 0 }),
        $.Method.new({
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

    $.Case.new({
      name: 'before_basic',
      do() {
        const ab = $.before_basic.new();
        ab.bump();
        this.assertEq(ab.x(), 3);
      }
    });

    $.Class.new({
      name: 'after_basic',
      slots: [
        $.Var.new({ name: 'x', default: 0 }),
        $.Method.new({
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


    $.Case.new({
      name: 'after_basic',
      do() {
        const ab = $.after_basic.new();
        ab.bump();
        this.assertEq(ab.x(), 3);
      }
    });

    $.Class.new({
      name: 'after_before_combined',
      slots: [
        $.before_basic,
        $.after.new({
          name: 'bump',
          do() {
            return this.x(this.x() * 2);
          }
        })
      ]
    });

    $.Case.new({
      name: 'after_before_combined',
      do() {
        const ab = $.after_before_combined.new();
        ab.bump();
        this.assertEq(ab.x(), 6);
      }
    });

    $.Class.new({
      name: 'after_before_combined_Method',
      slots: [
        $.after_before_combined,
        $.Method.new({
          name: 'bump',
          override: true,
          do() {
            return this.x(this.x() + 3);
          }
        })
      ]
    });

    $.Case.new({
      name: 'after_before_combined_Method',
      do() {
        const abc = $.after_before_combined_Method.new();
        abc.bump();
        this.assertEq(abc.x(), 8);
      }
    });
    $.Class.new({
      name: 'after_multiple',
      slots: [
        $.after_basic,
        $.after.new({
          name: 'bump',
          do() {
            return this.x(this.x() + 1);
          }
        })
      ]
    });

    $.Case.new({
      name: 'after_multiple',
      do() {
        const am = $.after_multiple.new();
        am.bump();
        this.assertEq(am.x(), 4);
      }
    });

    $.Case.new({
      name: 'static',
      do() {
        $.Class.new({
          name: 'static_test',
          slots: [
            $.static.new({
              name: 'frob',
              do(n) {
                return n * 2;
              }
            }),
          ]
        });

        this.assertEq($.static_test.frob(3), 6);
      }
    });

    $.Case.new({
      name: 'basic extend',
      do() {
        $.Class.new({
          name: 'ext1',
          slots: [
            $.Method.new({
              name: 'p',
              do() {}
            }),
          ]
        });
        let x = 0;
        $.ext1.extend($.after.new({
          name: 'p',
          do() {
            x++;
          }
        }));
        let e = $.ext1.new();
        this.assertEq(x, 0);
        e.p();
        this.assertEq(x, 1);
      }
    });

  }
}).load();
