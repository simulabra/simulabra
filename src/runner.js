import { readdir } from 'fs/promises';
import { join, dirname, relative } from 'path';
import base from './base.jsx';
import test from './test.js';

export default await base.find('class', 'module').new({
  name: 'runner',
  imports: [test],
  async on_load(_, $) {
    $.class.new({
      name: 'test_timer',
      slots: [
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
            return `[${+new Date() - this.start()}ms]`;
          }
        }),
      ]
    });

    $.class.new({
      name: 'test_runner',
      slots: [
        $.var.new({
          name: 'module_cache',
        }),
        $.var.new({
          name: 'timer',
        }),
        $.after.new({
          name: 'init',
          do() {
            this.timer($.test_timer.new({ name: 'runner_timer' }));
          }
        }),
        $.method.new({
          name: 'run_mod',
          async: true,
          async do(mod) {
            this.log(`run ${mod.title()}`);
            globalThis.SIMULABRA.mod(mod);
            const cases = $.case.instances();
            if (cases === undefined) {
              throw new Error(`no cases in module ${mod.description()}`);
            }
            for (const test_case of cases) {
              await test_case.run();
            }
            const n = Object.values(cases).length;
            this.log(mod.title(), `${n} test cases passed`);
          }
        }),
        $.method.new({
          name: 'load_file',
          async: true,
          async do(filePath) {
            const esm = await import(filePath);
            return esm.default;
          }
        }),
        $.method.new({
          name: 'run',
          async: true,
          async do(path) {
            const files = await readdir(path);
            for (const file of files) {
              // this.log('load', file);
              const filePath = join(dirname(__dirname), join(path, file));
              try {
                const mod = await this.load_file(filePath);
                await this.run_mod(mod);
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
            this.next('log', this.timer()?.mark(), ...args);
          }
        }),
      ]
    });

    const runner = $.test_runner.new();
    await runner.run('tests');
  }
}).load();
