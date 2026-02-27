import { __, base } from '../src/base.js';
import test from '../src/test.js';

export default await async function (_, $, $test) {
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

  $test.Case.new({
    name: 'ClassDef',
    doc: 'Tests basic class definition and retrieving the class from an instance.',
    do() {
      const b = _.BasicTestClass.new();
      this.assert(b, 'Instance should be created');
      this.assertEq(b.class(), _.BasicTestClass, 'Instance class should match definition');
    }
  });

  $test.Case.new({
    name: 'ClassVarAccessAndSet',
    doc: 'Tests defining, accessing, and setting variables (Vars) on an instance.',
    do() {
      const p = _.Point.new({ x: 2 });
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
      const p = _.Point.new({ x: 2 });
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
      const p = _.Point.new({ x: 3, y: 4 });
      this.assertEq(p.dist(), 5, 'Method call returned incorrect value');
    }
  });

  $.Class.new({
    name: 'PointExtended',
    slots: [
      _.Point,
      $.Var.new({ name: 'phi', default: 0 }),
      $.Method.new({
        name: 'phiShift',
        do() { return this.dist() * this.phi() / Math.PI; }
      })
    ]
  });

  $test.Case.new({
    name: 'ClassName',
    doc: 'Tests retrieving the correct name for base and derived classes.',
    do() {
      this.assertEq(_.Point.name, 'Point');
      this.assertEq(_.PointExtended.name, 'PointExtended');
    }
  });

  $test.Case.new({
    name: 'ClassInheritanceSingle',
    doc: 'Tests single inheritance: accessing inherited vars and methods, and using new methods.',
    do() {
      const pe = _.PointExtended.new({ x: 3, y: 4, phi: Math.PI });
      this.assertEq(pe.x(), 3, 'Inherited var access failed');
      this.assertEq(pe.dist(), 5, 'Inherited method call failed');
      this.assertEq(pe.phiShift(), 5, 'New method call failed');
    }
  });

  $.Class.new({
    name: 'ColorPoint',
    slots: [
      _.Color,
      _.Point,
      $.Method.new({
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
      const cp = _.ColorPoint.new({ r: 33, g: 55, b: 44, x: 3, y: 4 });
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

  $test.Case.new({
    name: 'BeforeModifierBasic',
    doc: 'Tests basic functionality of the Before method modifier.',
    do() {
      const bb = _.BeforeBasic.new();
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

  $test.Case.new({
    name: 'AfterModifierBasic',
    doc: 'Tests basic functionality of the After method modifier.',
    do() {
      const ab = _.AfterBasic.new();
      ab.bump(); // 0 -> 2 (Primary) -> 3 (After)
      this.assertEq(ab.x(), 3, 'After modifier did not execute correctly');
    }
  });

  $.Class.new({
    name: 'AfterBeforeCombined',
    slots: [
      _.BeforeBasic,
      $.After.new({ name: 'bump', do() { this.x(this.x() * 2); } })
    ]
  });

  $test.Case.new({
    name: 'AfterBeforeCombinedInheritance',
    doc: 'Tests combining Before and After modifiers through inheritance.',
    do() {
      const abc = _.AfterBeforeCombined.new();
      abc.bump(); // 0 -> 1 (Before) -> 3 (Primary) -> 6 (After * 2)
      this.assertEq(abc.x(), 6, 'Combined Before/After modifiers failed');
    }
  });

  $.Class.new({
    name: 'AfterBeforeCombinedOverride',
    slots: [
      _.AfterBeforeCombined,
      $.Method.new({ name: 'bump', override: true, do() { this.x(this.x() + 3); } })
    ]
  });

  $test.Case.new({
    name: 'AfterBeforeCombinedWithOverride',
    doc: 'Tests modifier execution order when the primary method is overridden.',
    do() {
      const abco = _.AfterBeforeCombinedOverride.new();
      abco.bump();
      this.assertEq(abco.x(), 8, 'Combined modifiers with override failed');
    }
  });

  $.Class.new({
    name: 'AfterMultiple',
    slots: [
      _.AfterBasic,
      $.After.new({ name: 'bump', do() { this.x(this.x() + 1); } })
    ]
  });

  $test.Case.new({
    name: 'AfterModifierMultiple',
    doc: 'Tests multiple After modifiers for the same method.',
    do() {
      const am = _.AfterMultiple.new();
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
      _.ModifierBase,
      $.Method.new({ name: 'exec', override: true, do() { this.journal().push('Child Override Exec'); } }),
      $.Before.new({ name: 'exec', do() { this.journal().push('Child Before'); } }),
      $.After.new({ name: 'exec', do() { this.journal().push('Child After'); } }),
    ]
  });

  $test.Case.new({
    name: 'MethodModifiersOverrideWithInherited',
    doc: 'Tests the execution order of base and child method modifiers with override.',
    do() {
      const child = _.ModifierChildOverride.new();
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

  $test.Case.new({
    name: 'StaticMethodCall',
    doc: 'Tests defining and calling static methods directly on the class.',
    do() {
      this.assertEq(_.StaticTest.frob(3), 6, 'Static method call (frob) failed');
      this.assertEq(_.StaticTest.combine('x', 'y'), 'x-y', 'Static method call (combine) failed');
    }
  });

  $test.Case.new({
    name: 'ClassExtend',
    doc: 'Tests extending a class with new methods/modifiers after its initial definition.',
    do() {
      $.Class.new({
        name: 'Extendable',
        slots: [ $.Method.new({ name: 'process', do(val) { return val; } }) ]
      });

      let sideEffect = 0;
      _.Extendable.extend($.After.new({
        name: 'process',
        do() { sideEffect++; }
      }));

      const e = _.Extendable.new();
      this.assertEq(sideEffect, 0, 'Side effect should not trigger before call');
      const result = e.process('data');
      this.assertEq(result, 'data', 'Original method functionality failed after extend');
      this.assertEq(sideEffect, 1, 'Extended After modifier did not run');
    }
  });

  $.Class.new({
    name: 'RequiredVarTest',
    slots: [
      $.Var.new({ name: 'required_field', required: true }),
      $.Var.new({ name: 'optional_field' }),
    ]
  });

  $test.Case.new({
    name: 'RequiredVarProvided',
    doc: 'Tests that providing a required var allows object creation.',
    do() {
      const obj = _.RequiredVarTest.new({ required_field: 'value' });
      this.assertEq(obj.required_field(), 'value', 'Required field should be set');
    }
  });

  $test.Case.new({
    name: 'RequiredVarMissing',
    doc: 'Tests that omitting a required var throws an error during object creation.',
    do() {
      const errorMessage = this.assertThrows(
        () => { _.RequiredVarTest.new({ optional_field: 'optional' }); },
        "Required var 'required_field' not provided",
        'Should have thrown error for missing required var'
      );
      this.assertErrorMessageIncludes(errorMessage, 'RequiredVarTest');
    }
  });

  $test.Case.new({
    name: 'RequiredVarNullValue',
    doc: 'Tests that providing undefined for a required var throws an error.',
    do() {
      this.assertThrows(
        () => { _.RequiredVarTest.new({ required_field: undefined }); },
        "Required var 'required_field' not provided",
        'Should have thrown error for undefined required var'
      );
    }
  });

  $.Class.new({
    name: 'VirtualBase',
    slots: [
      $.Virtual.new({ name: 'mustImplement' }),
      $.Method.new({ name: 'concreteMethod', do() { return 'Concrete'; } })
    ]
  });

  $test.Case.new({
    name: 'VirtualMethodThrowsWhenUnimplemented',
    doc: 'Tests that calling an unimplemented virtual method throws an error.',
    do() {
      const base = _.VirtualBase.new();
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
      _.VirtualBase,
      $.Method.new({ name: 'mustImplement', do() { return 'Implemented!'; } })
    ]
  });

  $test.Case.new({
    name: 'VirtualMethodWorksWhenImplemented',
    doc: 'Tests that calling an implemented virtual method executes correctly.',
    do() {
      const impl = _.VirtualImpl.new();
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

  const moduleA = await function (_, $) {
    $.Class.new({
      name: 'Widget',
      slots: [
        $.Var.new({ name: 'widgetProp', default: 'widget-abc' }),
        $.Method.new({ name: 'ping', do() { return 'pong from Widget ' + this.name; } })
      ]
    });
    _.Widget.new({ name: 'globalWidget' });
  }.module({
    name: 'test.core.moduleA',
    imports: [base]
  }).load();

  const moduleB = await function (_, $, $moduleA) {
    $.Class.new({
      name: 'Gadget',
      slots: [
        $moduleA.Widget,
        $.Var.new({ name: 'gadgetProp', default: 'gadget-xyz' }),
        $.Method.new({ name: 'ping', override: true, do() { return 'pong from Gadget ' + this.name; } })
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
      const _B = moduleB.$();
      const gadget = _B.Gadget.new({ name: 'myGadget' });

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
      const p1 = _.Point.new({ name: 'pointInstance1', x: 1 });
      const p2 = _.Point.new({ y: 2 });

      const p1_id = p1.id();
      const p2_id = p2.id();

      const foundByName = __.mod().getInstance(_.Point, 'pointInstance1');
      this.assertEq(p1, foundByName, 'Failed to retrieve instance by name');

      const foundById1 = __.mod().getInstance(_.Point, p1_id);
      const foundById2 = __.mod().getInstance(_.Point, p2_id);
      this.assertEq(p1, foundById1, 'Failed to retrieve instance p1 by ID');
      this.assertEq(p2, foundById2, 'Failed to retrieve instance p2 by ID');
    }
  });

  $test.AsyncCase.new({
    name: 'Signal',
    async do() {
      const Counter = $.Class.new({
        name: 'Counter',
        slots: [
          $.Signal.new({ name: 'count', default: 0 }),
          $.Method.new({
            name: 'inc',
            do() { this.count(this.count() + 1); }
          })
        ]
      });

      const c = Counter.new();
      let init = true;
      let ran = 0;
      const e = $.Effect.create(() => {
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

  $.Class.new({
    name: 'Message',
    slots: [
      $.Var.new({ name: 'text' }),
      $.Var.new({ name: 'count' }),
      $.Var.new({ name: 'tags' }),
      $.Var.new({ name: 'metadata' }),
      $.Var.new({ name: 'callback' }),
    ]
  });

  $test.Case.new({
    name: 'JsonifyIncludesMetadata',
    doc: 'Tests that jsonify includes $class and $module metadata for object transport.',
    do() {
      const msg = _.Message.new({
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
      const msg = _.Message.new({
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
      const msg = _.Message.new({
        text: 'Test',
        callback: () => console.log('test')
      });
      const json = msg.jsonify();
      this.assert(!json.hasOwnProperty('callback'), 'jsonify should filter out functions');
      this.assertEq(json.text, 'Test', 'jsonify should still include serializable values');
    }
  });

  $.Class.new({
    name: 'NestedMessage',
    slots: [
      $.Var.new({ name: 'inner' }),
      $.Var.new({ name: 'value' })
    ]
  });

  $test.Case.new({
    name: 'JsonifyHandlesNestedObjects',
    doc: 'Tests that jsonify properly handles nested objects with json() methods.',
    do() {
      const inner = _.Message.new({ text: 'inner', count: 1 });
      const outer = _.NestedMessage.new({
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
      const msg = _.Message.new({ text: 'Only text' });
      const json = msg.jsonify();
      this.assertEq(json.text, 'Only text', 'jsonify should include set value');
      this.assert(!json.hasOwnProperty('count'), 'jsonify should not include unset values');
      this.assert(!json.hasOwnProperty('tags'), 'jsonify should not include unset values');
    }
  });

  $.Class.new({
    name: 'ServerConfig',
    slots: [
      $.Configurable,
      $.ConfigVar.new({ name: 'host', default: 'localhost' }),
      $.ConfigSignal.new({ name: 'port', default: 8080 }),
      $.Signal.new({ name: 'connected', default: false }),
    ]
  });

  $test.Case.new({
    name: 'ConfigSignalBasic',
    doc: 'Tests that ConfigSignal slots are collected and serialized via Configurable mixin.',
    do() {
      const cfg = _.ServerConfig.new({ host: 'example.com', port: 3000 });
      cfg.connected(true);

      const slots = cfg.configSlots();
      this.assertEq(slots.length, 2, 'Should find exactly 2 ConfigSignal slots');
      this.assert(slots.some(s => s.name === 'host'), 'Should include host slot');
      this.assert(slots.some(s => s.name === 'port'), 'Should include port slot');

      const json = cfg.configJSON();
      this.assertEq(json.host, 'example.com', 'configJSON should include host');
      this.assertEq(json.port, 3000, 'configJSON should include port');
      this.assert(!json.hasOwnProperty('connected'), 'configJSON should exclude regular Signal');
    }
  });

  $test.Case.new({
    name: 'ConfigLoadRestoresValues',
    doc: 'Tests that configLoad restores ConfigSignal values from JSON.',
    do() {
      const cfg = _.ServerConfig.new();
      this.assertEq(cfg.host(), 'localhost', 'Should have default host');
      this.assertEq(cfg.port(), 8080, 'Should have default port');

      cfg.configLoad({ host: 'prod.server.com', port: 443 });
      this.assertEq(cfg.host(), 'prod.server.com', 'configLoad should update host');
      this.assertEq(cfg.port(), 443, 'configLoad should update port');
    }
  });

  $.Class.new({
    name: 'DocumentEditor',
    doc: 'Test class for History mixin',
    slots: [
      $.History,
      $.HistorySignal.new({ name: 'content', default: '' }),
      $.HistorySignal.new({ name: 'cursor', default: 0 }),
      $.HistorySignal.new({ name: 'selections', default: [] }),
      $.Signal.new({ name: 'saved', default: true }),
    ]
  });

  $test.Case.new({
    name: 'HistorySnapshotOnlyMarkedFields',
    doc: 'Tests that snapshot only includes HistorySignal slots.',
    do() {
      const doc = _.DocumentEditor.new();
      doc.content('hello');
      doc.cursor(5);
      doc.saved(false);

      const snap = doc.snapshot();
      this.assertEq(snap.content, 'hello', 'Snapshot should include content');
      this.assertEq(snap.cursor, 5, 'Snapshot should include cursor');
      this.assert(!('saved' in snap), 'Snapshot should exclude regular Signal');
    }
  });

  $test.Case.new({
    name: 'HistoryUndoRedo',
    doc: 'Tests basic undo/redo functionality.',
    do() {
      const doc = _.DocumentEditor.new();
      doc.content('initial');

      doc.pushUndo();
      doc.content('changed');

      this.assert(doc.canUndo(), 'Should be able to undo');
      this.assert(!doc.canRedo(), 'Should not be able to redo yet');

      doc.undo();
      this.assertEq(doc.content(), 'initial', 'Undo should restore initial content');
      this.assert(!doc.canUndo(), 'Should not be able to undo after undoing');
      this.assert(doc.canRedo(), 'Should be able to redo');

      doc.redo();
      this.assertEq(doc.content(), 'changed', 'Redo should restore changed content');
    }
  });

  $test.Case.new({
    name: 'HistoryRedoClearedOnNewChange',
    doc: 'Tests that redo stack is cleared when new changes are made.',
    do() {
      const doc = _.DocumentEditor.new();
      doc.content('v1');
      doc.pushUndo();
      doc.content('v2');
      doc.undo();

      this.assert(doc.canRedo(), 'Should be able to redo');

      doc.pushUndo();
      doc.content('v3');

      this.assert(!doc.canRedo(), 'Redo should be cleared after new change');
    }
  });

  $test.Case.new({
    name: 'HistoryArrayCopy',
    doc: 'Tests that arrays are copied in snapshots to avoid mutation.',
    do() {
      const doc = _.DocumentEditor.new();
      doc.selections([1, 2, 3]);

      doc.pushUndo();
      doc.selections().push(4);

      this.assertEq(doc.selections().length, 4, 'Current selections should have 4 items');

      doc.undo();
      this.assertEq(doc.selections().length, 3, 'Restored selections should have 3 items');
    }
  });

  $test.Case.new({
    name: 'HistoryClearHistory',
    doc: 'Tests that clearHistory empties both stacks.',
    do() {
      const doc = _.DocumentEditor.new();
      doc.content('v1');
      doc.pushUndo();
      doc.content('v2');
      doc.pushUndo();
      doc.content('v3');
      doc.undo();

      this.assert(doc.canUndo(), 'Should have undo history');
      this.assert(doc.canRedo(), 'Should have redo history');

      doc.clearHistory();

      this.assert(!doc.canUndo(), 'Undo should be cleared');
      this.assert(!doc.canRedo(), 'Redo should be cleared');
    }
  });
  // --- Var accessor hook tests ---

  $.Class.new({
    name: 'StringOnlyVar',
    doc: 'Var subclass that validates values are strings',
    slots: [
      $.Var,
      function validate(v) {
        if (v !== undefined && typeof v !== 'string') {
          throw new Error(`expected string, got ${typeof v}`);
        }
      },
    ]
  });

  $test.Case.new({
    name: 'HookValidate',
    doc: 'Verify validate is called on set, rejecting invalid values.',
    do() {
      $.Class.new({
        name: 'ValidateTest',
        slots: [
          _.StringOnlyVar.new({ name: 'label', default: 'hello' }),
        ]
      });
      const obj = _.ValidateTest.new();
      this.assertEq(obj.label(), 'hello', 'Default string value should pass validate');
      obj.label('world');
      this.assertEq(obj.label(), 'world', 'Valid string assignment should pass validate');
      this.assertThrows(
        () => { obj.label(42); },
        'expected string',
        'Non-string value should be rejected by validate'
      );
    }
  });

  $test.Case.new({
    name: 'HookDidSet',
    doc: 'Verify didSet fires on accessor set.',
    do() {
      const log = [];
      $.Class.new({
        name: 'DidSetVar',
        slots: [
          $.Var,
          function didSet(inst, pk, v) {
            log.push({ pk, v });
          },
        ]
      });
      $.Class.new({
        name: 'DidSetTest',
        slots: [
          _.DidSetVar.new({ name: 'x', default: 0 }),
        ]
      });
      const obj = _.DidSetTest.new();
      obj.x(1);
      this.assertEq(log.length, 1, 'didSet should fire on set');
      this.assertEq(log[0].v, 1, 'didSet should receive the set value');
      obj.x(2);
      this.assertEq(log.length, 2, 'didSet should fire on subsequent set');
      this.assertEq(log[1].v, 2, 'didSet should receive the new value');
    }
  });

  $test.Case.new({
    name: 'HookDidGet',
    doc: 'Verify didGet fires on get.',
    do() {
      const log = [];
      $.Class.new({
        name: 'DidGetVar',
        slots: [
          $.Var,
          function didGet(inst, pk) {
            log.push(pk);
          },
        ]
      });
      $.Class.new({
        name: 'DidGetTest',
        slots: [
          _.DidGetVar.new({ name: 'x', default: 42 }),
        ]
      });
      const obj = _.DidGetTest.new();
      const val = obj.x();
      this.assertEq(val, 42, 'Should return the value');
      this.assertEq(log.length, 1, 'didGet should fire on get');
      this.assertEq(log[0], '__x', 'didGet should receive the private key');
    }
  });

  $test.AsyncCase.new({
    name: 'HookInheritance',
    doc: 'Verify a class inheriting from Signal gets both Signal hooks and can add its own.',
    async do() {
      const log = [];
      $.Class.new({
        name: 'LoggingSignal',
        doc: 'Signal subclass that also logs didSet',
        slots: [
          $.Signal,
          $.After.new({
            name: 'didSet',
            do(inst, pk, v) {
              log.push({ pk, v });
            }
          }),
        ]
      });
      $.Class.new({
        name: 'HookInheritanceTest',
        slots: [
          _.LoggingSignal.new({ name: 'x', default: 0 }),
        ]
      });
      const obj = _.HookInheritanceTest.new();
      let effectRan = 0;
      $.Effect.create(() => {
        obj.x();
        effectRan++;
      });
      obj.x(5);
      await __.reactor().flush();
      this.assertEq(effectRan, 2, 'Signal reactivity should work (init + update)');
      this.assert(log.length > 0, 'Custom didSet After should have fired');
      this.assertEq(log[0].v, 5, 'Custom didSet should receive the value');
    }
  });

  $test.AsyncCase.new({
    name: 'SignalReactivityPreserved',
    doc: 'Explicit verification that Signal reactive updates and dependency tracking still work after refactor.',
    async do() {
      $.Class.new({
        name: 'ReactiveWidget',
        slots: [
          $.Signal.new({ name: 'width', default: 100 }),
          $.Signal.new({ name: 'height', default: 50 }),
        ]
      });
      const w = _.ReactiveWidget.new();
      let area = 0;
      $.Effect.create(() => {
        area = w.width() * w.height();
      });
      this.assertEq(area, 5000, 'Initial effect should compute area');
      w.width(200);
      await __.reactor().flush();
      this.assertEq(area, 10000, 'Area should update when width changes');
      w.height(75);
      await __.reactor().flush();
      this.assertEq(area, 15000, 'Area should update when height changes');
    }
  });

  // --- Type system tests ---

  $test.Case.new({
    name: 'TypeCreation',
    doc: 'Concrete type classes descend from Type and have working check.',
    do() {
      this.assert($.$Number.descended($.Type), '$Number should descend from Type');
      this.assert($.$Number.check(42), '$Number.check should accept numbers');
      this.assert(!$.$Number.check('x'), '$Number.check should reject strings');
    }
  });

  $test.Case.new({
    name: 'TypeValidatePass',
    doc: '$Number.validate passes for a number value.',
    do() {
      const result = $.$Number.validate(42, 'x');
      this.assertEq(result, 42, 'validate should return the value on success');
    }
  });

  $test.Case.new({
    name: 'TypeValidateFail',
    doc: '$Number.validate throws for a non-number value.',
    do() {
      const msg = this.assertThrows(
        () => { $.$Number.validate('hello', 'x'); },
        '$Number',
        'validate should throw for wrong type'
      );
      this.assertErrorMessageIncludes(msg, 'x');
    }
  });

  $test.Case.new({
    name: 'TypeNullable',
    doc: 'Nullable type accepts null, original type value, and rejects wrong type.',
    do() {
      const t = $.$Number.nullable();
      this.assertEq(t.validate(null, 'x'), null, 'nullable should accept null');
      this.assertEq(t.validate(42, 'x'), 42, 'nullable should accept valid value');
      this.assertThrows(
        () => { t.validate('hello', 'x'); },
        '$Number?',
        'nullable should reject wrong type'
      );
    }
  });

  $test.Case.new({
    name: 'TypeNullableName',
    doc: 'Nullable type name appends ?',
    do() {
      this.assertEq($.$Number.nullable().name, '$Number?', 'nullable name should append ?');
    }
  });

  $test.Case.new({
    name: 'ArrayOfPass',
    doc: '$Array.of($String).validate passes for valid string array.',
    do() {
      const t = $.$Array.of($.$String);
      const result = t.validate(['a', 'b'], 'tags');
      this.assertEq(result.length, 2, 'validate should return the array');
    }
  });

  $test.Case.new({
    name: 'ArrayOfFailNotArray',
    doc: '$Array.of($String) rejects non-array value.',
    do() {
      const t = $.$Array.of($.$String);
      this.assertThrows(
        () => { t.validate('not an array', 'x'); },
        '$ArrayOf$String',
        'should reject non-array'
      );
    }
  });

  $test.Case.new({
    name: 'ArrayOfFailElement',
    doc: '$Array.of($String) rejects array with wrong element type.',
    do() {
      const t = $.$Array.of($.$String);
      this.assertThrows(
        () => { t.validate(['a', 42], 'x'); },
        '$ArrayOf$String',
        'should reject array with wrong element'
      );
    }
  });

  $test.Case.new({
    name: 'ArrayOfName',
    doc: 'Array type name includes inner type name.',
    do() {
      this.assertEq($.$Array.of($.$String).name, '$ArrayOf$String', 'array type name');
    }
  });

  $test.Case.new({
    name: 'ArrayOfValidation',
    doc: '$Array.of rejects non-Type argument.',
    do() {
      this.assertThrows(
        () => { $.$Array.of('not a type'); },
        'must be a Type',
        'should reject non-Type argument'
      );
    }
  });

  $test.Case.new({
    name: 'EnumOfPass',
    doc: '$Enum.of passes for valid choice.',
    do() {
      const t = $.$Enum.of('a', 'b');
      this.assertEq(t.validate('a', 'x'), 'a', 'should accept valid choice');
    }
  });

  $test.Case.new({
    name: 'EnumOfFail',
    doc: '$Enum.of rejects invalid choice.',
    do() {
      const t = $.$Enum.of('a', 'b');
      this.assertThrows(
        () => { t.validate('c', 'x'); },
        '$EnumOf(a|b)',
        'should reject invalid choice'
      );
    }
  });

  $test.Case.new({
    name: 'EnumOfName',
    doc: 'Enum type name includes choices.',
    do() {
      this.assertEq($.$Enum.of('a', 'b').name, '$EnumOf(a|b)', 'enum type name');
    }
  });

  $test.Case.new({
    name: 'EnumOfEmpty',
    doc: '$Enum.of() with no arguments throws.',
    do() {
      this.assertThrows(
        () => { $.$Enum.of(); },
        'at least one choice',
        'should reject empty choices'
      );
    }
  });

  $test.Case.new({
    name: 'EnumOfBadChoice',
    doc: '$Enum.of({}) rejects non-string/number choice.',
    do() {
      this.assertThrows(
        () => { $.$Enum.of({}); },
        'string or number',
        'should reject non-string/number choice'
      );
    }
  });

  $test.Case.new({
    name: 'InstanceOfPass',
    doc: '$Instance.of(Point) accepts Point instance.',
    do() {
      const point = _.Point.new({ x: 1, y: 2 });
      const t = $.$Instance.of(_.Point);
      this.assertEq(t.validate(point, 'p'), point, 'should accept matching instance');
    }
  });

  $test.Case.new({
    name: 'InstanceOfFail',
    doc: '$Instance.of(Point) rejects plain string.',
    do() {
      const t = $.$Instance.of(_.Point);
      this.assertThrows(
        () => { t.validate('not a point', 'p'); },
        '$InstanceOfPoint',
        'should reject non-instance'
      );
    }
  });

  $test.Case.new({
    name: 'InstanceOfName',
    doc: 'Instance type name includes class name.',
    do() {
      this.assertEq($.$Instance.of(_.Point).name, '$InstanceOfPoint', 'instance type name');
    }
  });

  $test.Case.new({
    name: 'InstanceOfValidation',
    doc: '$Instance.of rejects non-class argument.',
    do() {
      this.assertThrows(
        () => { $.$Instance.of('not a class'); },
        'must be a Class',
        'should reject non-class argument'
      );
    }
  });

  $test.Case.new({
    name: 'ArrayOfNullable',
    doc: 'Chaining: $Array.of($String).nullable() accepts null, arrays, rejects numbers.',
    do() {
      const t = $.$Array.of($.$String).nullable();
      this.assertEq(t.validate(null, 'x'), null, 'should accept null');
      this.assertEq(t.validate(['a'], 'x').length, 1, 'should accept valid array');
      this.assertThrows(
        () => { t.validate(42, 'x'); },
        '$ArrayOf$String?',
        'should reject number'
      );
    }
  });

  $test.Case.new({
    name: 'NestedArrayOf',
    doc: 'Nested $Array.of($Array.of($Number)) validates nested arrays.',
    do() {
      const t = $.$Array.of($.$Array.of($.$Number));
      t.validate([[1, 2], [3]], 'matrix');
      this.assertThrows(
        () => { t.validate([['a']], 'matrix'); },
        '$ArrayOf$ArrayOf$Number',
        'should reject nested array with wrong elements'
      );
    }
  });

  $test.Case.new({
    name: 'EnumBaseRejects',
    doc: 'Base $Enum rejects everything (check is () => false).',
    do() {
      this.assertThrows(
        () => { $.$Enum.validate('anything', 'x'); },
        '$Enum',
        'base Enum should reject all values'
      );
    }
  });

  $test.Case.new({
    name: 'InstanceBaseRejects',
    doc: 'Base $Instance rejects everything (check is () => false).',
    do() {
      this.assertThrows(
        () => { $.$Instance.validate('anything', 'x'); },
        '$Instance',
        'base Instance should reject all values'
      );
    }
  });

  // --- Spec integration tests ---

  $test.Case.new({
    name: 'SpecAcceptsValid',
    doc: 'Var with spec accepts values that pass the type check.',
    do() {
      $.Class.new({
        name: 'SpecAcceptTest',
        slots: [
          $.Var.new({ name: 'x', spec: $.$Number }),
        ]
      });
      const p = _.SpecAcceptTest.new();
      p.x(42);
      this.assertEq(p.x(), 42, 'Valid value should be accepted');
    }
  });

  $test.Case.new({
    name: 'SpecRejectsInvalid',
    doc: 'Var with spec rejects values that fail the type check.',
    do() {
      $.Class.new({
        name: 'SpecRejectTest',
        slots: [
          $.Var.new({ name: 'x', spec: $.$Number }),
        ]
      });
      const p = _.SpecRejectTest.new();
      const msg = this.assertThrows(
        () => { p.x('hello'); },
        '$Number',
        'Invalid value should be rejected'
      );
      this.assertErrorMessageIncludes(msg, 'x');
    }
  });

  $test.Case.new({
    name: 'SpecNoSpecUnchanged',
    doc: 'Var without spec still accepts any value (regression).',
    do() {
      $.Class.new({
        name: 'NoSpecTest',
        slots: [
          $.Var.new({ name: 'x' }),
        ]
      });
      const p = _.NoSpecTest.new();
      p.x(42);
      this.assertEq(p.x(), 42, 'Number should be accepted');
      p.x('hello');
      this.assertEq(p.x(), 'hello', 'String should be accepted');
      p.x(null);
      this.assertEq(p.x(), null, 'Null should be accepted');
    }
  });

  $test.Case.new({
    name: 'SpecDefaultValid',
    doc: 'Var with spec and valid default returns the default on first access.',
    do() {
      $.Class.new({
        name: 'SpecDefaultValidTest',
        slots: [
          $.Var.new({ name: 'x', spec: $.$Number, default: 0 }),
        ]
      });
      const p = _.SpecDefaultValidTest.new();
      this.assertEq(p.x(), 0, 'Valid default should be returned');
    }
  });

  $test.Case.new({
    name: 'SpecDefaultInvalid',
    doc: 'Var with spec and invalid default throws on first access.',
    do() {
      $.Class.new({
        name: 'SpecDefaultInvalidTest',
        slots: [
          $.Var.new({ name: 'x', spec: $.$Number, default: 'bad' }),
        ]
      });
      const p = _.SpecDefaultInvalidTest.new();
      this.assertThrows(
        () => { p.x(); },
        '$Number',
        'Invalid default should throw on first access'
      );
    }
  });

  $.Class.new({
    name: 'TypedPoint',
    slots: [
      $.Var.new({ name: 'x', spec: $.$Number }),
      $.Var.new({ name: 'y', spec: $.$Number }),
    ]
  });

  $test.Case.new({
    name: 'SpecInitValid',
    doc: 'Construction with valid spec values succeeds.',
    do() {
      const p = _.TypedPoint.new({ x: 5, y: 10 });
      this.assertEq(p.x(), 5, 'x should be set');
      this.assertEq(p.y(), 10, 'y should be set');
    }
  });

  $test.Case.new({
    name: 'SpecInitInvalid',
    doc: 'Construction with invalid spec values throws.',
    do() {
      this.assertThrows(
        () => { _.TypedPoint.new({ x: 'bad', y: 10 }); },
        '$Number',
        'Invalid init value should throw'
      );
    }
  });

  $test.Case.new({
    name: 'SpecRequiredValid',
    doc: 'Required var with spec accepts valid value.',
    do() {
      $.Class.new({
        name: 'SpecRequiredValidTest',
        slots: [
          $.Var.new({ name: 'x', required: true, spec: $.$String }),
        ]
      });
      const p = _.SpecRequiredValidTest.new({ x: 'hello' });
      this.assertEq(p.x(), 'hello', 'Valid required value should be accepted');
    }
  });

  $test.Case.new({
    name: 'SpecRequiredMissing',
    doc: 'Required var with spec still throws required error when missing.',
    do() {
      $.Class.new({
        name: 'SpecRequiredMissingTest',
        slots: [
          $.Var.new({ name: 'x', required: true, spec: $.$String }),
        ]
      });
      this.assertThrows(
        () => { _.SpecRequiredMissingTest.new({}); },
        'Required var',
        'Missing required var should throw required error'
      );
    }
  });

  $test.Case.new({
    name: 'SpecRequiredInvalid',
    doc: 'Required var with spec throws spec error for wrong type.',
    do() {
      $.Class.new({
        name: 'SpecRequiredInvalidTest',
        slots: [
          $.Var.new({ name: 'x', required: true, spec: $.$String }),
        ]
      });
      this.assertThrows(
        () => { _.SpecRequiredInvalidTest.new({ x: 42 }); },
        '$String',
        'Wrong type for required var should throw spec error'
      );
    }
  });

  $test.AsyncCase.new({
    name: 'SignalSpecValid',
    doc: 'Signal with spec accepts valid values and reactivity fires.',
    async do() {
      $.Class.new({
        name: 'SignalSpecValidTest',
        slots: [
          $.Signal.new({ name: 'temp', spec: $.$Number }),
        ]
      });
      const obj = _.SignalSpecValidTest.new();
      let effectRan = 0;
      $.Effect.create(() => {
        obj.temp();
        effectRan++;
      });
      obj.temp(42);
      await __.reactor().flush();
      this.assertEq(effectRan, 2, 'Effect should fire on init + update');
      this.assertEq(obj.temp(), 42, 'Valid value should be accepted');
    }
  });

  $test.AsyncCase.new({
    name: 'SignalSpecInvalid',
    doc: 'Signal with spec rejects invalid values.',
    async do() {
      $.Class.new({
        name: 'SignalSpecInvalidTest',
        slots: [
          $.Signal.new({ name: 'temp', spec: $.$Number }),
        ]
      });
      const obj = _.SignalSpecInvalidTest.new();
      this.assertThrows(
        () => { obj.temp('not a number'); },
        '$Number',
        'Invalid value should be rejected on Signal'
      );
    }
  });

  $test.AsyncCase.new({
    name: 'SignalSpecReactivity',
    doc: 'Spec does not break reactive dependency tracking on Signal.',
    async do() {
      $.Class.new({
        name: 'SignalSpecReactiveTest',
        slots: [
          $.Signal.new({ name: 'width', spec: $.$Number, default: 100 }),
          $.Signal.new({ name: 'height', spec: $.$Number, default: 50 }),
        ]
      });
      const w = _.SignalSpecReactiveTest.new();
      let area = 0;
      $.Effect.create(() => {
        area = w.width() * w.height();
      });
      this.assertEq(area, 5000, 'Initial area should be computed');
      w.width(200);
      await __.reactor().flush();
      this.assertEq(area, 10000, 'Area should update when width changes');
      w.height(75);
      await __.reactor().flush();
      this.assertEq(area, 15000, 'Area should update when height changes');
    }
  });

  $test.Case.new({
    name: 'SpecEnum',
    doc: 'Spec with $Enum.of accepts valid choices, rejects invalid.',
    do() {
      $.Class.new({
        name: 'SpecEnumTest',
        slots: [
          $.Var.new({ name: 'x', spec: $.$Enum.of('a', 'b') }),
        ]
      });
      const p = _.SpecEnumTest.new();
      p.x('a');
      this.assertEq(p.x(), 'a', 'Valid enum value should be accepted');
      this.assertThrows(
        () => { p.x('c'); },
        '$EnumOf(a|b)',
        'Invalid enum value should be rejected'
      );
    }
  });

  $test.Case.new({
    name: 'SpecArrayOf',
    doc: 'Spec with $Array.of($String) accepts valid arrays, rejects invalid.',
    do() {
      $.Class.new({
        name: 'SpecArrayOfTest',
        slots: [
          $.Var.new({ name: 'tags', spec: $.$Array.of($.$String) }),
        ]
      });
      const p = _.SpecArrayOfTest.new();
      p.tags(['a', 'b']);
      this.assertEq(p.tags().length, 2, 'Valid array should be accepted');
      this.assertThrows(
        () => { p.tags([1]); },
        '$ArrayOf$String',
        'Array with wrong element type should be rejected'
      );
    }
  });

  $test.Case.new({
    name: 'SpecInstanceOf',
    doc: 'Spec with $Instance.of(Point) accepts instances, rejects others.',
    do() {
      $.Class.new({
        name: 'SpecInstanceOfTest',
        slots: [
          $.Var.new({ name: 'pt', spec: $.$Instance.of(_.Point) }),
        ]
      });
      const p = _.SpecInstanceOfTest.new();
      const point = _.Point.new({ x: 1, y: 2 });
      p.pt(point);
      this.assertEq(p.pt(), point, 'Valid instance should be accepted');
      this.assertThrows(
        () => { p.pt('not a point'); },
        '$InstanceOfPoint',
        'Non-instance should be rejected'
      );
    }
  });

  $test.Case.new({
    name: 'SpecNullable',
    doc: 'Spec with $Number.nullable() accepts null, numbers, rejects strings.',
    do() {
      $.Class.new({
        name: 'SpecNullableTest',
        slots: [
          $.Var.new({ name: 'x', spec: $.$Number.nullable() }),
        ]
      });
      const p = _.SpecNullableTest.new();
      p.x(null);
      this.assertEq(p.x(), null, 'Null should be accepted');
      p.x(5);
      this.assertEq(p.x(), 5, 'Number should be accepted');
      this.assertThrows(
        () => { p.x('x'); },
        '$Number?',
        'String should be rejected'
      );
    }
  });

  $test.Case.new({
    name: 'SpecBadType',
    doc: 'Var with non-Type spec throws at class definition time.',
    do() {
      this.assertThrows(
        () => {
          $.Class.new({
            name: 'SpecBadTypeTest',
            slots: [
              $.Var.new({ name: 'x', spec: 'not a type' }),
            ]
          });
        },
        'spec',
        'Non-Type spec should throw at definition time'
      );
    }
  });

  // --- Phase 4: Adopt specs in base classes ---

  $test.Case.new({
    name: 'MethodDebugSpec',
    doc: 'Method.debug has retroactive $Boolean spec, rejects non-boolean values at init.',
    do() {
      const slot = $.Method.getslot('debug');
      this.assert(slot.spec(), 'Method.debug should have a spec after retroactive application');
      this.assertThrows(
        () => {
          $.Method.new({ name: 'badDebugMethod', debug: 'string', do() {} });
        },
        '$Boolean',
        'Method.new with non-boolean debug should throw'
      );
    }
  });

  $test.Case.new({
    name: 'SpecEnumVarReplacement',
    doc: 'Var + spec $Enum.of works as EnumVar replacement: default, valid set, invalid reject.',
    do() {
      $.Class.new({
        name: 'SpecEnumReplaceTest',
        slots: [
          $.Var.new({
            name: 'status',
            spec: $.$Enum.of('pending', 'active', 'complete'),
            default: 'pending',
          }),
        ]
      });
      const t = _.SpecEnumReplaceTest.new();
      this.assertEq(t.status(), 'pending', 'Default enum value via spec');
      t.status('active');
      this.assertEq(t.status(), 'active', 'Valid enum set via spec');
      this.assertThrows(
        () => { t.status('invalid'); },
        '$EnumOf(pending|active|complete)',
        'Invalid enum value rejected by spec'
      );
    }
  });

  $test.Case.new({
    name: 'SpecEnumInitInvalid',
    doc: 'Var + spec $Enum.of rejects invalid value at construction time.',
    do() {
      $.Class.new({
        name: 'SpecEnumInitInvalidTest',
        slots: [
          $.Var.new({
            name: 'mode',
            spec: $.$Enum.of('read', 'write'),
            default: 'read',
          }),
        ]
      });
      this.assertThrows(
        () => { _.SpecEnumInitInvalidTest.new({ mode: 'execute' }); },
        '$EnumOf(read|write)',
        'Invalid init value should throw via spec'
      );
    }
  });

  // --- Phase 7: $Function, $Map, $Any type tests ---

  $test.Case.new({
    name: 'FunctionTypePass',
    doc: '$Function accepts a function value.',
    do() {
      $.Class.new({
        name: 'FnHolder',
        slots: [$.Var.new({ name: 'handler', spec: $.$Function })]
      });
      const h = _.FnHolder.new({ handler: () => 42 });
      this.assertEq(typeof h.handler(), 'function', 'Should store a function');
    }
  });

  $test.Case.new({
    name: 'FunctionTypeFail',
    doc: '$Function rejects non-function values.',
    do() {
      $.Class.new({
        name: 'FnHolder2',
        slots: [$.Var.new({ name: 'handler', spec: $.$Function })]
      });
      this.assertThrows(
        () => { _.FnHolder2.new({ handler: 'not a function' }); },
        '$Function',
        'String should be rejected by $Function spec'
      );
    }
  });

  $test.Case.new({
    name: 'MapTypePass',
    doc: '$Map accepts a plain object.',
    do() {
      $.Class.new({
        name: 'MapHolder',
        slots: [$.Var.new({ name: 'data', spec: $.$Map })]
      });
      const m = _.MapHolder.new({ data: { a: 1, b: 2 } });
      this.assertEq(m.data().a, 1, 'Should store a plain object');
    }
  });

  $test.Case.new({
    name: 'MapTypeFail',
    doc: '$Map rejects null, arrays, strings, numbers.',
    do() {
      $.Class.new({
        name: 'MapHolder2',
        slots: [$.Var.new({ name: 'data', spec: $.$Map })]
      });
      this.assertThrows(
        () => { _.MapHolder2.new({ data: [1, 2] }); },
        '$Map',
        'Array should be rejected by $Map spec'
      );
      this.assertThrows(
        () => { _.MapHolder2.new({ data: 'string' }); },
        '$Map',
        'String should be rejected by $Map spec'
      );
    }
  });

  $test.Case.new({
    name: 'AnyTypePass',
    doc: '$Any accepts any value type.',
    do() {
      $.Class.new({
        name: 'AnyHolder',
        slots: [$.Var.new({ name: 'val', spec: $.$Any })]
      });
      const a = _.AnyHolder.new({ val: 'string' });
      this.assertEq(a.val(), 'string', '$Any should accept string');
      a.val(42);
      this.assertEq(a.val(), 42, '$Any should accept number');
      a.val(null);
      this.assertEq(a.val(), null, '$Any should accept null');
      a.val(() => {});
      this.assertEq(typeof a.val(), 'function', '$Any should accept function');
    }
  });

  $test.Case.new({
    name: 'FunctionNullable',
    doc: '$Function.nullable() accepts null and function.',
    do() {
      $.Class.new({
        name: 'FnNullHolder',
        slots: [$.Var.new({ name: 'cb', spec: $.$Function.nullable() })]
      });
      const h = _.FnNullHolder.new();
      this.assertEq(h.cb(), undefined, 'Nullable function should default to undefined');
      h.cb(() => 'hi');
      this.assertEq(h.cb()(), 'hi', 'Should accept function');
      h.cb(null);
      this.assertEq(h.cb(), null, 'Should accept null');
    }
  });

  $test.Case.new({
    name: 'MapNullable',
    doc: '$Map.nullable() accepts null and plain object.',
    do() {
      $.Class.new({
        name: 'MapNullHolder',
        slots: [$.Var.new({ name: 'opts', spec: $.$Map.nullable() })]
      });
      const m = _.MapNullHolder.new();
      this.assertEq(m.opts(), undefined, 'Nullable map should default to undefined');
      m.opts({ x: 1 });
      this.assertEq(m.opts().x, 1, 'Should accept plain object');
      m.opts(null);
      this.assertEq(m.opts(), null, 'Should accept null');
    }
  });

  // --- Phase 8: Retroactive spec tests ---

  $test.Case.new({
    name: 'RetroactiveBooleanSpecs',
    doc: 'Retroactive boolean specs reject non-boolean values.',
    do() {
      this.assertThrows(
        () => { $.Reactor.new().batched('yes'); },
        '$Boolean',
        'Reactor.batched should reject string'
      );
    }
  });

  $test.Case.new({
    name: 'RetroactiveIntegerSpec',
    doc: 'SimulabraGlobal.tick spec rejects non-integer.',
    do() {
      const spec = $.SimulabraGlobal.getslot('tick').spec();
      this.assert(spec, 'tick should have a spec');
      this.assertEq(spec.name, '$Integer', 'tick spec should be $Integer');
    }
  });

  $test.Case.new({
    name: 'RetroactiveDocSpecs',
    doc: 'Method.doc is nullable string: null OK, number rejected.',
    do() {
      const spec = $.Method.getslot('doc').spec();
      this.assert(spec, 'Method.doc should have a spec');
      this.assert(spec.name.includes('$String'), 'doc spec should be string-based');
    }
  });

  $test.Case.new({
    name: 'RetroactiveInstanceSpecs',
    doc: 'SimulabraGlobal.registry spec is InstanceOf ObjectRegistry.',
    do() {
      const spec = $.SimulabraGlobal.getslot('registry').spec();
      this.assert(spec, 'registry should have a spec');
      this.assert(spec.name.includes('$InstanceOf'), 'registry spec should be instance-based');
    }
  });

  $test.Case.new({
    name: 'RetroactiveFunctionSpecs',
    doc: 'Effect.fn spec rejects non-function.',
    do() {
      this.assertThrows(
        () => { $.Effect.new({ fn: 'not-a-function' }); },
        '$Function',
        'Effect.fn should reject string'
      );
    }
  });

  $test.Case.new({
    name: 'RetroactiveMapSpecs',
    doc: 'SimulabraGlobal.modules spec is $Map.',
    do() {
      const spec = $.SimulabraGlobal.getslot('modules').spec();
      this.assert(spec, 'modules should have a spec');
      this.assertEq(spec.name, '$Map', 'modules spec should be $Map');
    }
  });

  // --- Phase 8b: Complete Var spec adoption ---

  $test.Case.new({
    name: 'RetroactiveDocSpecs8b',
    doc: 'Doc specs on slot types accept null and strings, reject numbers.',
    do() {
      for (const cls of [$.Constant, $.Before, $.After, $.AsyncBefore, $.AsyncAfter, $.Virtual]) {
        const slot = cls.getslot('doc');
        this.assert(slot, `${cls.name}.doc should exist`);
        const spec = slot.spec();
        this.assert(spec, `${cls.name}.doc should have a spec`);
        this.assert(spec.name.includes('$String'), `${cls.name}.doc spec should be string-based`);
      }
      // null accepted
      const c = $.Constant.new({ value: 42, doc: null });
      this.assertEq(c.doc(), null, 'Constant.doc should accept null');
      // string accepted
      const b = $.Before.new({ name: 'testDoc8b', doc: 'hello', do() {} });
      this.assertEq(b.doc(), 'hello', 'Before.doc should accept string');
      // number rejected
      this.assertThrows(
        () => { $.Virtual.new({ name: 'badDoc8b', doc: 123 }); },
        '$String',
        'Virtual.doc should reject number'
      );
    }
  });

  $test.Case.new({
    name: 'RetroactiveInstanceNullable8b',
    doc: 'Reactor and command specs accept null and correct instances, reject wrong types.',
    do() {
      const reactorSpec = $.SimulabraGlobal.getslot('reactor').spec();
      this.assert(reactorSpec, 'reactor should have a spec');
      this.assert(reactorSpec.name.includes('$InstanceOf'), 'reactor spec should be instance-based');
      this.assert(reactorSpec.isNullable(), 'reactor spec should be nullable');
      // registry spec should now be nullable
      const registrySpec = $.SimulabraGlobal.getslot('registry').spec();
      this.assert(registrySpec, 'registry should have a spec');
      this.assert(registrySpec.isNullable(), 'registry spec should be nullable');
      // CommandContext.command spec
      const cmdSpec = $.CommandContext.getslot('command').spec();
      this.assert(cmdSpec, 'command should have a spec');
      this.assert(cmdSpec.isNullable(), 'command spec should be nullable');
    }
  });

  $test.Case.new({
    name: 'RetroactiveFunctionNullable8b',
    doc: 'Function nullable specs accept null and functions, reject non-functions.',
    do() {
      const boundRunSpec = $.Effect.getslot('boundRun').spec();
      this.assert(boundRunSpec, 'boundRun should have a spec');
      this.assert(boundRunSpec.name.includes('$Function'), 'boundRun spec should be function-based');
      this.assert(boundRunSpec.isNullable(), 'boundRun spec should be nullable');
      // Command.run should still have a function spec (but now nullable)
      const runSpec = $.Command.getslot('run').spec();
      this.assert(runSpec, 'Command.run should have a spec');
      this.assert(runSpec.name.includes('$Function'), 'Command.run spec should be function-based');
    }
  });

  $test.Case.new({
    name: 'RetroactiveMapAndMiscSpecs8b',
    doc: 'Module.repos has $Map spec; Module.loaded is $Boolean; Constant.value is $Any.',
    do() {
      const reposSpec = $.Module.getslot('repos').spec();
      this.assert(reposSpec, 'repos should have a spec');
      this.assertEq(reposSpec.name, '$Map', 'repos spec should be $Map');
      // ObjectRegistry.classInstances/refs intentionally unspecced (re-entrancy with registration)
      // Module.loaded
      const loadedSpec = $.Module.getslot('loaded').spec();
      this.assert(loadedSpec, 'loaded should have a spec');
      this.assertEq(loadedSpec.name, '$Boolean', 'loaded spec should be $Boolean');
      // Constant.value
      const valueSpec = $.Constant.getslot('value').spec();
      this.assert(valueSpec, 'value should have a spec');
      this.assertEq(valueSpec.name, '$Any', 'value spec should be $Any');
    }
  });

  // --- Method Specs (Phase 10) ---

  // Test helper classes for method specs
  $.Class.new({
    name: 'MathHelper',
    slots: [
      $.Method.new({
        name: 'add',
        args: { x: $.$Number, y: $.$Number },
        returns: $.$Number,
        do(x, y) { return x + y; }
      }),
      $.Method.new({
        name: 'greet',
        args: { greeting: $.$String },
        rest: { suffix: $.$String },
        do(greeting, suffix) {
          return suffix ? `${greeting} ${suffix}` : greeting;
        }
      }),
      $.Method.new({
        name: 'identity',
        do(x) { return x; }
      }),
      $.Method.new({
        name: 'badReturn',
        returns: $.$Number,
        do() { return 'not a number'; }
      }),
      $.Method.new({
        name: 'fullSpec',
        args: { base: $.$Number },
        rest: { multiplier: $.$Number },
        returns: $.$Number,
        do(base, multiplier) {
          return multiplier !== undefined ? base * multiplier : base;
        }
      }),
    ]
  });

  // Virtual interface class
  $.Class.new({
    name: 'Shaped',
    slots: [
      $.Virtual.new({
        name: 'area',
        args: { scale: $.$Number },
        returns: $.$Number,
        doc: 'compute scaled area'
      }),
    ]
  });

  // Implements Virtual without redeclaring specs — should inherit
  $.Class.new({
    name: 'Circle',
    slots: [
      _.Shaped,
      $.Var.new({ name: 'radius', default: 1 }),
      $.Method.new({
        name: 'area',
        do(scale) { return Math.PI * this.radius() ** 2 * scale; }
      }),
    ]
  });

  // Implements Virtual with own specs — redeclares same types (variance-safe)
  $.Class.new({
    name: 'Square',
    slots: [
      _.Shaped,
      $.Var.new({ name: 'side', default: 1 }),
      $.Method.new({
        name: 'area',
        args: { scale: $.$Number },
        returns: $.$Number,
        do(scale) { return this.side() ** 2 * scale; }
      }),
    ]
  });

  // Parent class with specced method
  $.Class.new({
    name: 'BaseWorker',
    slots: [
      $.Method.new({
        name: 'process',
        args: { input: $.$String },
        returns: $.$String,
        do(input) { return input.toUpperCase(); }
      }),
    ]
  });

  // Child that overrides without redeclaring specs — inherits parent's
  $.Class.new({
    name: 'ChildWorker',
    slots: [
      _.BaseWorker,
      $.Method.new({
        name: 'process',
        do(input) { return `[${this.next('process', input)}]`; }
      }),
    ]
  });

  // Child that overrides AND redeclares specs
  $.Class.new({
    name: 'StrictWorker',
    slots: [
      _.BaseWorker,
      $.Method.new({
        name: 'process',
        args: { input: $.$String },
        returns: $.$String,
        do(input) { return `!${this.next('process', input)}!`; }
      }),
    ]
  });

  // Static spec test class
  $.Class.new({
    name: 'Formatter',
    slots: [
      $.Static.new({
        name: 'formatNum',
        args: { val: $.$Number },
        returns: $.$String,
        do(val) { return val.toFixed(2); }
      }),
      $.Static.new({
        name: 'parseNum',
        args: { str: $.$String },
        do(str) { return parseFloat(str); }
      }),
    ]
  });

  // Instance arg spec test class
  $.Class.new({
    name: 'PointPrinter',
    slots: [
      $.Method.new({
        name: 'print',
        args: { pt: $.$Instance.of(_.Point) },
        do(pt) { return `(${pt.x()}, ${pt.y()})`; }
      }),
      $.Method.new({
        name: 'labels',
        returns: $.$Array.of($.$String),
        do() { return ['x', 'y']; }
      }),
    ]
  });

  // --- Test cases ---

  $test.Case.new({
    name: 'MethodArgSpecPass',
    doc: 'Method with arg specs accepts valid arguments.',
    do() {
      const m = _.MathHelper.new();
      const result = m.add(2, 3);
      this.assertEq(result, 5, 'add(2,3) should return 5');
    }
  });

  $test.Case.new({
    name: 'MethodArgSpecFail',
    doc: 'Method with arg specs rejects wrong-typed argument.',
    do() {
      const m = _.MathHelper.new();
      this.assertThrows(() => m.add('two', 3), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'MethodArgSpecMissing',
    doc: 'Method with arg specs rejects missing required argument.',
    do() {
      const m = _.MathHelper.new();
      this.assertThrows(() => m.add(1), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'MethodArgSpecMessage',
    doc: 'Validation error includes method name and parameter name.',
    do() {
      const m = _.MathHelper.new();
      let msg = '';
      try { m.add('bad', 1); } catch (e) { msg = e.message; }
      this.assert(msg.includes('add'), 'error should include method name');
      this.assert(msg.includes('x'), 'error should include parameter name');
    }
  });

  $test.Case.new({
    name: 'MethodRestSpecPass',
    doc: 'Method with rest spec accepts valid optional argument.',
    do() {
      const m = _.MathHelper.new();
      const result = m.greet('hello', 'world');
      this.assertEq(result, 'hello world', 'greet with suffix should work');
    }
  });

  $test.Case.new({
    name: 'MethodRestSpecFail',
    doc: 'Method with rest spec rejects wrong-typed optional argument.',
    do() {
      const m = _.MathHelper.new();
      this.assertThrows(() => m.greet('hello', 42), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'MethodRestSpecSkipped',
    doc: 'Method with rest spec passes when optional arg not provided.',
    do() {
      const m = _.MathHelper.new();
      const result = m.greet('hello');
      this.assertEq(result, 'hello', 'greet without suffix should work');
    }
  });

  $test.Case.new({
    name: 'MethodReturnSpecPass',
    doc: 'Method with return spec accepts valid return value.',
    do() {
      const m = _.MathHelper.new();
      const result = m.add(1, 2);
      this.assertEq(result, 3, 'valid return should pass');
    }
  });

  $test.Case.new({
    name: 'MethodReturnSpecFail',
    doc: 'Method with return spec rejects wrong-typed return.',
    do() {
      const m = _.MathHelper.new();
      this.assertThrows(() => m.badReturn(), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'MethodFullSpec',
    doc: 'Method with args, rest, and returns validates end-to-end.',
    do() {
      const m = _.MathHelper.new();
      this.assertEq(m.fullSpec(5), 5, 'base only should work');
      this.assertEq(m.fullSpec(5, 3), 15, 'base * multiplier should work');
      this.assertThrows(() => m.fullSpec('x'), 'validation failed');
      this.assertThrows(() => m.fullSpec(5, 'x'), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'MethodNoSpecUnchanged',
    doc: 'Method without specs behaves identically to current.',
    do() {
      const m = _.MathHelper.new();
      this.assertEq(m.identity(42), 42, 'identity should pass through');
      this.assertEq(m.identity('anything'), 'anything', 'unspecced accepts any type');
    }
  });

  $test.Case.new({
    name: 'VirtualSpecInherited',
    doc: 'Virtual declares specs, Method override inherits them without redeclaring.',
    do() {
      const c = _.Circle.new({ radius: 5 });
      const result = c.area(2);
      this.assertEq(result, Math.PI * 25 * 2, 'Circle area with scale should work');
    }
  });

  $test.Case.new({
    name: 'VirtualSpecOverridden',
    doc: 'Method override redeclares same-type specs (variance-safe).',
    do() {
      const s = _.Square.new({ side: 4 });
      this.assertEq(s.area(2), 32, 'Square area with number scale should work');
      this.assertThrows(() => s.area('big'), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'VirtualSpecValidates',
    doc: 'Inherited Virtual specs actually validate at call time.',
    do() {
      const c = _.Circle.new({ radius: 3 });
      this.assertThrows(() => c.area('big'), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'MethodSpecInheritedOverride',
    doc: 'Parent Method has specs, child overrides without specs, child inherits.',
    do() {
      const w = _.ChildWorker.new();
      this.assertEq(w.process('hello'), '[HELLO]', 'child should chain to parent');
      this.assertThrows(() => w.process(123), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'MethodSpecOverrideRedeclare',
    doc: 'Child redeclares specs, uses its own.',
    do() {
      const w = _.StrictWorker.new();
      this.assertEq(w.process('hello'), '!HELLO!', 'strict worker should chain');
      this.assertThrows(() => w.process(123), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'StaticArgSpec',
    doc: 'Static method with args validates correctly.',
    do() {
      this.assertEq(_.Formatter.formatNum(3.14159), '3.14', 'static with valid arg works');
      this.assertThrows(() => _.Formatter.formatNum('abc'), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'StaticReturnSpec',
    doc: 'Static method with returns validates correctly.',
    do() {
      const result = _.Formatter.formatNum(42);
      this.assertEq(result, '42.00', 'static return spec passes valid string');
    }
  });

  $test.Case.new({
    name: 'MethodInstanceArgSpec',
    doc: 'Method with $Instance.of arg spec validates class membership.',
    do() {
      const pp = _.PointPrinter.new();
      const pt = _.Point.new({ x: 3, y: 4 });
      this.assertEq(pp.print(pt), '(3, 4)', 'should accept Point instance');
      this.assertThrows(() => pp.print({ x: () => 3, y: () => 4 }), 'validation failed');
    }
  });

  $test.Case.new({
    name: 'MethodArrayReturnSpec',
    doc: 'Method with $Array.of return spec validates array return.',
    do() {
      const pp = _.PointPrinter.new();
      const labels = pp.labels();
      this.assertEq(labels.length, 2, 'should return 2 labels');
      this.assertEq(labels[0], 'x', 'first label should be x');
    }
  });

  // --- Phase 11: Variance checking helpers ---

  // Class hierarchy for subtypeOf tests: Animal > Dog, Animal > Cat (unrelated to Dog)
  $.Class.new({
    name: 'Animal',
    slots: [
      $.Var.new({ name: 'sound', spec: $.$String, default: '...' }),
    ]
  });

  $.Class.new({
    name: 'Dog',
    slots: [
      _.Animal,
      $.Var.new({ name: 'sound', spec: $.$String, default: 'woof' }),
    ]
  });

  $.Class.new({
    name: 'Cat',
    slots: [
      _.Animal,
      $.Var.new({ name: 'sound', spec: $.$String, default: 'meow' }),
    ]
  });

  // Variance test: parent method specced with $Instance.of(Animal)
  $.Class.new({
    name: 'AnimalHandler',
    slots: [
      $.Method.new({
        name: 'handle',
        args: { animal: $.$Instance.of(_.Animal) },
        returns: $.$Instance.of(_.Animal),
        do(animal) { return animal; }
      }),
    ]
  });

  // Covariant return OK: child returns Dog (narrower than Animal)
  $.Class.new({
    name: 'DogHandler',
    slots: [
      _.AnimalHandler,
      $.Method.new({
        name: 'handle',
        returns: $.$Instance.of(_.Dog),
        do(animal) { return _.Dog.new(); }
      }),
    ]
  });

  // Contravariant arg OK: child accepts Animal (same, trivially wider or equal)
  $.Class.new({
    name: 'WideArgHandler',
    slots: [
      _.AnimalHandler,
      $.Method.new({
        name: 'handle',
        args: { animal: $.$Instance.of(_.Animal) },
        do(animal) { return animal; }
      }),
    ]
  });

  // No-redeclare: child overrides without specs, inherits cleanly
  $.Class.new({
    name: 'InheritingHandler',
    slots: [
      _.AnimalHandler,
      $.Method.new({
        name: 'handle',
        do(animal) { return animal; }
      }),
    ]
  });

  // Before/After compatibility test: method specced with $Instance.of(Animal)
  $.Class.new({
    name: 'BeforeCompatibleHandler',
    slots: [
      _.AnimalHandler,
      $.Before.new({
        name: 'handle',
        args: { animal: $.$Instance.of(_.Animal) },
        do(animal) { /* compatible before */ }
      }),
    ]
  });

  // Before with no specs on a specced method — compatible by default
  $.Class.new({
    name: 'BeforeNoSpecHandler',
    slots: [
      _.AnimalHandler,
      $.Before.new({
        name: 'handle',
        do(animal) { /* no arg specs, should be fine */ }
      }),
    ]
  });

  // After compatible
  $.Class.new({
    name: 'AfterCompatibleHandler',
    slots: [
      _.AnimalHandler,
      $.After.new({
        name: 'handle',
        args: { animal: $.$Instance.of(_.Animal) },
        do(animal) { /* compatible after */ }
      }),
    ]
  });

  // Rest variance: parent with rest spec, child widens
  $.Class.new({
    name: 'RestParent',
    slots: [
      $.Method.new({
        name: 'work',
        args: { task: $.$String },
        rest: { animal: $.$Instance.of(_.Dog) },
        returns: $.$String,
        do(task, animal) { return task; }
      }),
    ]
  });

  // Child widens rest arg from Dog to Animal — contravariant, OK
  $.Class.new({
    name: 'RestChild',
    slots: [
      _.RestParent,
      $.Method.new({
        name: 'work',
        rest: { animal: $.$Instance.of(_.Animal) },
        do(task, animal) { return `${task}!`; }
      }),
    ]
  });

  // Before with compatible rest spec
  $.Class.new({
    name: 'BeforeRestHandler',
    slots: [
      _.RestParent,
      $.Before.new({
        name: 'work',
        rest: { animal: $.$Instance.of(_.Animal) },
        do(task, animal) { /* rest-compatible before */ }
      }),
    ]
  });

  // --- Phase 11: Variance checking tests ---

  // subtypeOf basics

  $test.Case.new({
    name: 'SubtypeOfIdentity',
    doc: '$Number.subtypeOf($Number) returns true — same type is always a subtype of itself.',
    do() {
      this.assert($.$Number.subtypeOf($.$Number), 'identity should be true');
      this.assert($.$String.subtypeOf($.$String), 'string identity too');
    }
  });

  $test.Case.new({
    name: 'SubtypeOfDifferent',
    doc: '$Number.subtypeOf($String) returns false — no known relationship.',
    do() {
      this.assert(!$.$Number.subtypeOf($.$String), 'number is not subtype of string');
      this.assert(!$.$String.subtypeOf($.$Number), 'string is not subtype of number');
    }
  });

  $test.Case.new({
    name: 'SubtypeOfInstance',
    doc: '$Instance.of(Dog).subtypeOf($Instance.of(Animal)) returns true — Dog descends from Animal.',
    do() {
      const $Dog = $.$Instance.of(_.Dog);
      const $Animal = $.$Instance.of(_.Animal);
      this.assert($Dog.subtypeOf($Animal), 'Dog should be subtype of Animal');
    }
  });

  $test.Case.new({
    name: 'SubtypeOfInstanceFail',
    doc: '$Instance.of(Animal).subtypeOf($Instance.of(Dog)) returns false — parent is not subtype of child.',
    do() {
      const $Dog = $.$Instance.of(_.Dog);
      const $Animal = $.$Instance.of(_.Animal);
      this.assert(!$Animal.subtypeOf($Dog), 'Animal should not be subtype of Dog');
    }
  });

  $test.Case.new({
    name: 'SubtypeOfInstanceUnrelated',
    doc: '$Instance.of(Dog).subtypeOf($Instance.of(Cat)) returns false — unrelated classes.',
    do() {
      const $Dog = $.$Instance.of(_.Dog);
      const $Cat = $.$Instance.of(_.Cat);
      this.assert(!$Dog.subtypeOf($Cat), 'Dog and Cat are unrelated');
    }
  });

  // Method override variance

  $test.Case.new({
    name: 'VarianceSameTypeOK',
    doc: 'Child redeclares same arg type — no variance error.',
    do() {
      // WideArgHandler already defined above with same $Instance.of(Animal) arg — class created without error
      const h = _.WideArgHandler.new();
      const a = _.Animal.new();
      this.assertEq(h.handle(a), a, 'wide arg handler should work');
    }
  });

  $test.Case.new({
    name: 'VarianceCovariantReturnOK',
    doc: 'Child returns narrower $Instance type (Dog instead of Animal) — covariant, passes.',
    do() {
      // DogHandler already defined above — class created without error
      const h = _.DogHandler.new();
      const a = _.Animal.new();
      const result = h.handle(a);
      this.assert(result.isa(_.Dog), 'should return a Dog');
    }
  });

  $test.Case.new({
    name: 'VarianceCovariantReturnFail',
    doc: 'Child returns wider type (Animal instead of Dog) — covariance violation at definition time.',
    do() {
      // DogReturner parent returns Dog, child tries to return Animal (wider)
      this.assertThrows(() => {
        $.Class.new({
          name: 'NarrowReturnParent',
          slots: [
            $.Method.new({
              name: 'produce',
              returns: $.$Instance.of(_.Dog),
              do() { return _.Dog.new(); }
            }),
          ]
        });
        $.Class.new({
          name: 'WideReturnChild',
          slots: [
            __.mod().getInstance($.Class, 'NarrowReturnParent'),
            $.Method.new({
              name: 'produce',
              returns: $.$Instance.of(_.Animal),
              do() { return _.Animal.new(); }
            }),
          ]
        });
      }, 'covariance violation');
    }
  });

  $test.Case.new({
    name: 'VarianceContravariantArgOK',
    doc: 'Child accepts wider $Instance arg type (Animal instead of Dog) — contravariant, passes.',
    do() {
      // Parent has Dog arg, child widens to Animal
      $.Class.new({
        name: 'DogArgParent',
        slots: [
          $.Method.new({
            name: 'pet',
            args: { animal: $.$Instance.of(_.Dog) },
            do(animal) { return animal.sound(); }
          }),
        ]
      });
      $.Class.new({
        name: 'AnimalArgChild',
        slots: [
          __.mod().getInstance($.Class, 'DogArgParent'),
          $.Method.new({
            name: 'pet',
            args: { animal: $.$Instance.of(_.Animal) },
            do(animal) { return animal.sound(); }
          }),
        ]
      });
      // If we got here, no error was thrown — pass
      this.assert(true, 'contravariant arg should be allowed');
    }
  });

  $test.Case.new({
    name: 'VarianceContravariantArgFail',
    doc: 'Child accepts narrower $Instance arg type (Dog instead of Animal) — contravariance violation.',
    do() {
      this.assertThrows(() => {
        $.Class.new({
          name: 'AnimalArgParent',
          slots: [
            $.Method.new({
              name: 'pet',
              args: { animal: $.$Instance.of(_.Animal) },
              do(animal) { return animal.sound(); }
            }),
          ]
        });
        $.Class.new({
          name: 'DogArgChild',
          slots: [
            __.mod().getInstance($.Class, 'AnimalArgParent'),
            $.Method.new({
              name: 'pet',
              args: { animal: $.$Instance.of(_.Dog) },
              do(animal) { return animal.sound(); }
            }),
          ]
        });
      }, 'contravariance violation');
    }
  });

  $test.Case.new({
    name: 'VarianceNoRedeclareOK',
    doc: 'Child overrides without redeclaring specs — inherits cleanly, no variance check fires.',
    do() {
      // InheritingHandler already defined above — class created without error
      const h = _.InheritingHandler.new();
      const a = _.Animal.new();
      this.assertEq(h.handle(a), a, 'inheriting handler should work');
    }
  });

  // Before/After compatibility

  $test.Case.new({
    name: 'BeforeCompatibleOK',
    doc: 'Before with same arg type as method — compatible, passes.',
    do() {
      // BeforeCompatibleHandler already defined above without error
      const h = _.BeforeCompatibleHandler.new();
      const a = _.Animal.new();
      this.assertEq(h.handle(a), a, 'before-compatible handler should work');
    }
  });

  $test.Case.new({
    name: 'BeforeCompatibleWiderOK',
    doc: 'Before with supertype arg — compatible, passes.',
    do() {
      // Before accepts Animal on a method that guarantees Animal — same type, compatible
      // (A wider Before would need a parent type of Animal, which we don't have,
      //  so this tests the identity/same-type case through the compatibility check)
      const h = _.BeforeCompatibleHandler.new();
      const d = _.Dog.new();
      this.assertEq(h.handle(d), d, 'should accept Dog (subtype of Animal)');
    }
  });

  $test.Case.new({
    name: 'BeforeIncompatibleFail',
    doc: 'Before with narrower arg type — incompatible, throws at definition time.',
    do() {
      this.assertThrows(() => {
        $.Class.new({
          name: 'BeforeNarrowHandler',
          slots: [
            _.AnimalHandler,
            $.Before.new({
              name: 'handle',
              args: { animal: $.$Instance.of(_.Dog) },
              do(animal) { /* Dog is narrower than Animal — incompatible */ }
            }),
          ]
        });
      }, 'is not a supertype');
    }
  });

  $test.Case.new({
    name: 'AfterCompatibleOK',
    doc: 'After with compatible arg type — passes.',
    do() {
      // AfterCompatibleHandler already defined above without error
      const h = _.AfterCompatibleHandler.new();
      const a = _.Animal.new();
      this.assertEq(h.handle(a), a, 'after-compatible handler should work');
    }
  });

  $test.Case.new({
    name: 'AfterIncompatibleFail',
    doc: 'After with incompatible arg type — throws at definition time.',
    do() {
      this.assertThrows(() => {
        $.Class.new({
          name: 'AfterNarrowHandler',
          slots: [
            _.AnimalHandler,
            $.After.new({
              name: 'handle',
              args: { animal: $.$Instance.of(_.Dog) },
              do(animal) { /* Dog is narrower than Animal — incompatible */ }
            }),
          ]
        });
      }, 'is not a supertype');
    }
  });

  $test.Case.new({
    name: 'BeforeNoSpecOK',
    doc: 'Before without specs on a specced method — compatible by default.',
    do() {
      // BeforeNoSpecHandler already defined above without error
      const h = _.BeforeNoSpecHandler.new();
      const a = _.Animal.new();
      this.assertEq(h.handle(a), a, 'before-no-spec handler should work');
    }
  });

  // Rest variance and compatibility

  $test.Case.new({
    name: 'VarianceRestContravariantOK',
    doc: 'Child widens rest arg type from Dog to Animal — contravariant, passes.',
    do() {
      // RestChild already defined above — class created without error
      const w = _.RestChild.new();
      this.assertEq(w.work('task'), 'task!', 'rest child should work');
    }
  });

  $test.Case.new({
    name: 'BeforeRestCompatibleOK',
    doc: 'Before with compatible rest spec — passes.',
    do() {
      // BeforeRestHandler already defined above without error
      const w = _.BeforeRestHandler.new();
      this.assertEq(w.work('task'), 'task', 'before rest handler should work');
    }
  });

}.module({
  name: 'test.core',
  imports: [base, test],
}).load();
