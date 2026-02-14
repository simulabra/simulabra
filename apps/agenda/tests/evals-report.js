import { __, base } from 'simulabra';
import test from 'simulabra/test';
import report from '../evals/report.js';
import compare from '../evals/compare.js';

const SAMPLE_REPORT = {
  timestamp: '2026-02-08T14:30:00.000Z',
  metadata: {
    model: 'claude-sonnet-4-20250514',
    systemPromptHash: 'abc123def456',
    seedVersion: 2,
    gitCommit: 'deadbeef1234567890',
  },
  results: [
    {
      title: 'Create a task from natural language',
      success: true,
      durationMs: 3200,
      traces: [{
        request: {
          model: 'claude-sonnet-4-20250514',
          system: 'you are a productivity ghost: the geist of SIMULABRA AGENDA.',
          messages: [{ role: 'user', content: 'add a task: buy tiles' }],
        },
        response: {
          content: [
            { type: 'tool_use', name: 'create_task', input: { title: 'Buy tiles', priority: 1 } },
            { type: 'text', text: 'created task "buy tiles"' },
          ],
        },
      }],
      toolsExecuted: [{ tool: 'create_task', input: { title: 'Buy tiles', priority: 1 } }],
      dbDiff: {
        tasks: { created: [{ id: '1', title: 'Buy tiles' }], modified: [], deleted: [] },
        logs: { created: [], modified: [], deleted: [] },
        reminders: { created: [], modified: [], deleted: [] },
        projects: { created: [], modified: [], deleted: [] },
      },
      cost: { totalCost: 0.0045, totalInputTokens: 1200, totalOutputTokens: 80 },
    },
    {
      title: 'Search fails gracefully',
      success: false,
      durationMs: 1500,
      error: 'Expected tool search to be called',
      traces: [],
      toolsExecuted: [],
      dbDiff: null,
    },
  ],
  summary: { passed: 1, failed: 1, totalDurationMs: 4700, totalCost: 0.0045 },
};

const SAMPLE_RUN_A = {
  results: [
    { title: 'Task creation', success: true, durationMs: 3000, toolsExecuted: [{ tool: 'create_task', input: {} }] },
    { title: 'Search logs', success: true, durationMs: 2000, toolsExecuted: [{ tool: 'search', input: {} }] },
    { title: 'Create project', success: true, durationMs: 4000, toolsExecuted: [{ tool: 'create_project', input: {} }] },
  ],
};

const SAMPLE_RUN_B = {
  results: [
    { title: 'Task creation', success: false, durationMs: 5000, toolsExecuted: [{ tool: 'create_task', input: {} }] },
    { title: 'Search logs', success: true, durationMs: 2100, toolsExecuted: [{ tool: 'list_logs', input: {} }] },
    { title: 'New scenario', success: true, durationMs: 1000, toolsExecuted: [] },
  ],
};

