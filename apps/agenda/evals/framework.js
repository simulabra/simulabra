import { Database } from 'bun:sqlite';
import { __, base } from 'simulabra';
import db from 'simulabra/db';
import sqlite from '../src/sqlite.js';
import models from '../src/models.js';
import database from '../src/services/database.js';
import geist from '../src/services/geist.js';
import seed from './seed.js';
import trace from './trace.js';
import Anthropic from '@anthropic-ai/sdk';

export default await async function (_, $, $db, $sqlite, $models, $database, $geist, $seed, $trace) {
  const createTestDb = () => {
    const database = new Database(':memory:');
    const runner = $db.MigrationRunner.new({ db: database });
    for (const migration of $sqlite.AgendaMigrations.all()) {
      runner.register(migration);
    }
    runner.migrate();
    return database;
  };

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

            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
              throw new Error('ANTHROPIC_API_KEY not set');
            }

            const traceCapture = $trace.TraceCaptureFactory.create(
              new Anthropic({ apiKey }),
            );

            const geistService = $geist.GeistService.new({ uid: 'EvalGeistService' });
            geistService.dbService(dbService);
            geistService.client(traceCapture);

            const seedData = await $seed.EvalSeed.populate(dbService);

            const ctx = {
              geist: geistService,
              db: dbService,
              seed: seedData,
              trace: traceCapture,
              interpret: (input) => geistService.interpret(input),
              assertToolCalled(result, toolName) {
                if (!result.toolsExecuted || !result.toolsExecuted.some(t => t.tool === toolName)) {
                  throw new Error(`Expected tool '${toolName}' to be called, but it was not. Tools called: ${(result.toolsExecuted || []).map(t => t.tool).join(', ') || 'none'}`);
                }
              },
              assertToolNotCalled(result, toolName) {
                if (result.toolsExecuted && result.toolsExecuted.some(t => t.tool === toolName)) {
                  throw new Error(`Expected tool '${toolName}' NOT to be called, but it was`);
                }
              },
            };

            await this.scenario()(ctx);

            this.result({
              title: this.title(),
              success: true,
              traces: traceCapture.traces,
              toolsExecuted: traceCapture.traces.flatMap(t => {
                const content = t.response?.content || [];
                return content
                  .filter(b => b.type === 'tool_use')
                  .map(b => ({ tool: b.name, input: b.input }));
              }),
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
  imports: [base, db, sqlite, models, database, geist, seed, trace],
}).load();
