#!/usr/bin/env bun
import { config } from 'dotenv';
import { resolve } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

config({ path: resolve(import.meta.dir, '../../../.env') });

import { __, base } from 'simulabra';
import framework from './framework.js';
import reportMod from './report.js';
import { SEED_VERSION } from './seed.js';

import './scenarios/basic.js';
import './scenarios/realistic.js';
import './scenarios/tasks.js';
import './scenarios/projects.js';
import './scenarios/logs.js';
import './scenarios/reminders.js';
import './scenarios/multiturn.js';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';

function formatCost(dollars) {
  if (dollars < 0.001) return `$${(dollars * 100).toFixed(4)}c`;
  return `$${dollars.toFixed(4)}`;
}

function extractUserInput(traces) {
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

function extractAssistantOutput(traces) {
  return traces.flatMap(t => {
    const blocks = t.response?.content || [];
    return blocks
      .filter(b => b.type === 'text')
      .map(b => b.text);
  }).filter(Boolean);
}

function formatDbDiff(dbDiff) {
  if (!dbDiff) return [];
  const parts = [];
  for (const [table, diff] of Object.entries(dbDiff)) {
    const segments = [];
    if (diff.created.length) segments.push(`+${diff.created.length}`);
    if (diff.modified.length) segments.push(`~${diff.modified.length}`);
    if (diff.deleted.length) segments.push(`-${diff.deleted.length}`);
    if (segments.length) parts.push(`${table}: ${segments.join(' ')}`);
  }
  return parts;
}

function collectMetadata(results) {
  const firstTrace = results.flatMap(r => r.traces || []).find(t => t.request);
  const model = firstTrace?.request?.model || 'unknown';
  const systemPrompt = firstTrace?.request?.system || '';
  const systemPromptHash = createHash('sha256').update(systemPrompt).digest('hex').slice(0, 12);

  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse HEAD', { cwd: resolve(import.meta.dir, '../../..'), encoding: 'utf8' }).trim();
  } catch {}

  return { model, systemPromptHash, seedVersion: SEED_VERSION, gitCommit };
}

await async function (_, $, $framework, $report) {
  const filter = process.argv[2] || null;

  const allCases = $framework.EvalCase.instances();
  const cases = filter
    ? allCases.filter(c => c.title().toLowerCase().includes(filter.toLowerCase()))
    : allCases;

  if (cases.length === 0) {
    console.log(filter ? `No eval cases matching "${filter}"` : 'No eval cases found');
    process.exit(1);
  }

  console.log(`\nRunning ${cases.length} eval${cases.length !== 1 ? 's' : ''}...\n`);

  const results = [];
  const runStart = Date.now();
  let runCost = 0;

  for (const evalCase of cases) {
    const result = await evalCase.run();
    results.push(result);

    const status = result.success ? `${GREEN}[PASS]${RESET}` : `${RED}[FAIL]${RESET}`;
    const duration = (result.durationMs / 1000).toFixed(1);
    const costStr = result.cost ? ` ${DIM}${formatCost(result.cost.totalCost)}${RESET}` : '';
    console.log(`${status} ${result.title} (${duration}s)${costStr}`);

    const inputs = extractUserInput(result.traces);
    for (const input of inputs) {
      console.log(`  ${CYAN}> ${input}${RESET}`);
    }

    const outputs = extractAssistantOutput(result.traces);
    for (const output of outputs) {
      console.log(`  ${DIM}${output}${RESET}`);
    }

    if (result.success && result.toolsExecuted.length > 0) {
      console.log(`  ${YELLOW}tools: ${result.toolsExecuted.map(t => t.tool).join(', ')}${RESET}`);
    }
    const diffParts = formatDbDiff(result.dbDiff);
    if (diffParts.length > 0) {
      console.log(`  ${DIM}db: ${diffParts.join(', ')}${RESET}`);
    }
    if (result.cost) {
      const c = result.cost;
      console.log(`  ${DIM}tokens: ${c.totalInputTokens} in / ${c.totalOutputTokens} out${RESET}`);
      runCost += c.totalCost;
    }
    if (!result.success) {
      console.log(`  ${RED}error: ${result.error}${RESET}`);
    }
    console.log();
  }

  const totalDurationMs = Date.now() - runStart;
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  let summary = `${passed} passed, ${failed} failed (${(totalDurationMs / 1000).toFixed(1)}s)`;
  if (runCost > 0) {
    summary += ` ${DIM}cost: ${formatCost(runCost)}${RESET}`;
  }
  console.log(summary + '\n');

  const resultsDir = resolve(import.meta.dir, 'results');
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  const metadata = collectMetadata(results);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = resolve(resultsDir, `eval-${timestamp}.json`);
  const report = {
    timestamp: new Date().toISOString(),
    metadata,
    results,
    summary: { passed, failed, totalDurationMs, totalCost: runCost },
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);

  const formatter = $report.ReportFormatter.new();
  const mdPath = reportPath.replace(/\.json$/, '.md');
  writeFileSync(mdPath, formatter.format(report));
  console.log(`Markdown: ${mdPath}\n`);

  process.exit(failed > 0 ? 1 : 0);
}.module({
  name: 'eval.runner',
  imports: [base, framework, reportMod],
}).load();