export default await async function (_, $, $test, $report, $compare) {
  $test.Case.new({
    name: 'ReportFormatHeader',
    doc: 'Report should have correct title and summary',
    do() {
      const formatter = $report.ReportFormatter.new();
      const md = formatter.format(SAMPLE_REPORT);
      this.assert(md.includes('# Geist Eval Report — 2026-02-08 14:30'), 'should have title with date');
      this.assert(md.includes('1/2 passed'), 'should show pass count');
      this.assert(md.includes('4.7s'), 'should show total duration');
      this.assert(md.includes('claude-sonnet-4-20250514'), 'should show model');
    }
  });

  $test.Case.new({
    name: 'ReportFormatMetadata',
    doc: 'Report should include metadata section',
    do() {
      const formatter = $report.ReportFormatter.new();
      const md = formatter.format(SAMPLE_REPORT);
      this.assert(md.includes('## Metadata'), 'should have metadata section');
      this.assert(md.includes('abc123def456'), 'should show prompt hash');
      this.assert(md.includes('deadbeef1234567890'), 'should show git commit');
      this.assert(md.includes('Seed version**: 2'), 'should show seed version');
    }
  });

  $test.Case.new({
    name: 'ReportFormatPassingResult',
    doc: 'Passing result should show all details',
    do() {
      const formatter = $report.ReportFormatter.new();
      const md = formatter.format(SAMPLE_REPORT);
      this.assert(md.includes('[PASS] Create a task from natural language (3.2s)'), 'should show pass status and duration');
      this.assert(md.includes('add a task: buy tiles'), 'should show user input');
      this.assert(md.includes('create_task('), 'should show tool called');
      this.assert(md.includes('created task "buy tiles"'), 'should show response');
      this.assert(md.includes('tasks: +1 (Buy tiles)'), 'should show DB changes');
      this.assert(md.includes('$0.0045'), 'should show cost');
    }
  });

  $test.Case.new({
    name: 'ReportFormatFailingResult',
    doc: 'Failing result should show error',
    do() {
      const formatter = $report.ReportFormatter.new();
      const md = formatter.format(SAMPLE_REPORT);
      this.assert(md.includes('[FAIL] Search fails gracefully (1.5s)'), 'should show fail status');
      this.assert(md.includes('Expected tool search to be called'), 'should show error');
    }
  });

  $test.Case.new({
    name: 'ReportSystemPromptAbbreviation',
    doc: 'System prompt should be truncated at maxSystemPromptChars',
    do() {
      const formatter = $report.ReportFormatter.new({ maxSystemPromptChars: 30 });
      const md = formatter.format(SAMPLE_REPORT);
      this.assert(md.includes('you are a productivity ghost:'), 'should have start of prompt');
      this.assert(md.includes('…'), 'should have ellipsis for truncation');
    }
  });

  $test.Case.new({
    name: 'ReportNoMetadata',
    doc: 'Report without metadata should skip metadata section',
    do() {
      const formatter = $report.ReportFormatter.new();
      const noMeta = { ...SAMPLE_REPORT, metadata: undefined };
      const md = formatter.format(noMeta);
      this.assert(!md.includes('## Metadata'), 'should not have metadata section');
    }
  });

  $test.Case.new({
    name: 'CompareStatusFlips',
    doc: 'Comparator should detect pass/fail changes',
    do() {
      const comparator = $compare.RunComparator.new();
      const diff = comparator.compare(SAMPLE_RUN_A, SAMPLE_RUN_B);
      this.assertEq(diff.statusFlips.length, 1, 'should find one status flip');
      this.assertEq(diff.statusFlips[0].title, 'Task creation');
      this.assertEq(diff.statusFlips[0].from, 'PASS');
      this.assertEq(diff.statusFlips[0].to, 'FAIL');
    }
  });

  $test.Case.new({
    name: 'CompareDurationChanges',
    doc: 'Comparator should detect significant duration changes',
    do() {
      const comparator = $compare.RunComparator.new();
      const diff = comparator.compare(SAMPLE_RUN_A, SAMPLE_RUN_B);
      const taskDur = diff.durationChanges.find(d => d.title === 'Task creation');
      this.assert(taskDur, 'should detect duration change for Task creation');
      this.assertEq(taskDur.fromMs, 3000);
      this.assertEq(taskDur.toMs, 5000);
      const searchDur = diff.durationChanges.find(d => d.title === 'Search logs');
      this.assert(!searchDur, 'should not flag small duration change for Search logs');
    }
  });

  $test.Case.new({
    name: 'CompareToolDiffs',
    doc: 'Comparator should detect different tool sets',
    do() {
      const comparator = $compare.RunComparator.new();
      const diff = comparator.compare(SAMPLE_RUN_A, SAMPLE_RUN_B);
      const toolDiff = diff.toolDiffs.find(d => d.title === 'Search logs');
      this.assert(toolDiff, 'should detect tool difference for Search logs');
      this.assertEq(toolDiff.from, 'search');
      this.assertEq(toolDiff.to, 'list_logs');
    }
  });

  $test.Case.new({
    name: 'CompareAddedRemoved',
    doc: 'Comparator should detect scenarios added or removed between runs',
    do() {
      const comparator = $compare.RunComparator.new();
      const diff = comparator.compare(SAMPLE_RUN_A, SAMPLE_RUN_B);
      this.assertEq(diff.added.length, 1, 'should find one added scenario');
      this.assertEq(diff.added[0].title, 'New scenario');
      this.assertEq(diff.removed.length, 1, 'should find one removed scenario');
      this.assertEq(diff.removed[0].title, 'Create project');
    }
  });

  $test.Case.new({
    name: 'CompareFormatOutput',
    doc: 'Formatted comparison should include all sections',
    do() {
      const comparator = $compare.RunComparator.new();
      const diff = comparator.compare(SAMPLE_RUN_A, SAMPLE_RUN_B);
      const md = comparator.formatDiff(diff, 'run-a.json', 'run-b.json');
      this.assert(md.includes('# Run Comparison'), 'should have title');
      this.assert(md.includes('## Status Changes'), 'should have status section');
      this.assert(md.includes('PASS → FAIL'), 'should show flip');
      this.assert(md.includes('## Duration Changes'), 'should have duration section');
      this.assert(md.includes('## Tool Differences'), 'should have tool section');
      this.assert(md.includes('## New Scenarios'), 'should have added section');
      this.assert(md.includes('## Removed Scenarios'), 'should have removed section');
    }
  });

  $test.Case.new({
    name: 'CompareIdenticalRuns',
    doc: 'Comparing a run to itself should find no differences',
    do() {
      const comparator = $compare.RunComparator.new();
      const diff = comparator.compare(SAMPLE_RUN_A, SAMPLE_RUN_A);
      this.assertEq(diff.statusFlips.length, 0, 'no status flips');
      this.assertEq(diff.durationChanges.length, 0, 'no duration changes');
      this.assertEq(diff.toolDiffs.length, 0, 'no tool diffs');
      this.assertEq(diff.added.length, 0, 'no added');
      this.assertEq(diff.removed.length, 0, 'no removed');
    }
  });
}.module({
  name: 'test.evals-report',
  imports: [base, test, report, compare],
}).load();
