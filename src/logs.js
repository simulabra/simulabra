import { __, base } from './base.js';
import { watch } from 'fs';
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export default await async function (_, $) {
  $.Class.new({
    name: 'FileTail',
    doc: 'Tracks position in a file and yields new content',
    slots: [
      $.Var.new({ name: 'filepath', doc: 'absolute path to the file' }),
      $.Var.new({ name: 'position', default: 0, doc: 'current read position in bytes' }),
      $.Method.new({
        name: 'exists',
        doc: 'check if the file exists',
        do() {
          return existsSync(this.filepath());
        }
      }),
      $.Method.new({
        name: 'size',
        doc: 'get current file size',
        do() {
          if (!this.exists()) return 0;
          return statSync(this.filepath()).size;
        }
      }),
      $.Method.new({
        name: 'readNew',
        doc: 'read any new content since last read, returns array of non-empty lines',
        do() {
          if (!this.exists()) return [];
          const size = this.size();
          const pos = this.position();
          if (size <= pos) return [];

          const content = readFileSync(this.filepath(), 'utf8');
          const newContent = content.slice(pos);
          this.position(size);

          return newContent.split('\n').filter(line => line.trim());
        }
      }),
      $.Method.new({
        name: 'tail',
        doc: 'get last N lines from file',
        do(n = 20) {
          if (!this.exists()) return [];
          const content = readFileSync(this.filepath(), 'utf8');
          const lines = content.split('\n').filter(l => l.trim());
          this.position(content.length);
          return lines.slice(-n);
        }
      }),
    ]
  });

  $.Class.new({
    name: 'LogFormatter',
    doc: 'Formats log lines with ANSI colors for different sources',
    slots: [
      $.Var.new({
        name: 'colors',
        doc: 'source name to ANSI color mapping',
        default: () => ({}),
      }),
      $.Var.new({
        name: 'defaultColor',
        doc: 'color to use when source not in map',
        default: '\x1b[37m',
      }),
      $.Constant.new({ name: 'reset', value: '\x1b[0m' }),
      $.Method.new({
        name: 'colorFor',
        doc: 'get ANSI color for a source name',
        do(sourceName) {
          return this.colors()[sourceName] || this.defaultColor();
        }
      }),
      $.Method.new({
        name: 'format',
        doc: 'format a log line with colored source prefix',
        do(sourceName, line) {
          const color = this.colorFor(sourceName);
          return `${color}[${sourceName}]${this.reset()} ${line}`;
        }
      }),
      $.Method.new({
        name: 'formatHeader',
        doc: 'format a section header',
        do(sourceName, text) {
          const color = this.colorFor(sourceName);
          return `\n${color}[${sourceName}]${this.reset()} --- ${text} ---`;
        }
      }),
    ]
  });

  $.Class.new({
    name: 'LogStreamer',
    doc: 'Streams and aggregates log files from multiple sources',
    slots: [
      $.Var.new({ name: 'logsDir', doc: 'directory containing log files' }),
      $.Var.new({ name: 'tails', default: () => ({}), doc: 'filepath -> FileTail mapping' }),
      $.Var.new({ name: 'formatter', default: () => _.LogFormatter.new() }),
      $.Var.new({ name: 'watcher', doc: 'fs.watch handle' }),
      $.Var.new({ name: 'pollInterval', doc: 'setInterval handle for polling' }),
      $.Var.new({ name: 'pollMs', default: 500, doc: 'polling interval in ms' }),
      $.Var.new({ name: 'initialTailLines', default: 20, doc: 'lines to show on startup' }),
      $.Var.new({ name: 'extension', default: '.log', doc: 'file extension to watch' }),
      $.Var.new({
        name: 'output',
        default: () => (line => console.log(line)),
        doc: 'function to call with formatted output lines'
      }),
      $.Method.new({
        name: 'sourceNameFromFile',
        doc: 'extract source name from log filename',
        do(filename) {
          return filename.replace(this.extension(), '');
        }
      }),
      $.Method.new({
        name: 'logFiles',
        doc: 'get list of matching files in logs directory',
        do() {
          if (!existsSync(this.logsDir())) return [];
          return readdirSync(this.logsDir()).filter(f => f.endsWith(this.extension()));
        }
      }),
      $.Method.new({
        name: 'getTail',
        doc: 'get or create FileTail for a file',
        do(filename) {
          const filepath = join(this.logsDir(), filename);
          if (!this.tails()[filepath]) {
            this.tails()[filepath] = _.FileTail.new({ filepath });
          }
          return this.tails()[filepath];
        }
      }),
      $.Method.new({
        name: 'tailFile',
        doc: 'read and output new content from a file',
        do(filename) {
          const tail = this.getTail(filename);
          const lines = tail.readNew();
          const sourceName = this.sourceNameFromFile(filename);

          for (const line of lines) {
            this.output()(this.formatter().format(sourceName, line));
          }
          return lines.length;
        }
      }),
      $.Method.new({
        name: 'scan',
        doc: 'scan all log files for new content',
        do() {
          let totalLines = 0;
          for (const file of this.logFiles()) {
            totalLines += this.tailFile(file);
          }
          return totalLines;
        }
      }),
      $.Method.new({
        name: 'showInitial',
        doc: 'show last N lines from each log file',
        do() {
          if (!existsSync(this.logsDir())) {
            this.output()('Waiting for logs directory...');
            return;
          }

          for (const file of this.logFiles()) {
            const tail = this.getTail(file);
            const lines = tail.tail(this.initialTailLines());
            const sourceName = this.sourceNameFromFile(file);

            if (lines.length > 0) {
              this.output()(this.formatter().formatHeader(sourceName, `Last ${lines.length} lines`));
              for (const line of lines) {
                this.output()(this.formatter().format(sourceName, line));
              }
            }
          }
          this.output()('\n--- Streaming new logs ---\n');
        }
      }),
      $.Method.new({
        name: 'startWatching',
        doc: 'start watching logs directory for changes',
        do() {
          if (!existsSync(this.logsDir())) {
            mkdirSync(this.logsDir(), { recursive: true });
          }
          this.watcher(watch(this.logsDir(), { recursive: false }, (event, filename) => {
            if (filename && filename.endsWith(this.extension())) {
              this.tailFile(filename);
            }
          }));
        }
      }),
      $.Method.new({
        name: 'startPolling',
        doc: 'start periodic polling for changes',
        do() {
          this.pollInterval(setInterval(() => this.scan(), this.pollMs()));
        }
      }),
      $.Method.new({
        name: 'stop',
        doc: 'stop watching and polling',
        do() {
          if (this.watcher()) {
            this.watcher().close();
            this.watcher(null);
          }
          if (this.pollInterval()) {
            clearInterval(this.pollInterval());
            this.pollInterval(null);
          }
        }
      }),
      $.Method.new({
        name: 'run',
        doc: 'start streaming logs (show initial + watch + poll)',
        do() {
          this.showInitial();
          this.startWatching();
          this.startPolling();
        }
      }),
    ]
  });
}.module({
  name: 'logs',
  imports: [base],
}).load();
