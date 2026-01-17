import { __, base } from 'simulabra';
import test from 'simulabra/test';
import logs from '../src/logs.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export default await async function (_, $, $test, $logs) {
  const testDir = join(tmpdir(), 'agenda-logs-test-' + Date.now());

  function setup() {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    mkdirSync(testDir, { recursive: true });
  }

  function teardown() {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  }

  $test.Case.new({
    name: 'FileTailExists',
    doc: 'FileTail.exists returns false for non-existent file',
    do() {
      const tail = $logs.FileTail.new({ filepath: '/nonexistent/path.log' });
      this.assertEq(tail.exists(), false, 'should not exist');
    }
  });

  $test.Case.new({
    name: 'FileTailExistsTrue',
    doc: 'FileTail.exists returns true for existing file',
    do() {
      setup();
      try {
        const filepath = join(testDir, 'test.log');
        writeFileSync(filepath, 'hello\n');
        const tail = $logs.FileTail.new({ filepath });
        this.assertEq(tail.exists(), true, 'should exist');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'FileTailSize',
    doc: 'FileTail.size returns file size in bytes',
    do() {
      setup();
      try {
        const filepath = join(testDir, 'test.log');
        writeFileSync(filepath, 'hello\n');
        const tail = $logs.FileTail.new({ filepath });
        this.assertEq(tail.size(), 6, 'should be 6 bytes');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'FileTailReadNew',
    doc: 'FileTail.readNew returns new content since last read',
    do() {
      setup();
      try {
        const filepath = join(testDir, 'test.log');
        writeFileSync(filepath, 'line1\nline2\n');
        const tail = $logs.FileTail.new({ filepath });

        const lines = tail.readNew();
        this.assertEq(lines.length, 2, 'should have 2 lines');
        this.assertEq(lines[0], 'line1');
        this.assertEq(lines[1], 'line2');

        const noLines = tail.readNew();
        this.assertEq(noLines.length, 0, 'should have no new lines');

        writeFileSync(filepath, 'line1\nline2\nline3\n');
        const newLines = tail.readNew();
        this.assertEq(newLines.length, 1, 'should have 1 new line');
        this.assertEq(newLines[0], 'line3');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'FileTailTail',
    doc: 'FileTail.tail returns last N lines',
    do() {
      setup();
      try {
        const filepath = join(testDir, 'test.log');
        writeFileSync(filepath, 'line1\nline2\nline3\nline4\nline5\n');
        const tail = $logs.FileTail.new({ filepath });

        const lines = tail.tail(3);
        this.assertEq(lines.length, 3, 'should have 3 lines');
        this.assertEq(lines[0], 'line3');
        this.assertEq(lines[1], 'line4');
        this.assertEq(lines[2], 'line5');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'FileTailTailUpdatesPosition',
    doc: 'FileTail.tail updates position so readNew starts from end',
    do() {
      setup();
      try {
        const filepath = join(testDir, 'test.log');
        writeFileSync(filepath, 'line1\nline2\n');
        const tail = $logs.FileTail.new({ filepath });

        tail.tail(10);
        const noLines = tail.readNew();
        this.assertEq(noLines.length, 0, 'should have no new lines after tail');

        writeFileSync(filepath, 'line1\nline2\nline3\n');
        const newLines = tail.readNew();
        this.assertEq(newLines.length, 1, 'should have 1 new line');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'LogFormatterColorFor',
    doc: 'LogFormatter returns correct colors for known services',
    do() {
      const formatter = $logs.LogFormatter.new();

      this.assertEq(formatter.colorFor('supervisor'), '\x1b[36m', 'supervisor is cyan');
      this.assertEq(formatter.colorFor('DatabaseService'), '\x1b[32m', 'db is green');
      this.assertEq(formatter.colorFor('unknown'), '\x1b[37m', 'unknown is white');
    }
  });

  $test.Case.new({
    name: 'LogFormatterFormat',
    doc: 'LogFormatter formats lines with colored prefix',
    do() {
      const formatter = $logs.LogFormatter.new();
      const line = formatter.format('supervisor', 'test message');

      this.assert(line.includes('\x1b[36m'), 'should include cyan color');
      this.assert(line.includes('[supervisor]'), 'should include service name');
      this.assert(line.includes('test message'), 'should include message');
      this.assert(line.includes('\x1b[0m'), 'should include reset');
    }
  });

  $test.Case.new({
    name: 'LogFormatterFormatHeader',
    doc: 'LogFormatter formats headers with dashes',
    do() {
      const formatter = $logs.LogFormatter.new();
      const header = formatter.formatHeader('supervisor', 'Last 20 lines');

      this.assert(header.includes('[supervisor]'), 'should include service name');
      this.assert(header.includes('--- Last 20 lines ---'), 'should include text with dashes');
    }
  });

  $test.Case.new({
    name: 'LogStreamerServiceNameFromFile',
    doc: 'LogStreamer extracts service name from filename',
    do() {
      const streamer = $logs.LogStreamer.new({ logsDir: testDir });

      this.assertEq(streamer.serviceNameFromFile('supervisor.log'), 'supervisor');
      this.assertEq(streamer.serviceNameFromFile('DatabaseService.log'), 'DatabaseService');
    }
  });

  $test.Case.new({
    name: 'LogStreamerLogFiles',
    doc: 'LogStreamer lists only .log files',
    do() {
      setup();
      try {
        writeFileSync(join(testDir, 'service.log'), 'log content');
        writeFileSync(join(testDir, 'other.txt'), 'text content');
        writeFileSync(join(testDir, 'another.log'), 'more logs');

        const streamer = $logs.LogStreamer.new({ logsDir: testDir });
        const files = streamer.logFiles();

        this.assertEq(files.length, 2, 'should have 2 log files');
        this.assert(files.includes('service.log'), 'should include service.log');
        this.assert(files.includes('another.log'), 'should include another.log');
        this.assert(!files.includes('other.txt'), 'should not include txt');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'LogStreamerGetTailCreatesFileTail',
    doc: 'LogStreamer creates and caches FileTail instances',
    do() {
      setup();
      try {
        const streamer = $logs.LogStreamer.new({ logsDir: testDir });

        const tail1 = streamer.getTail('service.log');
        const tail2 = streamer.getTail('service.log');

        this.assertEq(tail1, tail2, 'should return same instance');
        this.assert(tail1.filepath().endsWith('service.log'), 'should have correct filepath');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'LogStreamerScan',
    doc: 'LogStreamer.scan reads new content from all files',
    do() {
      setup();
      try {
        writeFileSync(join(testDir, 'service1.log'), 'line1\nline2\n');
        writeFileSync(join(testDir, 'service2.log'), 'line3\n');

        const output = [];
        const streamer = $logs.LogStreamer.new({
          logsDir: testDir,
          output: (line) => output.push(line)
        });

        const count = streamer.scan();
        this.assertEq(count, 3, 'should read 3 lines total');
        this.assertEq(output.length, 3, 'should output 3 lines');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'LogStreamerShowInitial',
    doc: 'LogStreamer.showInitial outputs last N lines from each file',
    do() {
      setup();
      try {
        writeFileSync(join(testDir, 'supervisor.log'), 'old1\nold2\nnew1\n');

        const output = [];
        const streamer = $logs.LogStreamer.new({
          logsDir: testDir,
          initialTailLines: 2,
          output: (line) => output.push(line)
        });

        streamer.showInitial();

        this.assert(output.some(l => l.includes('Last 2 lines')), 'should show header');
        this.assert(output.some(l => l.includes('old2')), 'should include second-to-last line');
        this.assert(output.some(l => l.includes('new1')), 'should include last line');
        this.assert(!output.some(l => l.includes('old1')), 'should not include first line');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'LogStreamerStop',
    doc: 'LogStreamer.stop cleans up resources',
    do() {
      setup();
      try {
        const streamer = $logs.LogStreamer.new({ logsDir: testDir });
        streamer.startWatching();
        streamer.startPolling();

        this.assert(streamer.watcher(), 'should have watcher');
        this.assert(streamer.pollInterval(), 'should have poll interval');

        streamer.stop();

        this.assertEq(streamer.watcher(), null, 'watcher should be null');
        this.assertEq(streamer.pollInterval(), null, 'pollInterval should be null');
      } finally {
        teardown();
      }
    }
  });

  $test.Case.new({
    name: 'LogStreamerCustomFormatter',
    doc: 'LogStreamer can use custom formatter',
    do() {
      setup();
      try {
        writeFileSync(join(testDir, 'test.log'), 'hello\n');

        const customFormatter = $logs.LogFormatter.new({
          colors: { 'test': '\x1b[31m', 'default': '\x1b[90m' }
        });

        const output = [];
        const streamer = $logs.LogStreamer.new({
          logsDir: testDir,
          formatter: customFormatter,
          output: (line) => output.push(line)
        });

        streamer.scan();

        this.assert(output[0].includes('\x1b[31m'), 'should use custom red color');
      } finally {
        teardown();
      }
    }
  });
}.module({
  name: 'test.logs',
  imports: [base, test, logs],
}).load();
