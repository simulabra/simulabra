import { readdir } from 'fs/promises';
import { join } from 'path';
import { __, base } from './base.js';
import test from './test.js';

await async function (_, $, $test) {
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
          this.timer(_.TestTimer.new({ name: 'runnerTimer' }));
        }
      }),
      $.Method.new({
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
        async do(pathArg) {
          let files;
          let basePath;

          if (pathArg.endsWith('.js')) {
            const parts = pathArg.split('/');
            const file = parts.pop();
            basePath = parts.join('/') || '.';
            files = [file];
          } else {
            basePath = pathArg;
            files = (await readdir(pathArg)).filter(f => f.endsWith('.js'));
          }

          for (const file of files) {
            const filePath = join(process.cwd(), join(basePath, file));
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
    const timeoutSec = parseInt(process.env.TIMEOUT || '10', 10);
    setTimeout(() => {
      console.error(`TIMEOUT: test runner exceeded ${timeoutSec}s`);
      process.exit(1);
    }, timeoutSec * 1000);

    const runner = _.TestRunner.new();
    const args = process.argv.slice(2);
    if (args.length === 0) args.push('tests/');
    for (const arg of args) {
      let path;
      if (arg.endsWith('.js') || arg.includes('/')) {
        path = arg;
      } else {
        path = `tests/${arg}.js`;
      }
      await runner.run(path);
    }
    process.exit(0);
  }
}.module({
  name: 'runner',
  imports: [base, test],
}).load();
