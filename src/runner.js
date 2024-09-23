import { readdir } from 'fs/promises';
import { join, dirname, relative } from 'path';
import base from './base.js';
import test from './test.js';

export default await base.find('Class', 'Module').new({
  name: 'runner',
  imports: [test],
  async on_load(_, $) {
    $.Class.new({
      name: 'test_timer',
      slots: [
        $.Var.new({ name: 'start' }),
        $.after.new({
          name: 'init',
          do() {
            this.start(+new Date());
          }
        }),
        $.Method.new({
          name: 'mark',
          do() {
            return `[${+new Date() - this.start()}ms]`;
          }
        }),
      ]
    });

    $.Class.new({
      name: 'test_runner',
      slots: [
        $.Var.new({
          name: 'module_cache',
        }),
        $.Var.new({
          name: 'timer',
        }),
        $.after.new({
          name: 'init',
          do() {
            this.timer($.test_timer.new({ name: 'runner_timer' }));
          }
        }),
        $.Method.new({
          name: 'run_mod',
          async: true,
          async do(mod) {
            this.log(`run ${mod.title()}`);
            globalThis.SIMULABRA.mod(mod);
            const Cases = mod.instances($.Case);
            if (Cases === undefined) {
              throw new Error(`no Cases in module ${mod.description()}`);
            }
            for (const test_Case of Cases) {
              await test_Case.run();
            }
            const n = Object.values(Cases).length;
            this.log(mod.title(), `${n} test Cases passed`);
          }
        }),
        $.Method.new({
          name: 'load_file',
          async: true,
          async do(filePath) {
            const esm = await import(filePath);
            return esm.default;
          }
        }),
        $.Method.new({
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
        $.Method.new({
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
