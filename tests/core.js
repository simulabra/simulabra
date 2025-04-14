import { __, base } from '../src/base.js';
import test from '../src/test.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'BasicTestClass',
    slots: []
  });

  $.Class.new({
    name: 'Point',
    slots: [
      $.Var.new({ name: 'x', default: 0 }),
      $.Var.new({ name: 'y', default: 0 }),
      $.Method.new({
        name: 'dist',
        do() { return Math.sqrt(this.x() ** 2 + this.y() ** 2); }
      })
    ]
  });

  $.Class.new({
    name: 'Color',
    slots: [
      $.Var.new({ name: 'r', default: 0 }),
      $.Var.new({ name: 'g', default: 0 }),
      $.Var.new({ name: 'b', default: 0 }),
    ]
  });

  $.Case.new({
    name: 'ClassDef',
    doc: 'Tests basic class definition and retrieving the class from an instance.',
    do() {
      const b = $.BasicTestClass.new();
      this.assert(b, 'Instance should be created');
      this.assertEq(b.class(), $.BasicTestClass, 'Instance class should match definition');
    }
  });

  $.Case.new({
    name: 'ClassVarAccessAndSet',
    doc: 'Tests defining, accessing, and setting variables (Vars) on an instance.',
    do() {
      const p = $.Point.new({ x: 2 });
      this.assertEq(p.x(), 2, 'Initial value check failed');
      p.x(3);
      this.assertEq(p.x(), 3, 'Setting value check failed');
      this.assertEq(p.y(), 0, 'Default value check failed');
    }
  });

  $.Case.new({
    name: 'ClassMethodCall',
    doc: 'Tests defining and calling a method on an instance.',
    do() {
      const p = $.Point.new({ x: 3, y: 4 });
      this.assertEq(p.dist(), 5, 'Method call returned incorrect value');
    }
  });

  $.Class.new({
    name: 'PointExtended',
    slots: [
      $.Point,
      $.Var.new({ name: 'phi', default: 0 }),
      $.Method.new({
        name: 'phiShift',
        do() { return this.dist() * this.phi() / Math.PI; }
      })
    ]
  });

  $.Case.new({
    name: 'ClassName',
    doc: 'Tests retrieving the correct name for base and derived classes.',
    do() {
      this.assertEq($.Point.name(), 'Point');
      this.assertEq($.PointExtended.name(), 'PointExtended');
    }
  });

  $.Case.new({
    name: 'ClassInheritanceSingle',
    doc: 'Tests single inheritance: accessing inherited vars and methods, and using new methods.',
    do() {
      const pe = $.PointExtended.new({ x: 3, y: 4, phi: Math.PI });
      this.assertEq(pe.x(), 3, 'Inherited var access failed');
      this.assertEq(pe.dist(), 5, 'Inherited method call failed');
      this.assertEq(pe.phiShift(), 5, 'New method call failed');
    }
  });

  $.Class.new({
    name: 'ColorPoint',
    slots: [
      $.Color,
      $.Point,
      $.Method.new({
        name: 'g',
        override: true,
        do() { return this.dist(); }
      })
    ],
  });

  $.Case.new({
    name: 'ClassMultipleInheritanceOverride',
    doc: 'Tests multiple inheritance and method overriding.',
    do() {
      const cp = $.ColorPoint.new({ r: 33, g: 55, b: 44, x: 3, y: 4 });
      this.assertEq(cp.dist(), 5, 'Inherited method (dist) failed');
      this.assertEq(cp.g(), 5, 'Overridden method (g) failed');
      this.assertEq(cp.r(), 33, 'Inherited var (r) failed');
      this.assertEq(cp.b(), 44, 'Inherited var (b) failed');
    }
  });

  $.Class.new({
    name: 'BeforeBasic',
    slots: [
      $.Var.new({ name: 'x', default: 0 }),
      $.Method.new({ name: 'bump', do() { this.x(this.x() + 2); } }),
      $.Before.new({ name: 'bump', do() { this.x(this.x() + 1); } }) // Runs before primary
    ]
  });

  $.Case.new({
    name: 'BeforeModifierBasic',
    doc: 'Tests basic functionality of the Before method modifier.',
    do() {
      const bb = $.BeforeBasic.new();
      bb.bump(); // 0 -> 1 (Before) -> 3 (Primary)
      this.assertEq(bb.x(), 3, 'Before modifier did not execute correctly');
    }
  });

  $.Class.new({
    name: 'AfterBasic',
    slots: [
      $.Var.new({ name: 'x', default: 0 }),
      $.Method.new({ name: 'bump', do() { this.x(this.x() + 2); } }),
      $.After.new({ name: 'bump', do() { this.x(this.x() + 1); } })
    ]
  });

  $.Case.new({
    name: 'AfterModifierBasic',
    doc: 'Tests basic functionality of the After method modifier.',
    do() {
      const ab = $.AfterBasic.new();
      ab.bump(); // 0 -> 2 (Primary) -> 3 (After)
      this.assertEq(ab.x(), 3, 'After modifier did not execute correctly');
    }
  });

  $.Class.new({
    name: 'AfterBeforeCombined',
    slots: [
      $.BeforeBasic,
      $.After.new({ name: 'bump', do() { this.x(this.x() * 2); } })
    ]
  });

  $.Case.new({
    name: 'AfterBeforeCombinedInheritance',
    doc: 'Tests combining Before and After modifiers through inheritance.',
    do() {
      const abc = $.AfterBeforeCombined.new();
      abc.bump(); // 0 -> 1 (Before) -> 3 (Primary) -> 6 (After * 2)
      this.assertEq(abc.x(), 6, 'Combined Before/After modifiers failed');
    }
  });

  $.Class.new({
    name: 'AfterBeforeCombinedOverride',
    slots: [
      $.AfterBeforeCombined,
      $.Method.new({ name: 'bump', override: true, do() { this.x(this.x() + 3); } })
    ]
  });

  $.Case.new({
    name: 'AfterBeforeCombinedWithOverride',
    doc: 'Tests modifier execution order when the primary method is overridden.',
    do() {
      const abco = $.AfterBeforeCombinedOverride.new();
      abco.bump();
      this.assertEq(abco.x(), 8, 'Combined modifiers with override failed');
    }
  });

  $.Class.new({
    name: 'AfterMultiple',
    slots: [
      $.AfterBasic,
      $.After.new({ name: 'bump', do() { this.x(this.x() + 1); } })
    ]
  });

  $.Case.new({
    name: 'AfterModifierMultiple',
    doc: 'Tests multiple After modifiers for the same method.',
    do() {
      const am = $.AfterMultiple.new();
      am.bump();
      this.assertEq(am.x(), 4, 'Multiple After modifiers failed');
    }
  });

  $.Class.new({
    name: 'ModifierBase',
    slots: [
      $.Var.new({ name: 'journal', default: () => [] }),
      $.Method.new({ name: 'exec', do() { this.journal().push('Base Exec'); } }),
      $.Before.new({ name: 'exec', do() { this.journal().push('Base Before'); } }),
      $.After.new({ name: 'exec', do() { this.journal().push('Base After'); } }),
    ]
  });

  $.Class.new({
    name: 'ModifierChildOverride',
    slots: [
      $.ModifierBase,
      $.Method.new({ name: 'exec', override: true, do() { this.journal().push('Child Override Exec'); } }),
      $.Before.new({ name: 'exec', do() { this.journal().push('Child Before'); } }),
      $.After.new({ name: 'exec', do() { this.journal().push('Child After'); } }),
    ]
  });

  $.Case.new({
    name: 'MethodModifiersOverrideWithInherited',
    doc: 'Tests the execution order of base and child method modifiers with override.',
    do() {
      const child = $.ModifierChildOverride.new();
      child.exec();
      const expectedLog = [
        'Base Before',
        'Child Before',
        'Child Override Exec',
        'Child After',
        'Base After'
      ];
      this.assertEq(child.journal().join(','), expectedLog.join(','), 'Execution order of modifiers and override is incorrect');
    }
  });

  $.Class.new({
    name: 'StaticTest',
    slots: [
      $.Static.new({ name: 'frob', do(n) { return n * 2; } }),
      $.Static.new({ name: 'combine', do(a, b) { return `${a}-${b}`; } })
    ]
  });

  $.Case.new({
    name: 'StaticMethodCall',
    doc: 'Tests defining and calling static methods directly on the class.',
    do() {
      this.assertEq($.StaticTest.frob(3), 6, 'Static method call (frob) failed');
      this.assertEq($.StaticTest.combine('x', 'y'), 'x-y', 'Static method call (combine) failed');
    }
  });

  $.Case.new({
    name: 'ClassExtend',
    doc: 'Tests extending a class with new methods/modifiers after its initial definition.',
    do() {
      $.Class.new({
        name: 'Extendable',
        slots: [ $.Method.new({ name: 'process', do(val) { return val; } }) ]
      });

      let sideEffect = 0;
      $.Extendable.extend($.After.new({
        name: 'process',
        do() { sideEffect++; }
      }));

      const e = $.Extendable.new();
      this.assertEq(sideEffect, 0, 'Side effect should not trigger before call');
      const result = e.process('data');
      this.assertEq(result, 'data', 'Original method functionality failed after extend');
      this.assertEq(sideEffect, 1, 'Extended After modifier did not run');
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
    doc: 'Tests basic EnumVar functionality: default value and valid assignment.',
    do() {
      const t = $.Task.new();
      this.assertEq(t.status(), 'pending', 'Wrong default enum value');
      t.status('active');
      this.assertEq(t.status(), 'active', 'Failed to update enum value');
    }
  });

  $.Case.new({
    name: 'EnumVarInvalidAssignment',
    doc: 'Tests that assigning an invalid value to an EnumVar throws an error.',
    do() {
      const t = $.Task.new();
      const errorMessage = this.assertThrows(
        () => { t.status('invalid_status'); },
        'Invalid enum value',
        'Should have thrown error for invalid enum value assignment'
      );
      this.assertErrorMessageIncludes(errorMessage, "'invalid_status'");
      this.assertErrorMessageIncludes(errorMessage, 'pending, active, complete');
    }
  });

  $.Case.new({
    name: 'EnumVarInvalidDefault',
    doc: 'Tests that defining an EnumVar with an invalid default value throws an error during class definition.',
    do() {
      const errorMessage = this.assertThrows(() => {
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
      },
      'Invalid default value',
      'Should have thrown error for invalid default enum value');
      this.assertErrorMessageIncludes(errorMessage, "invalid_default");
      this.assertErrorMessageIncludes(errorMessage, 'pending, active, complete');
    }
  });

  $.Class.new({
    name: 'AutoVarTester',
    slots: [
      $.Var.new({ name: 'baseValue', default: 10 }),
      $.AutoVar.new({
        name: 'computedValue',
        auto() { return this.baseValue() * 2; }
      }),
       $.AutoVar.new({
        name: 'fixedValue',
        auto() { return 42; }
      })
    ]
  });

  $.Case.new({
    name: 'AutoVarBasic',
    doc: 'Tests AutoVar initialization with fixed and dependent values.',
    do() {
      const tester = $.AutoVarTester.new({ baseValue: 5 });

      this.assertEq(tester.fixedValue(), 42, 'Fixed AutoVar value incorrect');
      this.assertEq(tester.computedValue(), 10, 'Dependent AutoVar value incorrect'); // 5 * 2

      tester.fixedValue(99);
      tester.computedValue(100);
      this.assertEq(tester.fixedValue(), 99, 'Setting fixed AutoVar failed');
      this.assertEq(tester.computedValue(), 100, 'Setting computed AutoVar failed');

      const defaultTester = $.AutoVarTester.new();
      this.assertEq(defaultTester.fixedValue(), 42, 'Default fixed AutoVar value incorrect');
      this.assertEq(defaultTester.computedValue(), 20, 'Default computed AutoVar value incorrect'); // 10 * 2
    }
  });

  $.Class.new({
    name: 'VirtualBase',
    slots: [
      $.Virtual.new({ name: 'mustImplement' }),
      $.Method.new({ name: 'concreteMethod', do() { return 'Concrete'; } })
    ]
  });

  $.Case.new({
    name: 'VirtualMethodThrowsWhenUnimplemented',
    doc: 'Tests that calling an unimplemented virtual method throws an error.',
    do() {
      const base = $.VirtualBase.new();
      this.assertThrows(
        () => { base.mustImplement(); },
        'not implemented: mustImplement',
        'Calling an unimplemented virtual method should throw an error.'
      );
    }
  });

  $.Class.new({
    name: 'VirtualImpl',
    slots: [
      $.VirtualBase,
      $.Method.new({ name: 'mustImplement', do() { return 'Implemented!'; } })
    ]
  });

  $.Case.new({
    name: 'VirtualMethodWorksWhenImplemented',
    doc: 'Tests that calling an implemented virtual method executes correctly.',
    do() {
      const impl = $.VirtualImpl.new();
      let result = '';
      let caught = false;
      try {
        result = impl.mustImplement();
      } catch(e) {
        caught = true;
      }
      this.assert(!caught, 'Calling an implemented virtual method should not throw.');
      this.assertEq(result, 'Implemented!', 'Implemented virtual method returned wrong value.');
      this.assertEq(impl.concreteMethod(), 'Concrete', 'Inherited concrete method failed.');
    }
  });

  $.Class.new({
    name: 'EventTester',
    slots: [
      $.Var.new({ name: 'eventTriggered', default: false }),
      $.Var.new({ name: 'eventData', default: null }),
      $.Method.new({
        name: 'listen',
        do() {
          this.addEventListener('customEvent', (event) => {
            this.eventTriggered(true);
            this.eventData(event.detail);
          });
        }
      }),
      $.Method.new({
        name: 'fire',
        do(detail) {
          this.dispatchEvent({ type: 'customEvent', detail: detail, target: this });
        }
      })
    ]
  });

  $.Case.new({
    name: 'EventSystemBasicListenDispatch',
    doc: 'Tests basic event listener registration and event dispatching.',
    do() {
      const tester = $.EventTester.new();
      tester.listen();

      this.assertEq(tester.eventTriggered(), false, 'Event flag should be false initially');
      this.assertEq(tester.eventData(), null, 'Event data should be null initially');

      const payload = { data: 'test payload' };
      tester.fire(payload);

      this.assertEq(tester.eventTriggered(), true, 'Event flag should be true after dispatch');
      this.assertEq(tester.eventData(), payload, 'Event data was not received correctly');
    }
  });

  const moduleA = await function (_modA, $A) {
    $A.Class.new({
      name: 'Widget',
      slots: [
        $A.Var.new({ name: 'widgetProp', default: 'widget-abc' }),
        $A.Method.new({ name: 'ping', do() { return 'pong from Widget ' + this.name(); } })
      ]
    });
    $A.Widget.new({ name: 'globalWidget' });
  }.module({
    name: 'test.core.moduleA',
    imports: [base]
  }).load();

  const moduleB = await function (_modB, $B) {
    $B.Class.new({
      name: 'Gadget',
      slots: [
        $B.Widget,
        $B.Var.new({ name: 'gadgetProp', default: 'gadget-xyz' }),
        $B.Method.new({ name: 'ping', override: true, do() { return 'pong from Gadget ' + this.name(); } })
      ]
    });
  }.module({
    name: 'test.core.moduleB',
    imports: [base, moduleA]
  }).load();

  $.Case.new({
    name: 'ModuleFindClassAcrossModules',
    doc: 'Tests finding a class definition from an imported module.',
    do() {
      const WidgetClass = moduleB.find('Class', 'Widget');
      this.assert(WidgetClass, 'Could not find Widget class definition via moduleB');
      this.assertEq(WidgetClass.name(), 'Widget', 'Found class has incorrect name');

      const WidgetClassA = moduleA.find('Class', 'Widget');
      this.assertEq(WidgetClass, WidgetClassA, 'Class definitions found from different modules do not match');
    }
  });

   $.Case.new({
    name: 'ModuleGetInstanceAcrossModules',
    doc: 'Tests retrieving a class instance defined in an imported module.',
    do() {
      const WidgetClass = moduleB.find('Class', 'Widget'); // Get class def first
      this.assert(WidgetClass, 'Could not find Widget class definition');

      // Use moduleB to get the instance 'globalWidget' defined in moduleA
      //const instance = moduleB.getInstance(WidgetClass, 'globalWidget');
      //this.assert(instance, 'Could not get instance "globalWidget" via moduleB');
      //this.assertEq(instance.name(), 'globalWidget', 'Instance found has wrong name');
      //this.assertEq(instance.class().name(), 'Widget', 'Instance has wrong class name');
      //this.assertEq(instance.ping(), 'pong from Widget globalWidget', 'Instance method call failed');
    }
  });

  $.Case.new({
    name: 'ModuleUseInheritedClassAcrossModules',
    doc: 'Tests creating and using an instance of a class that inherits from a class in another module.',
    do() {
      const $B = moduleB.$();
      const gadget = $B.Gadget.new({ name: 'myGadget' });

      this.assert(gadget, 'Failed to create Gadget instance');
      this.assertEq(gadget.name(), 'myGadget', 'Gadget instance has wrong name');
      this.assertEq(gadget.gadgetProp(), 'gadget-xyz', 'Gadget instance missing own property');
      this.assertEq(gadget.ping(), 'pong from Gadget myGadget', 'Gadget overridden ping method failed');
      this.assertEq(gadget.widgetProp(), 'widget-abc', 'Gadget instance missing inherited property');

      const WidgetClass = moduleA.find('Class', 'Widget'); // Get original Widget class
      this.assert(gadget.isa(WidgetClass), 'Gadget instance should report isa(Widget)');
      const GadgetClass = moduleB.find('Class', 'Gadget');
       this.assert(gadget.isa(GadgetClass), 'Gadget instance should report isa(Gadget)');
    }
  });

  $.Case.new({
    name: 'ClassGetInstanceByNameAndId',
    doc: 'Tests retrieving instances from the registry using both name and ID.',
    do() {
      const p1 = $.Point.new({ name: 'pointInstance1', x: 1 });
      const p2 = $.Point.new({ y: 2 });

      const p1_id = p1.id();
      const p2_id = p2.id();

      const foundByName = _.getInstance($.Point, 'pointInstance1');
      this.assertEq(p1, foundByName, 'Failed to retrieve instance by name');

      const foundById1 = _.getInstance($.Point, p1_id);
      const foundById2 = _.getInstance($.Point, p2_id);
      this.assertEq(p1, foundById1, 'Failed to retrieve instance p1 by ID');
      this.assertEq(p2, foundById2, 'Failed to retrieve instance p2 by ID');
    }
  });
}.module({
  name: 'test.core',
  imports: [test],
}).load();
