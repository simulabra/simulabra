import './domshim.js';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { __, base } from '../src/base.js';

export default await async function (_, $) {
  $.Class.new({
    name: 'ModuleLister',
    slots: [
      $.Method.new({
        name: 'loadFile',
        async: true,
        async do(filePath) {
          const esm = await import(filePath);
          if (esm.default) return esm.default;
          for (const key of Object.keys(esm)) {
            const val = esm[key];
            if (val && typeof val.registry === 'function') return val;
          }
          return null;
        }
      }),
      $.Method.new({
        name: 'extractClassLines',
        do(source) {
          const lineMap = {};
          const lines = source.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (!/\.Class\.new\s*\(\s*\{/.test(lines[i])) continue;
            const startLine = i + 1;
            let className = null;
            for (let j = i; j < Math.min(i + 5, lines.length); j++) {
              const nameMatch = lines[j].match(/name:\s*['"]([^'"]+)['"]/);
              if (nameMatch) {
                className = nameMatch[1];
                break;
              }
            }
            if (!className) continue;
            let braceCount = 0;
            let started = false;
            let endLine = startLine;
            for (let j = i; j < lines.length; j++) {
              const chars = lines[j];
              let inString = false;
              let stringChar = null;
              for (let k = 0; k < chars.length; k++) {
                const c = chars[k];
                const prev = k > 0 ? chars[k-1] : '';
                if ((c === '"' || c === "'" || c === '`') && prev !== '\\') {
                  if (!inString) {
                    inString = true;
                    stringChar = c;
                  } else if (c === stringChar) {
                    inString = false;
                    stringChar = null;
                  }
                  continue;
                }
                if (inString) continue;
                if (c === '{') {
                  braceCount++;
                  started = true;
                } else if (c === '}') {
                  braceCount--;
                  if (started && braceCount === 0) {
                    endLine = j + 1;
                    break;
                  }
                }
              }
              if (started && braceCount === 0) break;
            }
            lineMap[className] = { start: startLine, end: endLine };
          }
          return lineMap;
        }
      }),
      $.Method.new({
        name: 'extractParams',
        do(fn) {
          if (!fn) return '';
          const str = fn.toString();
          const match = str.match(/^(?:async\s+)?(?:function\s*)?\w*\s*\(([^)]*)\)/);
          return (match && match[1].trim()) ? `(${match[1].trim()})` : '';
        }
      }),
      $.Method.new({
        name: 'formatSlot',
        do(slot) {
          if (typeof slot === 'function') {
            return `  $.Method#${slot.name}${this.extractParams(slot)}`;
          }
          if (!slot.class) return null;
          const typeName = slot.class().name;
          const slotName = slot.name;
          const doc = slot.doc?.() || '';
          let signature = `  $.${typeName}#${slotName}`;
          if (['Method', 'Before', 'After', 'Static'].includes(typeName)) {
            signature += this.extractParams(slot.do?.());
          }
          if (doc) signature += ` ${doc}`;
          return signature;
        }
      }),
      $.Method.new({
        name: 'formatClass',
        do(cls, lineInfo) {
          const header = lineInfo
            ? `${cls.name}:${lineInfo.start}-${lineInfo.end}`
            : cls.name;
          const lines = [header];
          for (const slot of cls.slots()) {
            if (slot.class?.().name === 'Class') continue;
            const formatted = this.formatSlot(slot);
            if (formatted) lines.push(formatted);
          }
          return lines.join('\n');
        }
      }),
      $.Method.new({
        name: 'listClasses',
        do(mod, lineMap = {}, filter = null) {
          if (!mod || typeof mod.registry !== 'function') {
            return '(no classes found - module has no registry)';
          }
          const registry = mod.registry();
          if (!registry) return '(no classes found - registry is null)';
          let classes = registry.instances($.Class);
          if (filter) classes = classes.filter(cls => cls.name === filter);
          if (classes.length === 0) {
            return filter ? `(no classes matching '${filter}')` : '(no classes found)';
          }
          return classes
            .map(cls => this.formatClass(cls, lineMap[cls.name]))
            .join('\n\n');
        }
      }),
      $.Method.new({
        name: 'run',
        async: true,
        async do(filePath, filter = null) {
          const absolutePath = resolve(filePath);
          const source = readFileSync(absolutePath, 'utf-8');
          const lineMap = this.extractClassLines(source);
          const mod = await this.loadFile(absolutePath);
          console.log(this.listClasses(mod, lineMap, filter));
        }
      }),
    ]
  });

  if (require.main === module) {
    const filePath = process.argv[2];
    const filter = process.argv[3] || null;
    if (!filePath) {
      console.error('Usage: bun run bin/lister.js <file.js> [class-filter]');
      process.exit(1);
    }
    const lister = _.ModuleLister.new();
    await lister.run(filePath, filter);
    process.exit(0);
  }
}.module({
  name: 'lister',
  imports: [base],
}).load();
