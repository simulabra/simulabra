import { readdir } from 'fs/promises';
import { join } from 'path';

import bootstrap from './base.js';
var __ = bootstrap();
import test_mod from './test.js';
let base_mod = __._base_mod;

export default await base_mod.find('class', 'module').new({
  name: 'runner',
  imports: [test_mod],
  async on_load(_, $) {
    $.class.new({
      name: 'test-runner',
      components: [
        $.method.new({
          name: 'run',
          async do(path) {
            const files = await readdir(path);

            for (const file of files) {
              const filePath = join(path, file);
              this.log('load ' + filePath);
              try {
                const esm = await import('./' + filePath);
                const mod = esm.default;
                const cases = mod.repos().case;
                if (cases === undefined) {
                  this.log(filePath, mod);
                  throw new Error(`no cases in module ${mod.description()}`);
                }
                for (const test_case of Object.values(cases)) {
                  try {
                    await test_case.run();
                  } catch (e) {
                    console.log(e);
                  }
                }
              } catch (e) {
                this.log('failed to load module at ' + filePath);
                throw e;
              }
            }
          }
        })
      ]
    });

    await $.test_runner.new().run('tests');
  }
}).load();
