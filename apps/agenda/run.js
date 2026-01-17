#!/usr/bin/env bun
import { config } from 'dotenv';
import { resolve, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Load .env from core directory (parent of apps/agenda)
config({ path: resolve(import.meta.dir, '../../.env') });

import { __, base } from 'simulabra';
import supervisor from './src/supervisor.js';

await async function (_, $, $supervisor) {
  const port = parseInt(process.env.AGENDA_PORT || '3030', 10);
  const logsDir = join(import.meta.dir, 'logs');

  // Ensure logs directory exists
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // Create supervisor with logs directory (AgendaSupervisor uses AGENDA_SERVICE_NAME env)
  const sup = $supervisor.AgendaSupervisor.new({ port, logsDir });

  // Helper to log to both console and file
  const log = (msg) => {
    __.tlog(msg);
    sup.writeLog(msg);
  };

  // Register services
  sup.registerService($supervisor.ServiceSpec.new({
    serviceName: 'DatabaseService',
    command: ['bun', 'run', 'src/services/database.js'],
    restartPolicy: 'on_failure',
    maxRestarts: 10,
    healthCheckMethod: 'health',
  }));

  sup.registerService($supervisor.ServiceSpec.new({
    serviceName: 'ReminderService',
    command: ['bun', 'run', 'src/services/reminder.js'],
    restartPolicy: 'on_failure',
    maxRestarts: 10,
    healthCheckMethod: 'health',
  }));

  sup.registerService($supervisor.ServiceSpec.new({
    serviceName: 'GeistService',
    command: ['bun', 'run', 'src/services/geist.js'],
    restartPolicy: 'on_failure',
    maxRestarts: 10,
    healthCheckMethod: 'health',
  }));

  // Start supervisor WebSocket server
  sup.serve();

  // Start all services
  await sup.startAll();

  // Start health check loop
  sup.healthCheckLoop();

  log('Agenda supervisor started');
  log(`WebSocket server on port ${port}`);
  log('Services: DatabaseService, ReminderService, GeistService');
  log(`Logs directory: ${logsDir}`);

  // Handle shutdown
  const shutdown = async () => {
    log('Shutting down...');
    sup.stopAll();
    await sup.waitForExit(3000);
    log('All services stopped');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}.module({
  name: 'agenda.run',
  imports: [base, supervisor],
}).load();
