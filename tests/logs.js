import { __, base } from '../src/base.js';
import test from '../src/test.js';
import logs from '../src/logs.js';
import { writeFileSync, mkdirSync, rmSync, appendFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export default await async function (_, $, $test, $logs) {
  const testDir = join(tmpdir(), `simulabra-logs-test-${Date.now()}`);

  function setupTestDir() {
    mkdirSync(testDir, { recursive: true });
    return testDir;
  }

  function cleanupTestDir() {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (e) {}
  }

  function writeTestFile(name, content) {
    const filepath = join(testDir, name);
    writeFileSync(filepath, content);
    return filepath;
  }

  $test.Case.new({
    name: 'FileTailExistsTrue',
    doc: 'FileTail.exists() returns true for existing file',
    do() {
      setupTestDir();
      const filepath = writeTestFile('test.log', 'hello');
      const tail = $logs.FileTail.new({ filepath });
      this.assert(tail.exists(), 'file should exist');
      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'FileTailExistsFalse',
    doc: 'FileTail.exists() returns false for missing file',
    do() {
      const tail = $logs.FileTail.new({ filepath: '/nonexistent/path/file.log' });
      this.assert(!tail.exists(), 'file should not exist');
    }
  });

  $test.Case.new({
    name: 'FileTailSize',
    doc: 'FileTail.size() returns correct file size',
    do() {
      setupTestDir();
      const filepath = writeTestFile('size.log', 'hello');
      const tail = $logs.FileTail.new({ filepath });
      this.assertEq(tail.size(), 5);
      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'FileTailSizeEmpty',
    doc: 'FileTail.size() returns 0 for nonexistent file',
    do() {
      const tail = $logs.FileTail.new({ filepath: '/nonexistent/path/file.log' });
      this.assertEq(tail.size(), 0);
    }
  });

  $test.Case.new({
    name: 'FileTailReadNew',
    doc: 'FileTail.readNew() returns new lines since last read',
    do() {
      setupTestDir();
      const filepath = writeTestFile('new.log', 'line1\nline2\n');
      const tail = $logs.FileTail.new({ filepath });

      const lines = tail.readNew();
      this.assertEq(lines.length, 2);
      this.assertEq(lines[0], 'line1');
      this.assertEq(lines[1], 'line2');

      const moreLines = tail.readNew();
      this.assertEq(moreLines.length, 0);

      appendFileSync(filepath, 'line3\n');
      const newLines = tail.readNew();
      this.assertEq(newLines.length, 1);
      this.assertEq(newLines[0], 'line3');

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'FileTailReadNewMissing',
    doc: 'FileTail.readNew() returns empty array for missing file',
    do() {
      const tail = $logs.FileTail.new({ filepath: '/nonexistent/path/file.log' });
      const lines = tail.readNew();
      this.assertEq(lines.length, 0);
    }
  });

  $test.Case.new({
    name: 'FileTailTail',
    doc: 'FileTail.tail() returns last N lines',
    do() {
      setupTestDir();
      const filepath = writeTestFile('tail.log', 'a\nb\nc\nd\ne\n');
      const tail = $logs.FileTail.new({ filepath });

      const lines = tail.tail(3);
      this.assertEq(lines.length, 3);
      this.assertEq(lines[0], 'c');
      this.assertEq(lines[1], 'd');
      this.assertEq(lines[2], 'e');

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'FileTailTailUpdatesPosition',
    doc: 'FileTail.tail() sets position to end of file',
    do() {
      setupTestDir();
      const filepath = writeTestFile('pos.log', 'a\nb\nc\n');
      const tail = $logs.FileTail.new({ filepath });

      tail.tail(2);
      this.assertEq(tail.position(), 6);

      const newLines = tail.readNew();
      this.assertEq(newLines.length, 0);

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'LogFormatterColorFor',
    doc: 'LogFormatter.colorFor() returns mapped color or default',
    do() {
      const formatter = $logs.LogFormatter.new({
        colors: { server: '\x1b[32m', client: '\x1b[34m' }
      });

      this.assertEq(formatter.colorFor('server'), '\x1b[32m');
      this.assertEq(formatter.colorFor('client'), '\x1b[34m');
      this.assertEq(formatter.colorFor('unknown'), '\x1b[37m');
    }
  });

  $test.Case.new({
    name: 'LogFormatterFormat',
    doc: 'LogFormatter.format() produces colored prefix with line',
    do() {
      const formatter = $logs.LogFormatter.new({
        colors: { test: '\x1b[33m' }
      });

      const output = formatter.format('test', 'hello world');
      this.assert(output.includes('\x1b[33m'), 'has color');
      this.assert(output.includes('[test]'), 'has prefix');
      this.assert(output.includes('\x1b[0m'), 'has reset');
      this.assert(output.includes('hello world'), 'has line');
    }
  });

  $test.Case.new({
    name: 'LogFormatterFormatHeader',
    doc: 'LogFormatter.formatHeader() produces section header',
    do() {
      const formatter = $logs.LogFormatter.new();
      const output = formatter.formatHeader('service', 'Status');
      this.assert(output.includes('[service]'), 'has prefix');
      this.assert(output.includes('--- Status ---'), 'has header text');
    }
  });

  $test.Case.new({
    name: 'LogStreamerLogFiles',
    doc: 'LogStreamer.logFiles() lists matching files',
    do() {
      setupTestDir();
      writeTestFile('service1.log', 'a');
      writeTestFile('service2.log', 'b');
      writeTestFile('other.txt', 'c');

      const streamer = $logs.LogStreamer.new({ logsDir: testDir });
      const files = streamer.logFiles();

      this.assertEq(files.length, 2);
      this.assert(files.includes('service1.log'), 'has service1.log');
      this.assert(files.includes('service2.log'), 'has service2.log');

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'LogStreamerLogFilesEmpty',
    doc: 'LogStreamer.logFiles() returns empty for nonexistent dir',
    do() {
      const streamer = $logs.LogStreamer.new({ logsDir: '/nonexistent/path' });
      const files = streamer.logFiles();
      this.assertEq(files.length, 0);
    }
  });

  $test.Case.new({
    name: 'LogStreamerSourceNameFromFile',
    doc: 'LogStreamer.sourceNameFromFile() strips extension',
    do() {
      const streamer = $logs.LogStreamer.new({ logsDir: testDir });
      this.assertEq(streamer.sourceNameFromFile('server.log'), 'server');
    }
  });

  $test.Case.new({
    name: 'LogStreamerCustomExtension',
    doc: 'LogStreamer respects custom extension',
    do() {
      setupTestDir();
      writeTestFile('service.txt', 'a');
      writeTestFile('service.log', 'b');

      const streamer = $logs.LogStreamer.new({ logsDir: testDir, extension: '.txt' });
      const files = streamer.logFiles();

      this.assertEq(files.length, 1);
      this.assertEq(files[0], 'service.txt');
      this.assertEq(streamer.sourceNameFromFile('service.txt'), 'service');

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'LogStreamerGetTail',
    doc: 'LogStreamer.getTail() creates and caches FileTail',
    do() {
      setupTestDir();
      writeTestFile('test.log', 'content');

      const streamer = $logs.LogStreamer.new({ logsDir: testDir });
      const tail1 = streamer.getTail('test.log');
      const tail2 = streamer.getTail('test.log');

      this.assert(tail1 === tail2, 'should return same instance');
      this.assert(tail1.exists(), 'tail should point to existing file');

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'LogStreamerScan',
    doc: 'LogStreamer.scan() reads new content from all files',
    do() {
      setupTestDir();
      writeTestFile('a.log', 'line1\n');
      writeTestFile('b.log', 'line2\nline3\n');

      const lines = [];
      const streamer = $logs.LogStreamer.new({
        logsDir: testDir,
        output: line => lines.push(line)
      });

      const count = streamer.scan();

      this.assertEq(count, 3);
      this.assertEq(lines.length, 3);

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'LogStreamerScanIncremental',
    doc: 'LogStreamer.scan() only returns new content on subsequent calls',
    do() {
      setupTestDir();
      const filepath = writeTestFile('inc.log', 'first\n');

      const lines = [];
      const streamer = $logs.LogStreamer.new({
        logsDir: testDir,
        output: line => lines.push(line)
      });

      streamer.scan();
      this.assertEq(lines.length, 1);

      appendFileSync(filepath, 'second\n');
      streamer.scan();
      this.assertEq(lines.length, 2);

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'LogStreamerFormatterIntegration',
    doc: 'LogStreamer uses formatter for output',
    do() {
      setupTestDir();
      writeTestFile('svc.log', 'test\n');

      const lines = [];
      const formatter = $logs.LogFormatter.new({
        colors: { svc: '\x1b[35m' }
      });
      const streamer = $logs.LogStreamer.new({
        logsDir: testDir,
        formatter,
        output: line => lines.push(line)
      });

      streamer.scan();

      this.assertEq(lines.length, 1);
      this.assert(lines[0].includes('\x1b[35m'), 'has custom color');
      this.assert(lines[0].includes('[svc]'), 'has source prefix');

      cleanupTestDir();
    }
  });

  $test.Case.new({
    name: 'LogStreamerStop',
    doc: 'LogStreamer.stop() clears watcher and poll interval',
    do() {
      setupTestDir();
      const streamer = $logs.LogStreamer.new({ logsDir: testDir });

      streamer.startWatching();
      streamer.startPolling();

      this.assert(streamer.watcher() !== null, 'has watcher');
      this.assert(streamer.pollInterval() !== null, 'has poll interval');

      streamer.stop();

      this.assert(streamer.watcher() === null, 'watcher cleared');
      this.assert(streamer.pollInterval() === null, 'poll interval cleared');

      cleanupTestDir();
    }
  });
}.module({
  name: 'test.logs',
  imports: [base, test, logs],
}).load();
