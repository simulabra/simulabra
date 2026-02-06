#!/usr/bin/env bun
import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { __, base } from 'simulabra';

export default await async function (_, $) {
  $.Class.new({
    name: 'EvalRun',
    doc: 'Parsed representation of a single eval run from a JSON report file',
    slots: [
      $.Var.new({ name: 'file' }),
      $.Var.new({ name: 'timestamp' }),
      $.Var.new({ name: 'results', default: () => [] }),
      $.Var.new({ name: 'summary' }),

      $.Method.new({
        name: 'scenarioCount',
        do() { return this.results().length; }
      }),

      $.Method.new({
        name: 'passed',
        do() { return this.results().filter(r => r.success).length; }
      }),

      $.Method.new({
        name: 'failed',
        do() { return this.results().filter(r => !r.success).length; }
      }),

      $.Method.new({
        name: 'isFullSuite',
        do(suiteSize) { return this.results().length === suiteSize; }
      }),

      $.Method.new({
        name: 'totalTokens',
        do() {
          let input = 0, output = 0;
          for (const r of this.results()) {
            if (r.cost) {
              input += r.cost.totalInputTokens;
              output += r.cost.totalOutputTokens;
            } else {
              for (const t of (r.traces || [])) {
                input += t.response?.usage?.input_tokens || 0;
                output += t.response?.usage?.output_tokens || 0;
              }
            }
          }
          return { input, output };
        }
      }),

      $.Method.new({
        name: 'totalCost',
        do() {
          return this.summary()?.totalCost || 0;
        }
      }),

      $.Static.new({
        name: 'fromFile',
        async do(filePath) {
          const raw = JSON.parse(await readFile(filePath, 'utf8'));
          return _.EvalRun.new({
            file: filePath,
            timestamp: raw.timestamp,
            results: raw.results,
            summary: raw.summary,
          });
        }
      }),
    ]
  });

  $.Class.new({
    name: 'ScenarioStats',
    doc: 'Aggregated statistics for a single scenario across multiple runs',
    slots: [
      $.Var.new({ name: 'title' }),
      $.Var.new({ name: 'executions', default: () => [] }),

      $.Method.new({
        name: 'passRate',
        do() {
          const execs = this.executions();
          if (execs.length === 0) return 0;
          return execs.filter(e => e.success).length / execs.length;
        }
      }),

      $.Method.new({
        name: 'avgDuration',
        do() {
          const execs = this.executions();
          if (execs.length === 0) return 0;
          return execs.reduce((s, e) => s + e.durationMs, 0) / execs.length;
        }
      }),

      $.Method.new({
        name: 'avgTokens',
        do() {
          const execs = this.executions();
          if (execs.length === 0) return { input: 0, output: 0 };
          let input = 0, output = 0;
          for (const e of execs) {
            if (e.cost) {
              input += e.cost.totalInputTokens;
              output += e.cost.totalOutputTokens;
            } else {
              for (const t of (e.traces || [])) {
                input += t.response?.usage?.input_tokens || 0;
                output += t.response?.usage?.output_tokens || 0;
              }
            }
          }
          return {
            input: Math.round(input / execs.length),
            output: Math.round(output / execs.length),
          };
        }
      }),

      $.Method.new({
        name: 'toolSets',
        doc: 'distinct tool combinations observed across executions',
        do() {
          const sets = new Set();
          for (const e of this.executions()) {
            const tools = (e.toolsExecuted || []).map(t => t.tool).sort().join(',');
            if (tools) sets.add(tools);
          }
          return [...sets];
        }
      }),

      $.Method.new({
        name: 'isToolStable',
        do() { return this.toolSets().length <= 1; }
      }),

      $.Method.new({
        name: 'responseExamples',
        doc: 'extract assistant text responses from all executions',
        do() {
          return this.executions().flatMap(e =>
            (e.traces || []).flatMap(t =>
              (t.response?.content || [])
                .filter(b => b.type === 'text')
                .map(b => b.text)
            )
          );
        }
      }),
    ]
  });

  $.Class.new({
    name: 'EvalAnalyzer',
    doc: 'Loads and analyzes eval results across runs',
    slots: [
      $.Var.new({
        name: 'resultsDir',
        default: resolve(import.meta.dir, 'results'),
      }),
      $.Var.new({ name: 'runs', default: () => [] }),

      $.Method.new({
        name: 'load',
        doc: 'load all eval result files from the results directory',
        async do() {
          const dir = this.resultsDir();
          const files = (await readdir(dir))
            .filter(f => f.endsWith('.json') && f.startsWith('eval-'))
            .sort();

          const runs = [];
          for (const file of files) {
            runs.push(await _.EvalRun.fromFile(join(dir, file)));
          }
          this.runs(runs);
          return runs;
        }
      }),

      $.Method.new({
        name: 'scenarioStats',
        doc: 'compute per-scenario statistics across all loaded runs',
        do() {
          const byTitle = {};
          for (const run of this.runs()) {
            for (const result of run.results()) {
              if (!byTitle[result.title]) {
                byTitle[result.title] = _.ScenarioStats.new({ title: result.title });
              }
              byTitle[result.title].executions().push(result);
            }
          }
          return Object.values(byTitle);
        }
      }),

      $.Method.new({
        name: 'totalCost',
        do() {
          return this.runs().reduce((s, r) => s + r.totalCost(), 0);
        }
      }),

      $.Method.new({
        name: 'totalExecutions',
        do() {
          return this.runs().reduce((s, r) => s + r.scenarioCount(), 0);
        }
      }),

      $.Method.new({
        name: 'durationTrend',
        doc: 'full-suite run durations over time',
        do() {
          const maxScenarios = Math.max(...this.runs().map(r => r.scenarioCount()));
          return this.runs()
            .filter(r => r.isFullSuite(maxScenarios))
            .map(r => ({
              timestamp: r.timestamp(),
              durationMs: r.summary().totalDurationMs,
              cost: r.totalCost(),
            }));
        }
      }),

      $.Method.new({
        name: 'report',
        doc: 'generate a text report of the analysis',
        do() {
          const runs = this.runs();
          const lines = [];

          lines.push(`Eval Analysis: ${runs.length} runs, ${this.totalExecutions()} scenario executions`);
          lines.push('');

          for (const stats of this.scenarioStats()) {
            const pr = (stats.passRate() * 100).toFixed(0);
            const dur = (stats.avgDuration() / 1000).toFixed(1);
            const tok = stats.avgTokens();
            const stable = stats.isToolStable();
            const tools = stats.toolSets();

            lines.push(`"${stats.title()}" (${stats.executions().length} runs)`);
            lines.push(`  pass rate: ${pr}%`);
            lines.push(`  avg duration: ${dur}s`);
            lines.push(`  avg tokens: ${tok.input} in / ${tok.output} out`);
            lines.push(`  tools: ${stable ? 'stable' : 'VARIES'} [${tools.join(' | ')}]`);
            lines.push('');
          }

          const trend = this.durationTrend();
          if (trend.length > 1) {
            lines.push('Duration trend (full suites):');
            lines.push('  ' + trend.map(t => `${(t.durationMs/1000).toFixed(1)}s`).join(' → '));
            lines.push('');
          }

          const totalCost = this.totalCost();
          if (totalCost > 0) {
            lines.push(`Total tracked cost: $${totalCost.toFixed(4)}`);
          }

          return lines.join('\n');
        }
      }),
    ]
  });

  if (import.meta.main) {
    const analyzer = _.EvalAnalyzer.new();
    await analyzer.load();
    console.log(analyzer.report());
  }
}.module({
  name: 'eval.analysis',
  imports: [base],
}).load();
