import { resolve } from 'path';
import { readdirSync, readFileSync, statSync } from 'fs';
import { __, base } from '../src/base.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'DirectoryTree',
    slots: [
      $.Var.new({
        name: 'ignoreDirs',
        default: () => new Set([
          'node_modules', 'out', 'tmp', 'misc', 'logs',
          'sps', 'me', '.claude', '.git', 'contexts', 'dist'
        ])
      }),
      $.Method.new({
        name: 'extractClassNames',
        do(source) {
          const names = [];
          const lines = source.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (!/\.Class\.new\s*\(\s*\{/.test(lines[i])) continue;
            for (let j = i; j < Math.min(i + 5, lines.length); j++) {
              const m = lines[j].match(/name:\s*['"]([^'"]+)['"]/);
              if (m) {
                names.push(m[1]);
                break;
              }
            }
          }
          return names;
        }
      }),
      $.Method.new({
        name: 'shouldIgnore',
        do(dirName) {
          return this.ignoreDirs().has(dirName);
        }
      }),
      $.Method.new({
        name: 'collectTree',
        do(dirPath) {
          const entries = readdirSync(dirPath, { withFileTypes: true });
          const dirs = [];
          const files = [];
          for (const entry of entries) {
            if (entry.isDirectory()) {
              if (this.shouldIgnore(entry.name)) continue;
              const subtree = this.collectTree(resolve(dirPath, entry.name));
              if (subtree.children.length > 0) {
                dirs.push(subtree);
              }
            } else if (entry.name.endsWith('.js')) {
              const source = readFileSync(resolve(dirPath, entry.name), 'utf-8');
              const classes = this.extractClassNames(source);
              files.push({ name: entry.name, type: 'file', classes });
            }
          }
          dirs.sort((a, b) => a.name.localeCompare(b.name));
          files.sort((a, b) => a.name.localeCompare(b.name));
          return {
            name: dirPath.split('/').pop(),
            type: 'dir',
            children: [...dirs, ...files]
          };
        }
      }),
      $.Method.new({
        name: 'formatTree',
        do(node, prefix = '', isRoot = true) {
          const lines = [];
          if (isRoot) {
            for (const child of node.children) {
              if (child.type === 'dir') {
                lines.push(`${child.name}/`);
                lines.push(...this.formatSubtree(child.children, ''));
              } else {
                lines.push(child.name);
                if (child.classes.length > 0) {
                  lines.push(`    ${child.classes.join(', ')}`);
                }
              }
            }
          }
          return lines.join('\n');
        }
      }),
      $.Method.new({
        name: 'formatSubtree',
        do(children, prefix) {
          const lines = [];
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const isLast = i === children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const extension = isLast ? '    ' : '│   ';
            if (child.type === 'dir') {
              lines.push(`${prefix}${connector}${child.name}/`);
              lines.push(...this.formatSubtree(child.children, prefix + extension));
            } else {
              lines.push(`${prefix}${connector}${child.name}`);
              if (child.classes.length > 0) {
                lines.push(`${prefix}${extension}${child.classes.join(', ')}`);
              }
            }
          }
          return lines;
        }
      }),
      $.Method.new({
        name: 'run',
        do(targetPath) {
          const root = resolve(targetPath || '.');
          const tree = this.collectTree(root);
          console.log(this.formatTree(tree));
        }
      }),
    ]
  });

  if (require.main === module) {
    const tree = _.DirectoryTree.new();
    tree.run(process.argv[2] || '.');
    process.exit(0);
  }
}.module({
  name: 'tree',
  imports: [base],
}).load();
