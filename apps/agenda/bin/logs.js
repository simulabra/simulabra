#!/usr/bin/env bun
import { join } from 'path';
import logstreamer from '../src/logstreamer.js';

const logsDir = join(import.meta.dir, '../logs');
const streamer = logstreamer.LogStreamer.new({ logsDir });
streamer.run();
