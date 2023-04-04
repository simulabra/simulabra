import { readdir } from 'fs/promises';
import { join } from 'path';

import bootstrap from './base.js';
var __ = bootstrap();
import test_mod from './test.js';
export default __.new_module({
  name: 'runner',
  imports: [test_mod],
  on_load(_, $) {
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
              const esm = await import('./' + filePath);
              const mod = esm.default;
              for (const test_case of Object.values(mod.$case)) {
                try {
                  test_case.run();
                } catch(e) {
                  console.log(e);
                }
              }
            }
          }
        })
      ]
    });

    $.test_runner.new().run('tests');
  }
});
