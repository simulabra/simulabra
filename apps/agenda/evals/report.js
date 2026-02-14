#!/usr/bin/env bun
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { __, base } from 'simulabra';

export default await async function (_, $) {
  $.Class.new({
    name: 'ReportFormatter',
    doc: 'Transforms a JSON eval report into human-readable markdown',
    slots: [
      $.Var.new({ name: 'maxSystemPromptChars', default: 200 }),
      $.Var.new({ name: 'maxToolResultChars', default: 300 }),

      $.Method.new({
        name: 'format',
        doc: 'produce full markdown report from parsed JSON report data',
        do(report) {
          const lines = [];
          const ts = new Date(report.timestamp);
          const dateStr = ts.toISOString().replace('T', ' ').slice(0, 16);

          lines.push(`# Geist Eval Report — ${dateStr}`);
          lines.push('');

          lines.push(this.formatSummary(report));
          lines.push('');

          if (report.metadata) {
            lines.push(this.formatMetadata(report.metadata));
            lines.push('');
          }

          lines.push('## Results');
          lines.push('');
          for (const result of report.results) {
            lines.push(this.formatResult(result));
          }

          return lines.join('\n');
        }
      }),

      $.Method.new({
        name: 'formatSummary',
        doc: 'format the summary section with pass/fail counts and duration',
        do(report) {
          const s = report.summary;
          const lines = ['## Summary'];
          lines.push(`- ${s.passed}/${s.passed + s.failed} passed`);
          lines.push(`- Total duration: ${(s.totalDurationMs / 1000).toFixed(1)}s`);
          if (s.totalCost > 0) {
            lines.push(`- Total cost: $${s.totalCost.toFixed(4)}`);
          }
          if (report.metadata?.model) {
            lines.push(`- Model: ${report.metadata.model}`);
          }
          return lines.join('\n');
        }
      }),

      $.Method.new({
        name: 'formatMetadata',
        doc: 'format run metadata section',
        do(metadata) {
          const lines = ['## Metadata'];
          if (metadata.model) lines.push(`- **Model**: ${metadata.model}`);
          if (metadata.gitCommit) lines.push(`- **Git commit**: \`${metadata.gitCommit}\``);
          if (metadata.seedVersion) lines.push(`- **Seed version**: ${metadata.seedVersion}`);
          if (metadata.systemPromptHash) lines.push(`- **System prompt hash**: \`${metadata.systemPromptHash}\``);
          return lines.join('\n');
        }
      }),

      $.Method.new({
        name: 'formatResult',
        doc: 'format a single scenario result with all trace details',
        do(result) {
          const lines = [];
          const status = result.success ? 'PASS' : 'FAIL';
          const duration = (result.durationMs / 1000).toFixed(1);

          lines.push(`### [${status}] ${result.title} (${duration}s)`);
          lines.push('');

          const inputs = this.extractUserInputs(result.traces || []);
          for (const input of inputs) {
            lines.push(`**Input**: "${input}"`);
          }

          const systemPrompt = this.extractSystemPrompt(result.traces || []);
          if (systemPrompt) {
            const abbrev = systemPrompt.length > this.maxSystemPromptChars()
              ? systemPrompt.slice(0, this.maxSystemPromptChars()) + '…'
              : systemPrompt;
            lines.push(`**System prompt**: ${abbrev}`);
          }

          if (result.toolsExecuted?.length > 0) {
            const toolStrs = result.toolsExecuted.map(t => {
              const args = JSON.stringify(t.input || {});
              const abbrev = args.length > 120 ? args.slice(0, 120) + '…' : args;
              return `${t.tool}(${abbrev})`;
            });
            lines.push(`**Tools called**: ${toolStrs.join(', ')}`);
          }

          const toolResults = this.extractToolResults(result.traces || []);
          if (toolResults.length > 0) {
            const max = this.maxToolResultChars();
            const abbrev = toolResults.map(tr => {
              const s = JSON.stringify(tr);
              return s.length > max ? s.slice(0, max) + '…' : s;
            });
            lines.push(`**Tool results**: ${abbrev.join('; ')}`);
          }

          const responses = this.extractResponses(result.traces || []);
          for (const resp of responses) {
            lines.push(`**Response**: "${resp}"`);
          }

          const dbParts = this.formatDbDiff(result.dbDiff);
          if (dbParts.length > 0) {
            lines.push(`**DB changes**: ${dbParts.join(', ')}`);
          }

          if (!result.success && result.error) {
            lines.push(`**Error**: ${result.error}`);
          }

          if (result.cost) {
            lines.push(`**Cost**: $${result.cost.totalCost.toFixed(4)} (${result.cost.totalInputTokens} in / ${result.cost.totalOutputTokens} out)`);
          }

          lines.push('');
          return lines.join('\n');
        }
      }),

      $.Method.new({
        name: 'extractUserInputs',
        doc: 'pull user message text from API traces',
        do(traces) {
          return traces.map(t => {
            const msgs = t.request?.messages || [];
            const userMsgs = msgs.filter(m => m.role === 'user');
            const last = userMsgs[userMsgs.length - 1];
            if (!last) return null;
            if (typeof last.content === 'string') return last.content;
            if (Array.isArray(last.content)) {
              return last.content
                .filter(b => b.type === 'text' || typeof b === 'string')
                .map(b => typeof b === 'string' ? b : b.text)
                .join('');
            }
            return null;
          }).filter(Boolean);
        }
      }),

      $.Method.new({
        name: 'extractSystemPrompt',
        doc: 'get system prompt from the first trace request',
        do(traces) {
          if (traces.length === 0) return null;
          return traces[0].request?.system || null;
        }
      }),

      $.Method.new({
        name: 'extractResponses',
        doc: 'pull assistant text blocks from API traces',
        do(traces) {
          return traces.flatMap(t =>
            (t.response?.content || [])
              .filter(b => b.type === 'text')
              .map(b => b.text)
          ).filter(Boolean);
        }
      }),

      $.Method.new({
        name: 'extractToolResults',
        doc: 'pull tool_result content blocks from multi-turn traces',
        do(traces) {
          return traces.flatMap(t => {
            const msgs = t.request?.messages || [];
            return msgs.flatMap(m => {
              if (typeof m.content === 'string') return [];
              if (!Array.isArray(m.content)) return [];
              return m.content
                .filter(b => b.type === 'tool_result')
                .map(b => b.content);
            });
          }).filter(Boolean);
        }
      }),

      $.Method.new({
        name: 'formatDbDiff',
        doc: 'format snapshot diff into readable strings per table',
        do(dbDiff) {
          if (!dbDiff) return [];
          const parts = [];
          for (const [table, diff] of Object.entries(dbDiff)) {
            const segments = [];
            if (diff.created?.length) {
              const titles = diff.created.map(r => r.title || r.content || r.message || r.id).join(', ');
              segments.push(`+${diff.created.length} (${titles})`);
            }
            if (diff.modified?.length) segments.push(`~${diff.modified.length}`);
            if (diff.deleted?.length) segments.push(`-${diff.deleted.length}`);
            if (segments.length) parts.push(`${table}: ${segments.join(' ')}`);
          }
          return parts;
        }
      }),
    ]
  });

  if (import.meta.main) {
    const filePath = process.argv[2];
    if (!filePath) {
      console.error('Usage: bun run evals/report.js <report.json>');
      process.exit(1);
    }
    const raw = JSON.parse(await readFile(resolve(filePath), 'utf8'));
    const formatter = _.ReportFormatter.new();
    const markdown = formatter.format(raw);
    console.log(markdown);
  }
}.module({
  name: 'eval.report',
  imports: [base],
}).load();
