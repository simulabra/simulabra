import { readdir } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { __, base } from './base.js';
import test from './test.js';

await async function (_, $) {
  $.Class.new({
    name: 'TestTimer',
    slots: [
      $.Var.new({ name: 'start' }),
      $.After.new({
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
    name: 'TestRunner',
    slots: [
      $.Var.new({
        name: 'timer',
      }),
      $.After.new({
        name: 'init',
        do() {
          this.timer($.TestTimer.new({ name: 'runnerTimer' }));
        }
      }),
      $.Method.new({
        name: 'runMod',
        async: true,
        async do(mod) {
          this.log(`run ${mod.title()}`);
          const baseMod = __.mod();
          __.mod(mod);
          const cases = mod.instances($.Case);
          if (cases === undefined) {
            throw new Error(`no cases in module ${mod.description()}`);
          }
          for (const testCase of cases) {
            await testCase.run();
          }
          const n = Object.values(cases).length;
          this.log(mod.title(), `${n} test cases passed`);
          __.mod(baseMod);
        }
      }),
      $.Method.new({
        name: 'loadFile',
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
              const mod = await this.loadFile(filePath);
              await this.runMod(mod);
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

  if (require.main === module) {
    const runner = $.TestRunner.new();
    await runner.run('tests');
  }
}.module({
  name: 'runner',
  imports: [test],
}).load();
