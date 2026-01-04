#!/usr/bin/env bun
import { watch } from 'fs';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const logsDir = join(import.meta.dir, '../logs');

// Track file positions for tailing
const positions = {};

// ANSI colors for different services
const colors = {
  'supervisor': '\x1b[36m',      // cyan
  'DatabaseService': '\x1b[32m', // green
  'ReminderService': '\x1b[33m', // yellow
  'GeistService': '\x1b[35m',    // magenta
  'default': '\x1b[37m',         // white
};
const reset = '\x1b[0m';

function getColor(filename) {
  const name = filename.replace('.log', '');
  return colors[name] || colors.default;
}

function tailFile(filepath, filename) {
  if (!existsSync(filepath)) return;

  const stats = statSync(filepath);
  const pos = positions[filepath] || 0;

  if (stats.size > pos) {
    const content = readFileSync(filepath, 'utf8');
    const newContent = content.slice(pos);
    if (newContent.trim()) {
      const color = getColor(filename);
      const prefix = `${color}[${filename.replace('.log', '')}]${reset}`;
      for (const line of newContent.split('\n')) {
        if (line.trim()) {
          console.log(`${prefix} ${line}`);
        }
      }
    }
    positions[filepath] = stats.size;
  }
}

function scanLogs() {
  if (!existsSync(logsDir)) {
    console.log('Logs directory not found. Start the supervisor first.');
    return;
  }

  const files = readdirSync(logsDir).filter(f => f.endsWith('.log'));
  for (const file of files) {
    tailFile(join(logsDir, file), file);
  }
}

// Initial scan - show last 20 lines from each file
function initialScan() {
  if (!existsSync(logsDir)) {
    console.log('Waiting for logs directory...');
    return;
  }

  const files = readdirSync(logsDir).filter(f => f.endsWith('.log'));
  for (const file of files) {
    const filepath = join(logsDir, file);
    const content = readFileSync(filepath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const lastLines = lines.slice(-20);

    if (lastLines.length > 0) {
      const color = getColor(file);
      const prefix = `${color}[${file.replace('.log', '')}]${reset}`;
      console.log(`\n${prefix} --- Last ${lastLines.length} lines ---`);
      for (const line of lastLines) {
        console.log(`${prefix} ${line}`);
      }
    }
    positions[filepath] = content.length;
  }
  console.log('\n--- Streaming new logs ---\n');
}

console.log('Agenda Log Streamer');
console.log('Press Ctrl+C to exit\n');

initialScan();

// Watch for changes
if (existsSync(logsDir)) {
  watch(logsDir, { recursive: false }, (event, filename) => {
    if (filename && filename.endsWith('.log')) {
      tailFile(join(logsDir, filename), filename);
    }
  });
}

// Also poll periodically in case watch misses events
setInterval(scanLogs, 500);
