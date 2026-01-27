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
  const staticDir = resolve(import.meta.dir, '../../out/agenda');

  // Ensure logs directory exists
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // Create supervisor with logs directory (AgendaSupervisor uses AGENDA_SERVICE_NAME env)
  const sup = $supervisor.AgendaSupervisor.new({ port, logsDir });

  // Set up HTTP router with static file serving
  const router = $supervisor.ApiRouter.new();

  // Redirect root to /agenda/
  router.addHandler($supervisor.MethodPathHandler.new({
    httpMethod: 'GET',
    path: '/',
    handlerFn: () => Response.redirect('/agenda/', 302)
  }));

  // Redirect /agenda to /agenda/
  router.addHandler($supervisor.MethodPathHandler.new({
    httpMethod: 'GET',
    path: '/agenda',
    handlerFn: () => Response.redirect('/agenda/', 302)
  }));

  // Serve static files from out/agenda
  router.addHandler($supervisor.StaticFileHandler.new({
    urlPrefix: '/agenda/',
    rootDir: staticDir
  }));

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP API Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  const apiHandler = (method, path, handler) => {
    router.addHandler($supervisor.MethodPathHandler.new({
      httpMethod: method,
      path,
      handlerFn: async (ctx) => {
        try {
          return await handler(ctx);
        } catch (e) {
          if (e.message?.includes('not connected') || e.message?.includes('not available')) {
            throw $supervisor.HttpError.new({
              status: 503,
              message: 'Service unavailable',
              code: 'SERVICE_UNAVAILABLE'
            });
          }
          throw e;
        }
      }
    }));
  };

  // GET /api/v1/status - supervisor status
  apiHandler('GET', '/api/v1/status', async () => {
    return sup.status();
  });

  // POST /api/v1/tasks/list - list tasks
  apiHandler('POST', '/api/v1/tasks/list', async (ctx) => {
    const db = await sup.serviceProxy({ name: 'DatabaseService', timeout: 10 });
    const body = ctx.body() || {};
    return await db.listTasks(body);
  });

  // POST /api/v1/tasks/complete - complete a task
  apiHandler('POST', '/api/v1/tasks/complete', async (ctx) => {
    const db = await sup.serviceProxy({ name: 'DatabaseService', timeout: 10 });
    const body = ctx.body() || {};
    if (!body.id) {
      throw $supervisor.HttpError.new({
        status: 400,
        message: 'Missing required field: id',
        code: 'MISSING_FIELD'
      });
    }
    return await db.completeTask(body);
  });

  // POST /api/v1/logs/list - list logs
  apiHandler('POST', '/api/v1/logs/list', async (ctx) => {
    const db = await sup.serviceProxy({ name: 'DatabaseService', timeout: 10 });
    const body = ctx.body() || {};
    return await db.listLogs(body);
  });

  // POST /api/v1/reminders/list - list reminders
  apiHandler('POST', '/api/v1/reminders/list', async (ctx) => {
    const db = await sup.serviceProxy({ name: 'DatabaseService', timeout: 10 });
    const body = ctx.body() || {};
    return await db.listReminders(body);
  });

  // POST /api/v1/chat/history - load chat history
  apiHandler('POST', '/api/v1/chat/history', async (ctx) => {
    const db = await sup.serviceProxy({ name: 'DatabaseService', timeout: 10 });
    const body = ctx.body() || {};
    return await db.listChatMessages(body);
  });

  // POST /api/v1/chat/wait - long-poll for new chat messages
  apiHandler('POST', '/api/v1/chat/wait', async (ctx) => {
    const db = await sup.serviceProxy({ name: 'DatabaseService', timeout: 60 });
    const body = ctx.body() || {};
    return await db.waitForChatMessages(body);
  });

  // POST /api/v1/chat/send - send a chat message
  apiHandler('POST', '/api/v1/chat/send', async (ctx) => {
    const geist = await sup.serviceProxy({ name: 'GeistService', timeout: 120 });
    const body = ctx.body() || {};
    if (!body.text) {
      throw $supervisor.HttpError.new({
        status: 400,
        message: 'Missing required field: text',
        code: 'MISSING_FIELD'
      });
    }
    return await geist.interpretMessage(body);
  });

  sup.httpRouter(router);

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
  log(`HTTP + WebSocket server on port ${port}`);
  log(`Agenda UI at http://localhost:${port}/agenda/`);
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
