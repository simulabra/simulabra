import { $ } from "bun";
import { __, base } from '../../src/base.js';
import test from '../../src/test.js';

export default await async function (_, $sim, $test) {
  $test.Case.new({
    name: 'FinderRenderTest',
    doc: 'finds render implementations across codebase',
    async: true,
    async do() {
      const result = await $`bun run bin/finder.js render`.nothrow().text();
      this.assert(result.includes('Component'), 'should find Component');
      this.assert(result.includes('#render'), 'should find render slot');
      this.assert(result.includes('demos/loom.js'), 'should find loom renders');
    }
  });

  $test.Case.new({
    name: 'FinderNotFoundTest',
    doc: 'handles non-existent slots gracefully',
    async: true,
    async do() {
      const result = await $`bun run bin/finder.js nonExistentSlotXYZ123`.nothrow().text();
      this.assert(result.includes('No implementations'), 'should report not found');
    }
  });

  $test.Case.new({
    name: 'FinderExactMatchTest',
    doc: 'only matches exact slot names not substrings',
    async: true,
    async do() {
      const result = await $`bun run bin/finder.js render`.nothrow().text();
      this.assert(!result.includes('#renderInput'), 'should not match renderInput');
      this.assert(!result.includes('#renderCheckbox'), 'should not match renderCheckbox');
    }
  });
}.module({
  name: 'test.bin.finder',
  imports: [base, test],
}).load();
