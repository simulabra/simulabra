import base from '../src/base.js';
import test from '../src/test.js';

const __ = globalThis.SIMULABRA;

export default await function (_, $) {
  $.Class.new({
    name: 'basic',
    slots: []
  });

  $.Case.new({
    name: 'ClassDef',
    do() {
      const b = $.basic.new();
      this.assertEq(b.class(), $.basic);
    }
  });

  $.Class.new({
    name: 'Point',
    slots: [
      $.Var.new({ name: 'x' }),
      $.Var.new({ name: 'y' }),
      function dist() {
        return Math.sqrt(this.x() ** 2 + this.y() ** 2);
      }
    ]
  });

  $.Case.new({
    name: 'ClassDefVar',
    do() {
      const p = $.Point.new({ x: 2 });
      this.assertEq(p.x(), 2);
    }
  });

  $.Case.new({
    name: 'ClassSetVar',
    do() {
      const p = $.Point.new({ x: 2 });
      p.x(3);
      this.assertEq(p.x(), 3);
    }
  });

  $.Class.new({
    name: 'PointExtended',
    slots: [
      $.Point,
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
    name: 'ClassName',
    do() {
      this.assertEq($.Point.name(), 'Point');
      this.assertEq($.PointExtended.name(), 'PointExtended');
    }
  });

  $.Case.new({
    name: 'ClassInheritancePhi',
    do() {
      const pe = $.PointExtended.new({ x: 3, y: 4, phi: Math.PI });
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
    name: 'ColorPoint',
    slots: [
      $.color,
      $.Point,
      function g() {
        return this.dist();
      }
    ],
  });

  $.Case.new({
    name: 'class_multiple_inheritance_override',
    do() {
      const cp = $.ColorPoint.new({ r: 33, g: 55, b: 44, x: 3, y: 4 });
      this.assertEq(cp.dist(), 5);
      this.assertEq(cp.g(), 5);
      this.assertEq(cp.r(), 33);
    }
  });

  $.Class.new({
    name: 'BeforeBasic',
    slots: [
      $.Var.new({ name: 'x', default: 0 }),
      $.Method.new({
        name: 'bump',
        do() {
          return this.x(this.x() + 2);
        }
      }),
      $.Before.new({
        name: 'bump',
        do() {
          return this.x(this.x() + 1);
        }
      })
    ]
  });

  $.Case.new({
    name: 'BeforeBasic',
    do() {
      const ab = $.BeforeBasic.new();
      ab.bump();
      this.assertEq(ab.x(), 3);
    }
  });

  $.Class.new({
    name: 'AfterBasic',
    slots: [
      $.Var.new({ name: 'x', default: 0 }),
      $.Method.new({
        name: 'bump',
        do() {
          return this.x(this.x() + 2);
        }
      }),
      $.After.new({
        name: 'bump',
        do() {
          return this.x(this.x() + 1);
        }
      })
    ]
  });


  $.Case.new({
    name: 'AfterBasic',
    do() {
      const ab = $.AfterBasic.new();
      ab.bump();
      this.assertEq(ab.x(), 3);
    }
  });

  $.Class.new({
    name: 'AfterBeforeCombined',
    slots: [
      $.BeforeBasic,
      $.After.new({
        name: 'bump',
        do() {
          return this.x(this.x() * 2);
        }
      })
    ]
  });

  $.Case.new({
    name: 'AfterBeforeCombined',
    do() {
      const ab = $.AfterBeforeCombined.new();
      ab.bump();
      this.assertEq(ab.x(), 6);
    }
  });

  $.Class.new({
    name: 'AfterBeforeCombined_Method',
    slots: [
      $.AfterBeforeCombined,
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
    name: 'AfterBeforeCombined_Method',
    do() {
      const abc = $.AfterBeforeCombined_Method.new();
      abc.bump();
      this.assertEq(abc.x(), 8);
    }
  });
  $.Class.new({
    name: 'AfterMultiple',
    slots: [
      $.AfterBasic,
      $.After.new({
        name: 'bump',
        do() {
          return this.x(this.x() + 1);
        }
      })
    ]
  });

  $.Case.new({
    name: 'AfterMultiple',
    do() {
      const am = $.AfterMultiple.new();
      am.bump();
      this.assertEq(am.x(), 4);
    }
  });

  $.Case.new({
    name: 'Static',
    do() {
      $.Class.new({
        name: 'StaticTest',
        slots: [
          $.Static.new({
            name: 'frob',
            do(n) {
              return n * 2;
            }
          }),
        ]
      });

      this.assertEq($.StaticTest.frob(3), 6);
    }
  });

  $.Case.new({
    name: 'BasicExtend',
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
      $.ext1.extend($.After.new({
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

  $.Class.new({
    name: 'Task',
    slots: [
      $.EnumVar.new({
        name: 'status',
        choices: ['pending', 'active', 'complete'],
        default: 'pending'
      })
    ]
  });

  $.Case.new({
    name: 'EnumVarBasic',
    do() {
      const t = $.Task.new();
      this.assertEq(t.status(), 'pending', 'Wrong default value');
      t.status('active');
      this.assertEq(t.status(), 'active', 'Failed to update value');
    }
  });

  $.Case.new({
    name: 'EnumVarInvalid',
    do() {
      const t = $.Task.new();
      let caught = false;
      try {
        t.status('invalid_status');
      } catch (e) {
        caught = true;
        this.assertErrorMessageIncludes(e.message, 'Invalid enum value');
        this.assertErrorMessageIncludes(e.message, 'pending, active, complete');
      }
      this.assert(caught, 'Should have thrown error for invalid enum value');
    }
  });

  $.Case.new({
    name: 'EnumVarInvalidDefault',
    do() {
      let caught = false;
      try {
        $.Class.new({
          name: 'BadTask',
          slots: [
            $.EnumVar.new({
              name: 'status',
              choices: ['pending', 'active', 'complete'],
              default: 'invalid_default'
            })
          ]
        });
      } catch (e) {
        caught = true;
        this.assertErrorMessageIncludes(e.message, 'Invalid default value');
        this.assertErrorMessageIncludes(e.message, 'pending, active, complete');
      }
      this.assert(caught, 'Should have thrown error for invalid default value');
    }
  });

  $.Case.new({
    name: 'ClassGetInstance',
    do() {
      const t = $.Task.new({ name: 'testInstance' });
      const tid = _.getInstance($.Task, t.id());
      this.assertEq(t, tid);
      const tname = _.getInstance($.Task, t.name());
      this.assertEq(t, tname);
      const trefname = $.Task.$testInstance;
      this.assertEq(t, trefname);
      const trefid = $.Task['$' + t.id()];
      this.assertEq(t, trefid);
    }
  });

  $.Case.new({
    name: 'AutoVar',
    do() {
      $.Class.new({
        name: 'AutoVarTester',
        slots: [
          $.AutoVar.new({
            name: 'value',
            auto() {
              return 42;
            }
          })
        ]
      });

      $.Class.new({
        name: 'AutoVarDependencyTester', 
        slots: [
          $.Var.new({ name: 'counter', default: 0 }),
          $.AutoVar.new({
            name: 'computed',
            auto() {
              return this.counter() * 2;
            }
          })
        ]
      });

      const tester = $.AutoVarTester.new();
      this.assertEq(tester.value(), 42);

      tester.value(200);
      this.assertEq(tester.value(), 200);

      const depTester = $.AutoVarDependencyTester.new({ counter: 5 });
      this.assertEq(depTester.computed(), 10);
    }
  });
}.module({
  name: 'test.classes',
  imports: [test],
}).load();
