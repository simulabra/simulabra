import base from '../src/base.js';
import test from '../src/test.js';

const __ = globalThis.SIMULABRA;

export default await async function (_, $) {
  const moduleA = await function (_modA, $A) {
    $A.Class.new({
      name: 'Widget',
      slots: [
        $A.Var.new({ name: 'id', default: 'default-widget-id' }),
        $A.Method.new({ name: 'ping', do() { return 'pong from Widget ' + this.id(); } })
      ]
    });
    $A.Widget.new({ name: 'globalWidget' });
  }.module({
    name: 'test.base.moduleA',
    imports: [base]
  }).load();


  const moduleB = await function (_modB, $B) {
    $B.Class.new({
      name: 'Gadget',
      slots: [
        $B.Widget,
        $B.Var.new({ name: 'gadgetProp', default: 'prop-xyz' }),
        $B.Method.new({ name: 'ping', override: true, do() { return 'pong from Gadget ' + this.id(); } })
      ]
    });
  }.module({
    name: 'test.base.moduleB',
    parent: moduleA,
    imports: [base, moduleA]
  }).load();


  $.Class.new({
    name: 'ModifierBase',
    slots: [
      $.Var.new({ name: 'journal', default: () => [] }),
      $.Method.new({
        name: 'exec',
        do() { this.journal().push('Base Exec'); }
      }),
      $.Before.new({
        name: 'exec',
        do() { this.journal().push('Base Before'); }
      }),
      $.After.new({
        name: 'exec',
        do() { this.journal().push('Base After'); }
      }),
    ]
  });

  $.Class.new({
    name: 'ModifierChildOverride',
    slots: [
      $.ModifierBase,
      $.Method.new({
        name: 'exec',
        override: true,
        do() { this.journal().push('Child Override Exec'); }
      }),
       $.Before.new({
        name: 'exec',
        do() { this.journal().push('Child Before'); }
      }),
       $.After.new({
        name: 'exec',
        do() { this.journal().push('Child After'); }
      }),
    ]
  });

  $.Class.new({
    name: 'VirtualBase',
    slots: [
      $.Virtual.new({ name: 'mustImplement' })
    ]
  });

  $.Class.new({
    name: 'VirtualImpl',
    slots: [
      $.VirtualBase,
      $.Method.new({ name: 'mustImplement', do() { return 'Implemented!'; } })
    ]
  });

  $.Class.new({
    name: 'EventTester',
    slots: [
      $.Var.new({ name: 'eventTriggered', default: false }),
      $.Method.new({
        name: 'listen',
        do() {
          this.addEventListener('customEvent', (event) => {
            this.eventTriggered(true);
            this.log('Custom event received:', event.detail);
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
    name: 'Module_GetInstanceAcrossModules',
    do() {
      const WidgetClass = moduleB.find('Class', 'Widget');
      this.assert(WidgetClass, 'Could not find Widget class definition globally');

      const instance = moduleB.getInstance(WidgetClass, 'globalWidget');
      this.assert(instance, 'Could not get instance "globalWidget" from global registry');
      this.assertEq(instance.id(), 0, 'Instance found has wrong id');
      this.assertEq(instance.class().name(), 'Widget', 'Instance has wrong class name');
    }
  });

  $.Case.new({
    name: 'Module_UseClassAcrossModules',
    do() {
      const gadget = moduleB.$().Gadget.new({ name: 'gadget-123' });
      this.assert(gadget, 'Failed to create Gadget instance');
      this.assertEq(gadget.name(), 'gadget-123', 'Gadget instance has wrong name');
      this.assertEq(gadget.gadgetProp(), 'prop-xyz', 'Gadget instance missing own property');
      this.assertEq(gadget.ping(), 'pong from Gadget 0', 'Gadget ping method failed');
      const WidgetClass = moduleB.find('Class', 'Widget');
      this.assert(gadget.isa(WidgetClass), 'Gadget instance should be instanceof Widget');
    }
  });

  $.Case.new({
    name: 'MethodModifiers_OverrideWithInheritedModifiers',
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

  $.Case.new({
    name: 'VirtualMethod_ThrowsWhenUnimplemented',
    do() {
      const base = $.VirtualBase.new();
      this.assertThrows(
        () => { base.mustImplement(); },
        'not implemented',
        'Calling an unimplemented virtual method should throw an error.'
      );
    }
  });

  $.Case.new({
    name: 'VirtualMethod_WorksWhenImplemented',
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
    }
  });

  $.Case.new({
    name: 'EventSystem_BasicListenDispatch',
    do() {
      const tester = $.EventTester.new();
      tester.listen();
      this.assertEq(tester.eventTriggered(), false, 'Event flag should be false initially');
      tester.fire({ data: 'test payload' });
      this.assertEq(tester.eventTriggered(), true, 'Event flag should be true after dispatch');
    }
  });

  $.Case.new({
    name: 'PrimitiveIntegration_String',
    do() {
      const testString = "hello";
      this.assert(typeof testString.description === 'function', 'String.prototype.description should be a function');
      this.assertEq(testString.description(), "hello", 'String description should return the string itself');

      const StringPrimitiveClass = _.find('Primitive', 'StringPrimitive');
      this.assert(StringPrimitiveClass, 'Could not find StringPrimitive class');
      this.assertEq(testString.class(), StringPrimitiveClass, 'Native string should report its class as StringPrimitive');
    }
  });


}.module({
  name: 'test.base_core',
  imports: [base, test],
}).load();
