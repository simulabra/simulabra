import { test } from 'uvu';
import * as fs from 'fs';
import * as assert from 'uvu/assert';
import * as Base from '../base.js';
import * as ESTree from '../estree.js';

test('basic', () => {
  function add(a, b) {
    return a + b + 3;
  }
  const transformer = ESTree.ESTreeTransformer.new();
  const prog = transformer.transform(transformer.parse(add.toString()));

  // console.log(prog._class._super._super);
  // console.log(Object.getPrototypeOf(prog));
  // console.log(ESTree.Program.slots())
  assert.is(prog.class().name(), 'Program');
  assert.is(prog.body()[0].class().name(), 'FunctionDeclaration');
});

test('demo', () => {
  const demoString = fs.readFileSync('./demo.js').toString();
  const transformer = ESTree.ESTreeTransformer.new();
  const prog = transformer.transform(transformer.parse(demoString));
})

test.run();
