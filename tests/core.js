import { __, base } from '../src/base.js';
import test from '../src/test.js';

export default await async function (_, $, $base, $test) {
  $base.Class.new({
    name: 'BasicTestClass',
    slots: []
  });

  $base.Class.new({
    name: 'Point',
    slots: [
      $base.Var.new({ name: 'x', default: 0 }),
      $base.Var.new({ name: 'y', default: 0 }),
      $base.Method.new({
        name: 'dist',
        do() { return Math.sqrt(this.x() ** 2 + this.y() ** 2); }
      })
    ]
  });

  $base.Class.new({
    name: 'Color',
    slots: [
      $base.Var.new({ name: 'r', default: 0 }),
      $base.Var.new({ name: 'g', default: 0 }),
      $base.Var.new({ name: 'b', default: 0 }),
    ]
  });

  $test.Case.new({
    name: 'ClassDef',
    doc: 'Tests basic class definition and retrieving the class from an instance.',
    do() {
      const b = $.BasicTestClass.new();
      this.assert(b, 'Instance should be created');
      this.assertEq(b.class(), $.BasicTestClass, 'Instance class should match definition');
    }
  });

  $test.Case.new({
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

  $test.Case.new({
    name: 'ClassVarProperties',
    doc: 'Tests defining, accessing, and setting variables (Vars) on an instance.',
    do() {
      const p = $.Point.new({ x: 2 });
      this.assertEq(p._x, 2, 'Initial value check failed');
      p._x = 3;
      this.assertEq(p._x, 3, 'Setting value check failed');
      this.assertEq(p._y, 0, 'Default value check failed');
    }
  });

  $test.Case.new({
    name: 'ClassMethodCall',
    doc: 'Tests defining and calling a method on an instance.',
    do() {
      const p = $.Point.new({ x: 3, y: 4 });
      this.assertEq(p.dist(), 5, 'Method call returned incorrect value');
    }
  });

  $base.Class.new({
    name: 'PointExtended',
    slots: [
      $.Point,
      $base.Var.new({ name: 'phi', default: 0 }),
      $base.Method.new({
        name: 'phiShift',
        do() { return this.dist() * this.phi() / Math.PI; }
      })
    ]
  });

  $test.Case.new({
    name: 'ClassName',
    doc: 'Tests retrieving the correct name for base and derived classes.',
    do() {
      this.assertEq($.Point.name, 'Point');
      this.assertEq($.PointExtended.name, 'PointExtended');
    }
  });

  $test.Case.new({
    name: 'ClassInheritanceSingle',
    doc: 'Tests single inheritance: accessing inherited vars and methods, and using new methods.',
    do() {
      const pe = $.PointExtended.new({ x: 3, y: 4, phi: Math.PI });
      this.assertEq(pe.x(), 3, 'Inherited var access failed');
      this.assertEq(pe.dist(), 5, 'Inherited method call failed');
      this.assertEq(pe.phiShift(), 5, 'New method call failed');
    }
  });

  $base.Class.new({
    name: 'ColorPoint',
    slots: [
      $.Color,
      $.Point,
      $base.Method.new({
        name: 'g',
        override: true,
        do() { return this.dist(); }
      })
    ],
  });

  $test.Case.new({
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

  $base.Class.new({
    name: 'BeforeBasic',
    slots: [
      $base.Var.new({ name: 'x', default: 0 }),
      $base.Method.new({ name: 'bump', do() { this.x(this.x() + 2); } }),
      $base.Before.new({ name: 'bump', do() { this.x(this.x() + 1); } }) // Runs before primary
    ]
  });

  $test.Case.new({
    name: 'BeforeModifierBasic',
    doc: 'Tests basic functionality of the Before method modifier.',
    do() {
      const bb = $.BeforeBasic.new();
      bb.bump(); // 0 -> 1 (Before) -> 3 (Primary)
      this.assertEq(bb.x(), 3, 'Before modifier did not execute correctly');
    }
  });

  $base.Class.new({
    name: 'AfterBasic',
    slots: [
      $base.Var.new({ name: 'x', default: 0 }),
      $base.Method.new({ name: 'bump', do() { this.x(this.x() + 2); } }),
      $base.After.new({ name: 'bump', do() { this.x(this.x() + 1); } })
    ]
  });

  $test.Case.new({
    name: 'AfterModifierBasic',
    doc: 'Tests basic functionality of the After method modifier.',
    do() {
      const ab = $.AfterBasic.new();
      ab.bump(); // 0 -> 2 (Primary) -> 3 (After)
      this.assertEq(ab.x(), 3, 'After modifier did not execute correctly');
    }
  });

  $base.Class.new({
    name: 'AfterBeforeCombined',
    slots: [
      $.BeforeBasic,
      $base.After.new({ name: 'bump', do() { this.x(this.x() * 2); } })
    ]
  });

  $test.Case.new({
    name: 'AfterBeforeCombinedInheritance',
    doc: 'Tests combining Before and After modifiers through inheritance.',
    do() {
      const abc = $.AfterBeforeCombined.new();
      abc.bump(); // 0 -> 1 (Before) -> 3 (Primary) -> 6 (After * 2)
      this.assertEq(abc.x(), 6, 'Combined Before/After modifiers failed');
    }
  });

  $base.Class.new({
    name: 'AfterBeforeCombinedOverride',
    slots: [
      $.AfterBeforeCombined,
      $base.Method.new({ name: 'bump', override: true, do() { this.x(this.x() + 3); } })
    ]
  });

  $test.Case.new({
    name: 'AfterBeforeCombinedWithOverride',
    doc: 'Tests modifier execution order when the primary method is overridden.',
    do() {
      const abco = $.AfterBeforeCombinedOverride.new();
      abco.bump();
      this.assertEq(abco.x(), 8, 'Combined modifiers with override failed');
    }
  });

  $base.Class.new({
    name: 'AfterMultiple',
    slots: [
      $.AfterBasic,
      $base.After.new({ name: 'bump', do() { this.x(this.x() + 1); } })
    ]
  });

  $test.Case.new({
    name: 'AfterModifierMultiple',
    doc: 'Tests multiple After modifiers for the same method.',
    do() {
      const am = $.AfterMultiple.new();
      am.bump();
      this.assertEq(am.x(), 4, 'Multiple After modifiers failed');
    }
  });

  $base.Class.new({
    name: 'ModifierBase',
    slots: [
      $base.Var.new({ name: 'journal', default: () => [] }),
      $base.Method.new({ name: 'exec', do() { this.journal().push('Base Exec'); } }),
      $base.Before.new({ name: 'exec', do() { this.journal().push('Base Before'); } }),
      $base.After.new({ name: 'exec', do() { this.journal().push('Base After'); } }),
    ]
  });

  $base.Class.new({
    name: 'ModifierChildOverride',
    slots: [
      $.ModifierBase,
      $base.Method.new({ name: 'exec', override: true, do() { this.journal().push('Child Override Exec'); } }),
      $base.Before.new({ name: 'exec', do() { this.journal().push('Child Before'); } }),
      $base.After.new({ name: 'exec', do() { this.journal().push('Child After'); } }),
    ]
  });

  $test.Case.new({
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

  $base.Class.new({
    name: 'StaticTest',
    slots: [
      $base.Static.new({ name: 'frob', do(n) { return n * 2; } }),
      $base.Static.new({ name: 'combine', do(a, b) { return `${a}-${b}`; } })
    ]
  });

  $test.Case.new({
    name: 'StaticMethodCall',
    doc: 'Tests defining and calling static methods directly on the class.',
    do() {
      this.assertEq($.StaticTest.frob(3), 6, 'Static method call (frob) failed');
      this.assertEq($.StaticTest.combine('x', 'y'), 'x-y', 'Static method call (combine) failed');
    }
  });

  $test.Case.new({
    name: 'ClassExtend',
    doc: 'Tests extending a class with new methods/modifiers after its initial definition.',
    do() {
      $base.Class.new({
        name: 'Extendable',
        slots: [ $base.Method.new({ name: 'process', do(val) { return val; } }) ]
      });

      let sideEffect = 0;
      $.Extendable.extend($base.After.new({
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

  $base.Class.new({
    name: 'Task',
    slots: [
      $base.EnumVar.new({
        name: 'status',
        choices: ['pending', 'active', 'complete'],
        default: 'pending'
      })
    ]
  });

  $test.Case.new({
    name: 'EnumVarBasic',
    doc: 'Tests basic EnumVar functionality: default value and valid assignment.',
    do() {
      const t = $.Task.new();
      this.assertEq(t.status(), 'pending', 'Wrong default enum value');
      t.status('active');
      this.assertEq(t.status(), 'active', 'Failed to update enum value');
    }
  });

  $test.Case.new({
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

  $test.Case.new({
    name: 'EnumVarInvalidDefault',
    doc: 'Tests that defining an EnumVar with an invalid default value throws an error during class definition.',
    do() {
      const errorMessage = this.assertThrows(() => {
        $base.Class.new({
          name: 'BadTask',
          slots: [
            $base.EnumVar.new({
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

  $base.Class.new({
    name: 'VirtualBase',
    slots: [
      $base.Virtual.new({ name: 'mustImplement' }),
      $base.Method.new({ name: 'concreteMethod', do() { return 'Concrete'; } })
    ]
  });

  $test.Case.new({
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

  $base.Class.new({
    name: 'VirtualImpl',
    slots: [
      $.VirtualBase,
      $base.Method.new({ name: 'mustImplement', do() { return 'Implemented!'; } })
    ]
  });

  $test.Case.new({
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

  const moduleA = await function (_, $, $base) {
    $base.Class.new({
      name: 'Widget',
      slots: [
        $base.Var.new({ name: 'widgetProp', default: 'widget-abc' }),
        $base.Method.new({ name: 'ping', do() { return 'pong from Widget ' + this.name; } })
      ]
    });
    $.Widget.new({ name: 'globalWidget' });
  }.module({
    name: 'test.core.moduleA',
    imports: [base]
  }).load();

  const moduleB = await function (_, $, $base, $moduleA) {
    $base.Class.new({
      name: 'Gadget',
      slots: [
        $moduleA.Widget,
        $base.Var.new({ name: 'gadgetProp', default: 'gadget-xyz' }),
        $base.Method.new({ name: 'ping', override: true, do() { return 'pong from Gadget ' + this.name; } })
      ]
    });
  }.module({
    name: 'test.core.moduleB',
    imports: [base, moduleA]
  }).load();

  $test.Case.new({
    name: 'ModuleFindClassAcrossModules',
    doc: 'Tests finding a class definition from an imported module.',
    do() {
      const WidgetClass = moduleB.find('Class', 'Widget');
      this.assert(WidgetClass, 'Could not find Widget class definition via moduleB');
      this.assertEq(WidgetClass.name, 'Widget', 'Found class has incorrect name');

      const WidgetClassA = moduleA.find('Class', 'Widget');
      this.assertEq(WidgetClass, WidgetClassA, 'Class definitions found from different modules do not match');
    }
  });

   $test.Case.new({
    name: 'ModuleGetInstanceAcrossModules',
    doc: 'Tests retrieving a class instance defined in an imported module.',
    do() {
      const WidgetClass = moduleB.find('Class', 'Widget');
      this.assert(WidgetClass, 'Could not find Widget class definition');
    }
  });

  $test.Case.new({
    name: 'ModuleUseInheritedClassAcrossModules',
    doc: 'Tests creating and using an instance of a class that inherits from a class in another module.',
    do() {
      const $B = moduleB.$();
      const gadget = $B.Gadget.new({ name: 'myGadget' });

      this.assert(gadget, 'Failed to create Gadget instance');
      this.assertEq(gadget.name, 'myGadget', 'Gadget instance has wrong name');
      this.assertEq(gadget.gadgetProp(), 'gadget-xyz', 'Gadget instance missing own property');
      this.assertEq(gadget.ping(), 'pong from Gadget myGadget', 'Gadget overridden ping method failed');
      this.assertEq(gadget.widgetProp(), 'widget-abc', 'Gadget instance missing inherited property');

      const WidgetClass = moduleA.find('Class', 'Widget');
      this.assert(gadget.isa(WidgetClass), 'Gadget instance should report isa(Widget)');
      const GadgetClass = moduleB.find('Class', 'Gadget');
       this.assert(gadget.isa(GadgetClass), 'Gadget instance should report isa(Gadget)');
    }
  });

  $test.Case.new({
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

  $test.AsyncCase.new({
    name: 'Signal',
    async do() {
      const Counter = $base.Class.new({
        name: 'Counter',
        slots: [
          $base.Signal.new({ name: 'count', default: 0 }),
          $base.Method.new({
            name: 'inc',
            do() { this.count(this.count() + 1); }
          })
        ]
      });

      const c = Counter.new();
      let init = true;
      let ran = 0;
      const e = $base.Effect.create(() => {
        this.assertEq(c.count(), init ? 0 : 2);
        init = false;
        ran++;
      });
      c.inc();
      c.inc();
      await __.reactor().flush();
      this.assertEq(ran, 2);
    }
  });

  $base.Class.new({
    name: 'Message',
    slots: [
      $base.Var.new({ name: 'text' }),
      $base.Var.new({ name: 'count' }),
      $base.Var.new({ name: 'tags' }),
      $base.Var.new({ name: 'metadata' }),
      $base.Var.new({ name: 'callback' }),
    ]
  });

  $test.Case.new({
    name: 'JsonifyIncludesMetadata',
    doc: 'Tests that jsonify includes $class and $module metadata for object transport.',
    do() {
      const msg = $.Message.new({
        text: 'Hello',
        count: 42
      });
      const json = msg.jsonify();
      this.assertEq(json.$class, 'Message', 'jsonify should include $class');
      this.assertEq(json.$module, 'test.core', 'jsonify should include $module');
    }
  });

  $test.Case.new({
    name: 'JsonifySerializesAllSlots',
    doc: 'Tests that jsonify serializes all slot values, not just marked ones.',
    do() {
      const msg = $.Message.new({
        text: 'Test message',
        count: 123,
        tags: ['a', 'b', 'c'],
        metadata: { key: 'value' }
      });
      const json = msg.jsonify();
      this.assertEq(json.text, 'Test message', 'jsonify should serialize text');
      this.assertEq(json.count, 123, 'jsonify should serialize count');
      this.assertEq(json.tags.length, 3, 'jsonify should serialize arrays');
      this.assertEq(json.metadata.key, 'value', 'jsonify should serialize plain objects');
    }
  });

  $test.Case.new({
    name: 'JsonifyFiltersUnserializable',
    doc: 'Tests that jsonify filters out unserializable native JavaScript values like functions.',
    do() {
      const msg = $.Message.new({
        text: 'Test',
        callback: () => console.log('test')
      });
      const json = msg.jsonify();
      this.assert(!json.hasOwnProperty('callback'), 'jsonify should filter out functions');
      this.assertEq(json.text, 'Test', 'jsonify should still include serializable values');
    }
  });

  $base.Class.new({
    name: 'NestedMessage',
    slots: [
      $base.Var.new({ name: 'inner' }),
      $base.Var.new({ name: 'value' })
    ]
  });

  $test.Case.new({
    name: 'JsonifyHandlesNestedObjects',
    doc: 'Tests that jsonify properly handles nested objects with json() methods.',
    do() {
      const inner = $.Message.new({ text: 'inner', count: 1 });
      const outer = $.NestedMessage.new({
        inner: inner,
        value: 'outer'
      });
      const json = outer.jsonify();
      this.assertEq(json.$class, 'NestedMessage', 'outer object should have correct $class');
      this.assert(json.inner, 'jsonify should include nested object');
      this.assertEq(json.inner.text, 'inner', 'nested object should be serialized');
      this.assertEq(json.inner.$class, 'Message', 'nested object should have $class');
    }
  });

  $test.Case.new({
    name: 'JsonifyOnlyIncludesSetVars',
    doc: 'Tests that jsonify only includes Vars that have been explicitly set.',
    do() {
      const msg = $.Message.new({ text: 'Only text' });
      const json = msg.jsonify();
      this.assertEq(json.text, 'Only text', 'jsonify should include set value');
      this.assert(!json.hasOwnProperty('count'), 'jsonify should not include unset values');
      this.assert(!json.hasOwnProperty('tags'), 'jsonify should not include unset values');
    }
  });
}.module({
  name: 'test.core',
  imports: [base, test],
}).load();
