import { test } from 'uvu';
import * as assert from 'uvu/assert';
import Base from '../base.js';
import ESTree from '../estree.js';

test('basic', () => {
  function add(a, b) {
    return a + b + 3;
  }
  const transformer = ESTree.ESTreeTransformer.new();
  const prog = transformer.transform(transformer.parse(add.toString()));

  assert.is(prog.class().name(), 'Program');
});

test.run();
