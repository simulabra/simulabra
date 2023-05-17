import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import base from './base.js';
const __ = globalThis.SIMULABRA;
import test from './test.js';
import lang from './lang.js';

export default await base.find('class', 'module').new({
  name: 'runner',
  imports: [base, test, lang],
  async on_load(_, $) {
    $.class.new({
      name: 'test-runner',
      components: [
        $.var.new({
          name: 'module-cache',
        }),
        $.method.new({
          name: 'run-mod',
          do(mod) {
            __.mod(mod);
            const cases = mod.instances($.case);
            if (cases === undefined) {
              throw new Error(`no cases in module ${mod.description()}`);
            }
            for (const test_case of Object.values(cases)) {
              test_case.run();
            }
            const n = Object.values(cases).length;
            mod.log(`${n} test cases passed`);
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
              let moduleName = filePath.replace(/\.simulabra/, '');
              transformer.module_cache(this.module_cache());
              return await $.script.new({
                name: moduleName,
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

    const runner = $.test_runner.new();
    runner.module_cache($.module_cache.new());
    runner.module_cache().clear_out_js();
    await runner.run('tests');
    await runner.run('core');
  }
}).load();
