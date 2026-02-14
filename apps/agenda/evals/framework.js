import { Database } from 'bun:sqlite';
import { __, base } from 'simulabra';
import db from 'simulabra/db';
import sqlite from '../src/sqlite.js';
import models from '../src/models.js';
import database from '../src/services/database.js';
import geist from '../src/services/geist.js';
import seed from './seed.js';
import trace from './trace.js';
import providerMod from '../src/provider.js';

export default await async function (_, $, $db, $sqlite, $models, $database, $geist, $seed, $trace, $provider) {
  const createTestDb = () => {
    const database = new Database(':memory:');
    const runner = $db.MigrationRunner.new({ db: database });
    for (const migration of $sqlite.AgendaMigrations.all()) {
      runner.register(migration);
    }
    runner.migrate();
    return database;
  };

  const snapshot = (dbService) => ({
    tasks: dbService.listTasks({}),
    logs: dbService.listLogs({}),
    reminders: dbService.listReminders({}),
    projects: dbService.listProjects({}),
  });

  const diffTable = (before, after) => {
    const beforeById = new Map(before.map(r => [r.id, r]));
    const afterById = new Map(after.map(r => [r.id, r]));
    const created = after.filter(r => !beforeById.has(r.id));
    const deleted = before.filter(r => !afterById.has(r.id));
    const modified = after.filter(r => {
      const old = beforeById.get(r.id);
      if (!old) return false;
      return JSON.stringify(old) !== JSON.stringify(r);
    });
    return { created, modified, deleted };
  };

  const diffSnapshots = (before, after) => ({
    tasks: diffTable(before.tasks, after.tasks),
    logs: diffTable(before.logs, after.logs),
    reminders: diffTable(before.reminders, after.reminders),
    projects: diffTable(before.projects, after.projects),
  });

  $.Class.new({
    name: 'EvalCase',
    doc: 'Standalone eval case — creates isolated DB, seeds, runs scenario, captures result',
    slots: [
      $.Var.new({ name: 'title' }),
      $.Var.new({ name: 'scenario' }),
      $.Var.new({ name: 'result' }),

      $.Method.new({
        name: 'run',
        async do() {
          const start = Date.now();
          let database;
          try {
            database = createTestDb();

            const dbService = $database.DatabaseService.new({ uid: 'EvalDatabaseService' });
            dbService.db(database);
            dbService.initDatabase();

            const adapter = $provider.ProviderConfig.new().fromEnv();
            if (!adapter.apiKey()) {
              throw new Error('No API key set (ANTHROPIC_API_KEY, AGENDA_PROVIDER_KEY, or OPENROUTER_API_KEY)');
            }

            const traceCapture = $trace.TraceCapture.new({
              client: adapter,
            });

            const geistService = $geist.GeistService.new({ uid: 'EvalGeistService' });
            geistService.dbService(dbService);
            geistService.client(traceCapture);
            geistService.model(adapter.model());

            const seedData = await $seed.EvalSeed.populate(dbService);
            const beforeSnap = snapshot(dbService);

            const toolsCalled = (result) =>
              (result.toolsExecuted || []).map(t => t.tool);

            const ctx = {
              geist: geistService,
              db: dbService,
              seed: seedData,
              trace: traceCapture,
              interpret: (input) => geistService.interpret(input),
              interpretMessage: (opts) => geistService.interpretMessage(opts),
              snapshot: () => snapshot(dbService),
              diff: diffSnapshots,
              assertToolCalled(result, toolName) {
                const called = toolsCalled(result);
                if (!called.includes(toolName)) {
                  throw new Error(`Expected tool '${toolName}' to be called, but it was not. Tools called: ${called.join(', ') || 'none'}`);
                }
              },
              assertToolNotCalled(result, toolName) {
                const called = toolsCalled(result);
                if (called.includes(toolName)) {
                  throw new Error(`Expected tool '${toolName}' NOT to be called, but it was`);
                }
              },
              assertAnyToolCalled(result, toolNames) {
                const called = toolsCalled(result);
                if (!toolNames.some(tn => called.includes(tn))) {
                  throw new Error(`Expected one of [${toolNames.join(', ')}] to be called, got: ${called.join(', ') || 'none'}`);
                }
              },
            };

            await this.scenario()(ctx);

            const afterSnap = snapshot(dbService);
            const dbDiff = diffSnapshots(beforeSnap, afterSnap);

            this.result({
              title: this.title(),
              success: true,
              traces: traceCapture.traces(),
              toolsExecuted: traceCapture.traces().flatMap(t => {
                const content = t.response?.content || [];
                return content
                  .filter(b => b.type === 'tool_use')
                  .map(b => ({ tool: b.name, input: b.input }));
              }),
              dbDiff,
              cost: traceCapture.costSummary(),
              durationMs: Date.now() - start,
            });
          } catch (error) {
            this.result({
              title: this.title(),
              success: false,
              error: error.message,
              traces: [],
              toolsExecuted: [],
              durationMs: Date.now() - start,
            });
          } finally {
            if (database) database.close();
          }
          return this.result();
        }
      }),
    ]
  });
}.module({
  name: 'eval.framework',
  imports: [base, db, sqlite, models, database, geist, seed, trace, providerMod],
}).load();
