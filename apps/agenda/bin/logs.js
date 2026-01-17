#!/usr/bin/env bun
import { __, base } from 'simulabra';
import logs from '../src/logs.js';
import { join } from 'path';

await async function (_, $, $logs) {
  const logsDir = join(import.meta.dir, '../logs');
  const streamer = $logs.LogStreamer.new({ logsDir });
  streamer.run();
}.module({
  name: 'agenda.logs-cli',
  imports: [base, logs],
}).load();
