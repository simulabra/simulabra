import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { __, base } from '../src/base.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'SgitRepo',
    doc: 'A single git repo managed by sgit',
    slots: [
      $.Var.new({ name: 'path' }),
      $.Var.new({ name: 'label' }),
      $.Method.new({
        name: 'exists',
        do() {
          return existsSync(join(this.path(), '.git'));
        }
      }),
      $.Method.new({
        name: 'exec',
        do(args) {
          const result = Bun.spawnSync(['git', ...args], {
            cwd: this.path(),
            stdout: 'pipe',
            stderr: 'pipe',
          });
          return {
            stdout: result.stdout.toString(),
            stderr: result.stderr.toString(),
            exitCode: result.exitCode,
          };
        }
      }),
    ]
  });

  $.Class.new({
    name: 'SgitConfig',
    doc: 'Finds and loads sgit.json configuration',
    slots: [
      $.Var.new({ name: 'configPath' }),
      $.Var.new({ name: 'repos' }),
      $.Static.new({
        name: 'find',
        doc: 'Walk up from cwd to find sgit.json, return SgitConfig',
        do() {
          let dir = process.cwd();
          while (true) {
            const candidate = join(dir, 'sgit.json');
            if (existsSync(candidate)) {
              const data = JSON.parse(require('fs').readFileSync(candidate, 'utf8'));
              const root = dirname(candidate);
              const repos = data.repos.map(r => _.SgitRepo.new({
                path: resolve(root, r.path),
                label: r.label,
              }));
              return _.SgitConfig.new({ configPath: candidate, repos });
            }
            const parent = dirname(dir);
            if (parent === dir) break;
            dir = parent;
          }
          throw new Error('sgit.json not found (walked up from ' + process.cwd() + ')');
        }
      }),
    ]
  });

  $.Class.new({
    name: 'Sgit',
    doc: 'Multi-repo git orchestrator',
    slots: [
      $.Var.new({ name: 'config' }),
      $.Method.new({
        name: 'labelWidth',
        do() {
          return Math.max(...this.config().repos().map(r => r.label().length));
        }
      }),
      $.Method.new({
        name: 'padLabel',
        do(label) {
          return label.padEnd(this.labelWidth());
        }
      }),
      $.Method.new({
        name: 'run',
        async: true,
        async do(args) {
          const cmd = args[0];
          const rest = args.slice(1);
          if (cmd === 'status') return this.status();
          if (cmd === 'branch') return this.branch(rest);
          if (cmd === 'diff') return this.diff(rest);
          if (!cmd) return this.status();
          return this.passthrough(args);
        }
      }),
      $.Method.new({
        name: 'status',
        do() {
          for (const repo of this.config().repos()) {
            if (!repo.exists()) {
              console.log(`${this.padLabel(repo.label())}  (not found)`);
              continue;
            }
            const result = repo.exec(['status', '--porcelain']);
            const lines = result.stdout.trim().split('\n').filter(l => l);
            if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
              console.log(`${this.padLabel(repo.label())}  clean`);
            } else {
              const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length;
              const untracked = lines.filter(l => l.startsWith('??')).length;
              const staged = lines.filter(l => /^[ADMR] /.test(l)).length;
              const parts = [];
              if (staged) parts.push(`${staged} staged`);
              if (modified) parts.push(`${modified} modified`);
              if (untracked) parts.push(`${untracked} untracked`);
              if (parts.length === 0) parts.push(`${lines.length} changes`);
              console.log(`${this.padLabel(repo.label())}  ${parts.join(', ')}`);
            }
          }
        }
      }),
      $.Method.new({
        name: 'branch',
        do(args) {
          if (args.length === 0) {
            for (const repo of this.config().repos()) {
              if (!repo.exists()) {
                console.log(`${this.padLabel(repo.label())}  (not found)`);
                continue;
              }
              const result = repo.exec(['branch', '--show-current']);
              console.log(`${this.padLabel(repo.label())}  ${result.stdout.trim()}`);
            }
          } else {
            this.passthrough(['branch', ...args]);
          }
        }
      }),
      $.Method.new({
        name: 'diff',
        do(args) {
          for (const repo of this.config().repos()) {
            if (!repo.exists()) continue;
            const result = repo.exec(['diff', '--color=always', ...args]);
            const output = result.stdout.trim();
            if (output) {
              console.log(`── ${repo.label()} ${'─'.repeat(Math.max(0, 40 - repo.label().length))}`)
              console.log(output);
              console.log();
            }
          }
        }
      }),
      $.Method.new({
        name: 'passthrough',
        do(args) {
          for (const repo of this.config().repos()) {
            if (!repo.exists()) {
              console.log(`── ${repo.label()} ${'─'.repeat(Math.max(0, 40 - repo.label().length))}`);
              console.log('  (not found)');
              continue;
            }
            const result = repo.exec([...args, '--color=always']);
            const output = result.stdout.trim();
            console.log(`── ${repo.label()} ${'─'.repeat(Math.max(0, 40 - repo.label().length))}`);
            if (output) {
              console.log(output);
            } else if (result.stderr.trim()) {
              console.log(result.stderr.trim());
            }
          }
        }
      }),
    ]
  });

  if (require.main === module) {
    const config = _.SgitConfig.find();
    const sgit = _.Sgit.new({ config });
    await sgit.run(process.argv.slice(2));
    process.exit(0);
  }
}.module({
  name: 'sgit',
  imports: [base],
}).load();
