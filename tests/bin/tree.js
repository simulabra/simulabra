import * as bun from 'bun';
import { __, base } from '../../src/base.js';
import test from '../../src/test.js';
import treeModule from '../../bin/tree.js';

export default await async function (_, $, $test, $tree) {
  $test.AsyncCase.new({
    name: 'TreeOutputContainsKnownClasses',
    doc: 'tree output includes known classes from src/base.js',
    async do() {
      const output = await bun.$`bun run bin/tree.js`.text();
      this.assert(output.includes('Class'), 'should contain Class');
      this.assert(output.includes('Module'), 'should contain Module');
      this.assert(output.includes('Method'), 'should contain Method');
      this.assert(output.includes('Var'), 'should contain Var');
    }
  });

  $test.AsyncCase.new({
    name: 'TreeIgnoresNodeModules',
    doc: 'ignored directories are excluded from output',
    async do() {
      const output = await bun.$`bun run bin/tree.js`.text();
      this.assert(!output.includes('node_modules'), 'should not contain node_modules');
      this.assert(!output.includes('.git/'), 'should not contain .git');
      this.assert(!output.includes('.claude/'), 'should not contain .claude');
    }
  });

  $test.AsyncCase.new({
    name: 'TreeShowsDirectoryStructure',
    doc: 'output contains expected directories and tree characters',
    async do() {
      const output = await bun.$`bun run bin/tree.js`.text();
      this.assert(output.includes('src/'), 'should contain src/');
      this.assert(output.includes('bin/'), 'should contain bin/');
      this.assert(output.includes('├──') || output.includes('└──'), 'should contain tree chars');
    }
  });

  $test.AsyncCase.new({
    name: 'TreeSubdirectoryArg',
    doc: 'scoping to a subdirectory limits output',
    async do() {
      const output = await bun.$`bun run bin/tree.js src`.text();
      this.assert(output.includes('base.js'), 'should contain base.js');
      this.assert(!output.includes('demos/'), 'should not contain demos/');
      this.assert(!output.includes('bin/'), 'should not contain bin/');
    }
  });

  $test.Case.new({
    name: 'TreeExtractClassNames',
    doc: 'unit test for class name extraction from source text',
    do() {
      const tree = $tree.DirectoryTree.new();
      const source = `
$.Class.new({
  name: 'Foo',
  slots: []
});
$.Class.new({
  name: 'Bar',
  slots: []
});
`;
      const names = tree.extractClassNames(source);
      this.assertEq(names.length, 2, 'should find two classes');
      this.assertEq(names[0], 'Foo', 'first class is Foo');
      this.assertEq(names[1], 'Bar', 'second class is Bar');
    }
  });
}.module({
  name: 'test.bin.tree',
  imports: [base, test, treeModule],
}).load();
