import * as bun from 'bun';
import { __, base } from '../src/base.js';
import test from '../src/test.js';
import { join, dirname } from 'path';

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
        do() {
          // nada
        }
      })
    ]
  });

  $test.AsyncCase.new({
    name: 'ListerCoreTest',
    doc: 'runs bin/lister.js on tests/core.js and validates output',
    async do() {
      const output = await bun.$`bun run bin/lister.js tests/lister.js`.text();
      this.assert(output === `ThisIsATest:7
  $.Var#frob the frob thing
  $.Method#grobnicate what it says on the tin
`)
    }
  });

  $test.AsyncCase.new({
    name: 'ListerCounterTest',
    doc: 'runs bin/lister.js on demos/counter.js and validates browser module loading',
    async do() {
      const output = await bun.$`bun run bin/lister.js demos/counter.js`.text();

      this.assert(output.includes('Counter'), 'output should contain Counter class');
      this.assert(output.includes('$.Signal#count'), 'output should contain count signal');
      this.assert(output.includes('$.Method#inc'), 'output should contain inc method');
      this.assert(output.includes('CounterList'), 'output should contain CounterList class');
      this.assert(output.includes('App'), 'output should contain App class');
    }
  });
}.module({
  name: 'test.lister',
  imports: [base, test],
}).load();
