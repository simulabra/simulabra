import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

import bootstrap from './base.js';
var __ = bootstrap();
import test_mod from './test.js';
import lisp_mod from './lisp2.js';
let base_mod = __._base_mod;

export default await base_mod.find('class', 'module').new({
  name: 'runner',
  imports: [test_mod, lisp_mod],
  async on_load(_, $) {
    $.class.new({
      name: 'test-runner',
      components: [
        $.var.new({
          name: 'mod',
        }),
        $.method.new({
          name: 'run-mod',
          async do(mod) {
            const cases = mod.repos().case;
            if (cases === undefined) {
              throw new Error(`no cases in module ${mod.description()}`);
            }
            for (const test_case of Object.values(cases)) {
              try {
                await test_case.run();
              } catch (e) {
                console.log(e);
              }
            }
          }
        }),
        $.method.new({
          name: 'run',
          async do(path) {
            const files = await readdir(path);

            for (const file of files) {
              const filePath = join(path, file);
              const ext = extname(filePath);
              this.log('load', filePath, ext);
              try {
                if (ext === '.js') {
                  const esm = await import('./' + filePath);
                  const mod = esm.default;
                  await this.run_mod(mod);
                } else if (ext === '.simulabra') {
                  const source = (await readFile(filePath)).toString();
                  const transformer = $.transformer.new();
                  const mod = await $.script.new({
                    name: 'lisp-basic-run--counter',
                    imports: [_],
                    source,
                  }).run(transformer);
                  this.log(mod);
                  await this.run_mod(mod);
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
