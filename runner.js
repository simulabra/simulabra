import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import base from 'simulabra/base';
import test from 'simulabra/test';
import lang from 'simulabra/lang';

export default await base.find('class', 'module').new({
  name: 'runner',
  imports: [base, test, lang],
  async on_load(_, $) {
    $.class.new({
      name: 'test-timer',
      components: [
        $.var.new({ name: 'start' }),
        $.after.new({
          name: 'init',
          do() {
            this.start(+new Date());
          }
        }),
        $.method.new({
          name: 'mark',
          do() {
            return `(${+new Date() - this.start()}ms)`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'test-runner',
      components: [
        $.var.new({
          name: 'module-cache',
        }),
        $.var.new({
          name: 'timer',
        }),
        $.after.new({
          name: 'init',
          do() {
            this.timer($.test_timer.new({ name: 'runner-timer' }));
          }
        }),
        $.method.new({
          name: 'run-mod',
          do(mod) {
            this.log(`run ${mod.title()}`);
            globalThis.SIMULABRA.mod(mod);
            const cases = mod.instances($.case);
            if (cases === undefined) {
              throw new Error(`no cases in module ${mod.description()}`);
            }
            for (const test_case of cases) {
              test_case.run();
            }
            const n = Object.values(cases).length;
            this.log(mod.title(), `${n} test cases passed`);
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
              transformer.module_cache($.module_cache.inst());
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
            this.log('done running');
          }
        }),
        $.method.new({
          name: 'log',
          override: true,
          do(...args) {
            this.next('log', this.timer().mark(), ...args);
          }
        }),
      ]
    });

    const runner = $.test_runner.new();
    $.module_cache.inst().clear_out_js();
    await runner.run('tests');
    await runner.run('core');
  }
}).load();
