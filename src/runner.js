import { readdir } from 'fs/promises';
import { join, dirname, relative } from 'path';
import base from './base.js';
import test from './test.js';
const __ = globalThis.SIMULABRA;

export default await __.$().Module.new({
  name: 'runner',
  imports: [test],
  async mod(_, $) {
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
          name: 'run_mod',
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

    const runner = $.TestRunner.new();
    await runner.run('tests');
  }
}).load();
