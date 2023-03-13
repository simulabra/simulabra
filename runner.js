import { readdir } from 'fs/promises';
import { join } from 'path';

import bootstrap from './base.js';
var __ = bootstrap();
import test_mod from './test.js';
let base_mod = __.mod();
__.new_module({
  name: 'runner',
  imports: [base_mod, test_mod],
  on_load(_, $) {
    $.class.new({
      name: 'test-runner',
      components: [
        $.method.new({
          name: 'run',
          async do(path) {
            const files = await readdir(path);

            const modules = await Promise.all(
              files.map(async (file) => {
                const filePath = join(path, file);
                const module = await import('./' + filePath);
                return module.default;
              })
            );

            this.log(`ran tests for ${modules.length} modules`);
          }
        })
      ]
    });

    $.test_runner.new().run('tests');
  }
});
