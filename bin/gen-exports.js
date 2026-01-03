import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { __, base } from '../src/base.js';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const PKG_PATH = join(ROOT, 'package.json');

export default await async function (_, $) {
  $.Class.new({
    name: 'ExportsGenerator',
    doc: 'Generates package.json exports from src/ modules',
    slots: [
      $.Var.new({ name: 'exclude', default: () => new Set(['runner.js']) }),
      $.Method.new({
        name: 'modules',
        async: true,
        async do() {
          const files = await readdir(SRC);
          return files
            .filter(f => f.endsWith('.js') && !this.exclude().has(f))
            .map(f => f.replace('.js', ''));
        }
      }),
      $.Method.new({
        name: 'buildExports',
        async: true,
        async do() {
          const mods = await this.modules();
          const exports = { '.': './src/base.js' };
          for (const mod of mods) {
            if (mod !== 'base') {
              exports[`./${mod}`] = `./src/${mod}.js`;
            }
          }
          return exports;
        }
      }),
      $.Method.new({
        name: 'run',
        async: true,
        async do() {
          const exports = await this.buildExports();
          const pkg = await Bun.file(PKG_PATH).json();
          pkg.exports = exports;
          await Bun.write(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
          console.log('Updated exports:');
          for (const [key, val] of Object.entries(exports)) {
            console.log(`  ${key} → ${val}`);
          }
        }
      }),
    ]
  });

  if (require.main === module) {
    await _.ExportsGenerator.new().run();
    process.exit(0);
  }
}.module({
  name: 'gen-exports',
  imports: [base],
}).load();
