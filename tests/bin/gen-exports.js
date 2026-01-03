import { __, base } from '../../src/base.js';
import test from '../../src/test.js';
import genExports from '../../bin/gen-exports.js';

export default await async function (_, $, $test, $gen) {
  $test.AsyncCase.new({
    name: 'GenExportsModules',
    doc: 'modules() returns src/*.js files excluding runner',
    async do() {
      const gen = $gen.ExportsGenerator.new();
      const mods = await gen.modules();

      this.assert(mods.includes('base'), 'should include base');
      this.assert(mods.includes('html'), 'should include html');
      this.assert(mods.includes('live'), 'should include live');
      this.assert(!mods.includes('runner'), 'should exclude runner');
    }
  });

  $test.AsyncCase.new({
    name: 'GenExportsBuildExports',
    doc: 'buildExports() produces correct export map',
    async do() {
      const gen = $gen.ExportsGenerator.new();
      const exports = await gen.buildExports();

      this.assert(exports['.'] === './src/base.js', 'root should be base.js');
      this.assert(exports['./html'] === './src/html.js', 'should map ./html');
      this.assert(exports['./live'] === './src/live.js', 'should map ./live');
      this.assert(!exports['./base'], 'base should not have subpath (its the root)');
    }
  });

  $test.AsyncCase.new({
    name: 'GenExportsCustomExclude',
    doc: 'exclude set can be customized',
    async do() {
      const gen = $gen.ExportsGenerator.new({ exclude: new Set(['runner.js', 'llm.js']) });
      const mods = await gen.modules();

      this.assert(!mods.includes('runner'), 'should exclude runner');
      this.assert(!mods.includes('llm'), 'should exclude llm');
      this.assert(mods.includes('html'), 'should still include html');
    }
  });
}.module({
  name: 'test.bin.gen-exports',
  imports: [base, test, genExports],
}).load();
