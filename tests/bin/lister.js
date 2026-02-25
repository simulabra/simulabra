import * as bun from 'bun';
import { __, base } from '../../src/base.js';
import test from '../../src/test.js';

export default await async function (_, $, $test) {
  $.Class.new({
    name: 'ThisIsATest',
    doc: 'something something',
    slots: [
      $.Var.new({
        name: 'frob',
        doc: 'the frob thing'
      }),
      $.Method.new({
        name: 'grobnicate',
        doc: 'what it says on the tin',
        do() {}
      })
    ]
  });

  $.Class.new({
    name: 'SpecDisplay',
    slots: [
      $.Var.new({ name: 'count', spec: $.$Number }),
      $.Var.new({ name: 'label', spec: $.$String }),
      $.Var.new({ name: 'status', spec: $.$Enum.of('on', 'off') }),
      $.Var.new({ name: 'items', spec: $.$Array.of($.$Number) }),
      $.Var.new({ name: 'ref', spec: $.$Instance.of(_.ThisIsATest).nullable() }),
      $.Var.new({ name: 'untyped' }),
    ]
  });

  $test.AsyncCase.new({
    name: 'ListerCoreTest',
    doc: 'runs bin/lister.js on tests/bin/lister.js and validates output',
    async do() {
      const output = await bun.$`bun run bin/lister.js tests/bin/lister.js ThisIsATest`.text();
      this.assert(output === `ThisIsATest:6-20
  $.Var#frob the frob thing
  $.Method#grobnicate what it says on the tin
`)
    }
  });

  $test.AsyncCase.new({
    name: 'ListerCounterTest',
    doc: 'runs bin/lister.js on demos/counter.js and validates browser module loading',
    async do() {
      const output = await bun.$`bun run bin/lister.js ../demos/counter.js`.text();
      this.assert(output.includes('Counter'), 'output should contain Counter class');
      this.assert(output.includes('$.Signal#count'), 'output should contain count signal');
      this.assert(output.includes('$.Method#inc'), 'output should contain inc method');
      this.assert(output.includes('CounterList'), 'output should contain CounterList class');
      this.assert(output.includes('App'), 'output should contain App class');
    }
  });

  $test.AsyncCase.new({
    name: 'ListerFilterTest',
    doc: 'runs bin/lister.js with class filter and validates exact match',
    async do() {
      const output = await bun.$`bun run bin/lister.js tests/core.js Point`.text();
      this.assert(output === `Point:10-20
  $.Var#x
  $.Var#y
  $.Method#dist
`, 'should return only the Point class');
    }
  });

  $test.AsyncCase.new({
    name: 'ListerSpecDisplayTest',
    doc: 'specced slots show type annotation in brackets',
    async do() {
      const output = await bun.$`bun run bin/lister.js tests/bin/lister.js SpecDisplay`.text();
      this.assert(output.includes('$.Var#count [$Number]'), 'number spec');
      this.assert(output.includes('$.Var#label [$String]'), 'string spec');
      this.assert(output.includes('$.Var#status [$EnumOf(on|off)]'), 'enum spec');
      this.assert(output.includes('$.Var#items [$ArrayOf$Number]'), 'array spec');
      this.assert(output.includes('$.Var#ref [$InstanceOfThisIsATest?]'), 'instance nullable spec');
      this.assert(output.includes('$.Var#untyped'), 'untyped slot present');
      this.assert(!output.includes('$.Var#untyped ['), 'untyped slot has no spec annotation');
    }
  });
}.module({
  name: 'test.bin.lister',
  imports: [base, test],
}).load();
