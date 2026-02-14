#!/usr/bin/env bun
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { __, base } from 'simulabra';

export default await async function (_, $) {
  $.Class.new({
    name: 'RunComparator',
    doc: 'Compares two eval runs and reports status flips, duration changes, and tool differences',
    slots: [
      $.Var.new({ name: 'durationThreshold', default: 0.2 }),

      $.Method.new({
        name: 'compare',
        doc: 'compare two parsed JSON reports and return structured diff',
        do(runA, runB) {
          const aByTitle = new Map(runA.results.map(r => [r.title, r]));
          const bByTitle = new Map(runB.results.map(r => [r.title, r]));

          const allTitles = new Set([...aByTitle.keys(), ...bByTitle.keys()]);
          const statusFlips = [];
          const durationChanges = [];
          const toolDiffs = [];
          const added = [];
          const removed = [];

          for (const title of allTitles) {
            const a = aByTitle.get(title);
            const b = bByTitle.get(title);

            if (!a) { added.push({ title, result: b }); continue; }
            if (!b) { removed.push({ title, result: a }); continue; }

            if (a.success !== b.success) {
              statusFlips.push({
                title,
                from: a.success ? 'PASS' : 'FAIL',
                to: b.success ? 'PASS' : 'FAIL',
              });
            }

            if (a.durationMs && b.durationMs) {
              const ratio = b.durationMs / a.durationMs;
              if (Math.abs(ratio - 1) > this.durationThreshold()) {
                durationChanges.push({
                  title,
                  fromMs: a.durationMs,
                  toMs: b.durationMs,
                  changePercent: ((ratio - 1) * 100).toFixed(0),
                });
              }
            }

            const aTools = (a.toolsExecuted || []).map(t => t.tool).sort().join(',');
            const bTools = (b.toolsExecuted || []).map(t => t.tool).sort().join(',');
            if (aTools !== bTools) {
              toolDiffs.push({
                title,
                from: aTools || '(none)',
                to: bTools || '(none)',
              });
            }
          }

          return { statusFlips, durationChanges, toolDiffs, added, removed };
        }
      }),

      $.Method.new({
        name: 'formatDiff',
        doc: 'render a comparison diff as readable markdown',
        do(diff, labelA, labelB) {
          const lines = [];
          lines.push(`# Run Comparison`);
          lines.push(`- **Run A**: ${labelA}`);
          lines.push(`- **Run B**: ${labelB}`);
          lines.push('');

          if (diff.statusFlips.length > 0) {
            lines.push('## Status Changes');
            for (const f of diff.statusFlips) {
              lines.push(`- **${f.title}**: ${f.from} → ${f.to}`);
            }
            lines.push('');
          }

          if (diff.durationChanges.length > 0) {
            lines.push('## Duration Changes (>20%)');
            for (const d of diff.durationChanges) {
              const sign = d.changePercent > 0 ? '+' : '';
              lines.push(`- **${d.title}**: ${(d.fromMs/1000).toFixed(1)}s → ${(d.toMs/1000).toFixed(1)}s (${sign}${d.changePercent}%)`);
            }
            lines.push('');
          }

          if (diff.toolDiffs.length > 0) {
            lines.push('## Tool Differences');
            for (const t of diff.toolDiffs) {
              lines.push(`- **${t.title}**: [${t.from}] → [${t.to}]`);
            }
            lines.push('');
          }

          if (diff.added.length > 0) {
            lines.push('## New Scenarios (in B only)');
            for (const a of diff.added) {
              lines.push(`- **${a.title}**: ${a.result.success ? 'PASS' : 'FAIL'}`);
            }
            lines.push('');
          }

          if (diff.removed.length > 0) {
            lines.push('## Removed Scenarios (in A only)');
            for (const r of diff.removed) {
              lines.push(`- **${r.title}**: ${r.result.success ? 'PASS' : 'FAIL'}`);
            }
            lines.push('');
          }

          if (diff.statusFlips.length === 0 && diff.durationChanges.length === 0 && diff.toolDiffs.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
            lines.push('No significant differences found.');
            lines.push('');
          }

          return lines.join('\n');
        }
      }),
    ]
  });

  if (import.meta.main) {
    const [fileA, fileB] = process.argv.slice(2);
    if (!fileA || !fileB) {
      console.error('Usage: bun run evals/compare.js <run1.json> <run2.json>');
      process.exit(1);
    }
    const runA = JSON.parse(await readFile(resolve(fileA), 'utf8'));
    const runB = JSON.parse(await readFile(resolve(fileB), 'utf8'));

    const comparator = _.RunComparator.new();
    const diff = comparator.compare(runA, runB);
    console.log(comparator.formatDiff(diff, fileA, fileB));
  }
}.module({
  name: 'eval.compare',
  imports: [base],
}).load();
