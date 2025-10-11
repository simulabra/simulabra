import { readdir } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { __, base } from './base.js';
import test from './test.js';

await async function (_, $, $base, $test) {
  $base.Class.new({
    name: 'TestTimer',
    slots: [
      $base.Var.new({ name: 'start' }),
      $base.After.new({
        name: 'init',
        do() {
          this.start(+new Date());
        }
      }),
      $base.Method.new({
        name: 'mark',
        do() {
          return `[${+new Date() - this.start()}ms]`;
        }
      }),
    ]
  });

  $base.Class.new({
    name: 'TestRunner',
    slots: [
      $base.Var.new({
        name: 'timer',
      }),
      $base.After.new({
        name: 'init',
        do() {
          this.timer($.TestTimer.new({ name: 'runnerTimer' }));
        }
      }),
      $base.Method.new({
        name: 'runMod',
        async: true,
        async do(mod) {
          this.log(`run ${mod.title()}`);
          const baseMod = __.mod();
          __.mod(mod);
          const cases = mod.instances($test.Case);
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
      $base.Method.new({
        name: 'loadFile',
        async: true,
        async do(filePath) {
          const esm = await import(filePath);
          return esm.default;
        }
      }),
      $base.Method.new({
        name: 'run',
        async: true,
        async do(path, testName) {
          let files;
          if (testName) {
            const testFile = `${testName}.js`;
            files = [testFile];
          } else {
            files = await readdir(path);
          }

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
      $base.Method.new({
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
    const testName = process.argv[2];
    await runner.run('tests', testName);
    process.exit(0);
  }
}.module({
  name: 'runner',
  imports: [base, test],
}).load();
