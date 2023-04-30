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
          do(mod) {
            __.mod(mod);
            const cases = mod.repos().case;
            if (cases === undefined) {
              throw new Error(`no cases in module ${mod.description()}`);
            }
            for (const test_case of Object.values(cases)) {
              test_case.run();
            }
          }
        }),
        $.method.new({
          name: 'load-file',
          async: true,
          async do(filePath) {
            const ext = extname(filePath);
            if (ext === '.js') {
              const esm = await import('./' + filePath);
              return esm.default;
            } else if (ext === '.simulabra') {
              const source = (await readFile(filePath)).toString();
              const transformer = $.transformer.new();
              return await $.script.new({
                name: filePath,
                imports: [_],
                source,
              }).run(transformer);
            }
          }
        }),
        $.method.new({
          name: 'run',
          async: true,
          async do(path) {
            const files = await readdir(path);
            for (const file of files) {
              this.log('load', file);
              const filePath = join(path, file);
              try {
                const mod = await this.load_file(filePath);
                this.run_mod(mod);
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
