import { Database } from 'bun:sqlite';
import { __, base } from 'simulabra';
import test from 'simulabra/test';
import db from 'simulabra/db';
import sqlite from '../src/sqlite.js';
import models from '../src/models.js';
import database from '../src/services/database.js';
import geist from '../src/services/geist.js';

export default await async function (_, $, $test, $db, $sqlite, $models, $database, $geist) {
  const createTestDb = () => {
    const database = new Database(':memory:');
    const runner = $db.MigrationRunner.new({ db: database });
    for (const migration of $sqlite.AgendaMigrations.all()) {
      runner.register(migration);
    }
    runner.migrate();
    return database;
  };

  class MockAnthropicClient {
    constructor() {
      this.responses = [];
      this.lastRequest = null;
    }

    setResponse(response) {
      this.responses = [response];
    }

    setResponses(responses) {
      this.responses = [...responses];
    }

    get messages() {
      const self = this;
      return {
        async create(params) {
          self.lastRequest = params;
          if (self.responses.length === 0) {
            throw new Error('No mock response set');
          }
          return self.responses.shift();
        }
      };
    }
  }

  const createTestServices = (database) => {
    const dbService = $database.DatabaseService.new({ uid: 'TestDatabaseService' });
    dbService.db(database);
    dbService.initDatabase();

    const geistService = $geist.GeistService.new({ uid: 'TestGeistService' });
    geistService.dbService(dbService);
    geistService.client(new MockAnthropicClient());

    return { dbService, geistService };
  };

  $test.AsyncCase.new({
    name: 'GetPromptById',
    doc: 'getPrompt should return a single prompt by id',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const created = await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Test prompt',
        status: 'pending'
      });

      const fetched = await dbService.getPrompt({ id: created.id });

      this.assertEq(fetched.id, created.id, 'should have matching id');
      this.assertEq(fetched.message, 'Test prompt', 'should have message');

      const missing = await dbService.getPrompt({ id: 'nonexistent' });
      this.assertEq(missing, null, 'should return null for missing prompt');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GetPendingPromptsEmpty',
    doc: 'getPendingPrompts should return empty array when no prompts exist',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const prompts = await geistService.getPendingPrompts({ limit: 10 });

      this.assertEq(prompts.length, 0, 'should return empty array');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GetPendingPromptsWithData',
    doc: 'getPendingPrompts should return pending prompts, excluding snoozed ones',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Prompt 1',
        status: 'pending'
      });
      await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-2',
        message: 'Prompt 2',
        status: 'pending'
      });
      await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-3',
        message: 'Actioned prompt',
        status: 'actioned'
      });

      const prompts = await geistService.getPendingPrompts({ limit: 10 });

      this.assertEq(prompts.length, 2, 'should return 2 pending prompts');
      this.assert(prompts.every(p => p.status === 'pending'), 'all should be pending');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GetPendingPromptsExcludesSnoozed',
    doc: 'getPendingPrompts should exclude prompts that are snoozed until later',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pastTime = new Date(Date.now() - 60 * 60 * 1000);

      await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Active prompt',
        status: 'pending'
      });

      const snoozedPrompt = await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-2',
        message: 'Snoozed prompt',
        status: 'pending'
      });
      await dbService.updatePrompt({
        id: snoozedPrompt.id,
        snoozeUntil: futureTime.toISOString()
      });

      const expiredSnooze = await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-3',
        message: 'Expired snooze prompt',
        status: 'pending'
      });
      await dbService.updatePrompt({
        id: expiredSnooze.id,
        snoozeUntil: pastTime.toISOString()
      });

      const prompts = await geistService.getPendingPrompts({ limit: 10 });

      this.assertEq(prompts.length, 2, 'should return 2 prompts (active + expired snooze)');
      const messages = prompts.map(p => p.message);
      this.assert(messages.includes('Active prompt'), 'should include active prompt');
      this.assert(messages.includes('Expired snooze prompt'), 'should include expired snooze');
      this.assert(!messages.includes('Snoozed prompt'), 'should not include future snoozed');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionPromptDone',
    doc: 'actionPrompt with done action should complete the related task',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const task = await dbService.createTask({ title: 'Test task', priority: 2 });
      const prompt = await dbService.createPrompt({
        itemType: 'task',
        itemId: task.id,
        message: 'Did you finish this?',
        status: 'pending'
      });

      const result = await geistService.actionPrompt({ id: prompt.id, action: 'done' });

      this.assertEq(result.status, 'actioned', 'prompt should be actioned');
      this.assertEq(result.action, 'done', 'action should be done');
      this.assert(result.actionedAt, 'should have actionedAt');

      const updatedTask = await dbService.getTask({ id: task.id });
      this.assertEq(updatedTask.done, true, 'task should be completed');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionPromptBacklog',
    doc: 'actionPrompt with backlog action should set task priority to 5',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const task = await dbService.createTask({ title: 'Test task', priority: 2 });
      const prompt = await dbService.createPrompt({
        itemType: 'task',
        itemId: task.id,
        message: 'Is this still important?',
        status: 'pending'
      });

      const result = await geistService.actionPrompt({ id: prompt.id, action: 'backlog' });

      this.assertEq(result.status, 'actioned', 'prompt should be actioned');
      this.assertEq(result.action, 'backlog', 'action should be backlog');

      const updatedTask = await dbService.getTask({ id: task.id });
      this.assertEq(updatedTask.priority, 5, 'task priority should be 5');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionPromptSnooze',
    doc: 'actionPrompt with snooze action should set snoozeUntil to +24 hours',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const prompt = await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Check on this later',
        status: 'pending'
      });

      const beforeAction = Date.now();
      const result = await geistService.actionPrompt({ id: prompt.id, action: 'snooze' });
      const afterAction = Date.now();

      this.assertEq(result.status, 'pending', 'prompt should stay pending when snoozed');
      this.assertEq(result.action, 'snooze', 'action should be snooze');
      this.assert(result.snoozeUntil, 'should have snoozeUntil');

      const snoozeTime = new Date(result.snoozeUntil).getTime();
      const expectedMin = beforeAction + 24 * 60 * 60 * 1000;
      const expectedMax = afterAction + 24 * 60 * 60 * 1000;
      this.assert(snoozeTime >= expectedMin && snoozeTime <= expectedMax, 'snoozeUntil should be ~24 hours from now');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionPromptDismiss',
    doc: 'actionPrompt with dismiss action should mark as dismissed',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const prompt = await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Dismissable prompt',
        status: 'pending'
      });

      const result = await geistService.actionPrompt({ id: prompt.id, action: 'dismiss' });

      this.assertEq(result.status, 'dismissed', 'prompt should be dismissed');
      this.assertEq(result.action, 'dismiss', 'action should be dismiss');
      this.assert(result.actionedAt, 'should have actionedAt');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionPromptRecordsHistory',
    doc: 'actionPrompt should record response in PromptConfig.responseHistory',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const prompt = await dbService.createPrompt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Test prompt',
        status: 'pending'
      });

      await geistService.actionPrompt({ id: prompt.id, action: 'done' });

      const config = await dbService.getPromptConfig({});
      this.assert(config.responseHistory.length > 0, 'should have response history');
      this.assertEq(config.responseHistory[0].promptId, prompt.id, 'should record prompt id');
      this.assertEq(config.responseHistory[0].action, 'done', 'should record action');
      this.assertEq(config.responseHistory[0].itemType, 'task', 'should record item type');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'AnalyzeContext',
    doc: 'analyzeContext should gather tasks, logs, and reminders',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      await dbService.createTask({ title: 'Recent task', priority: 1 });
      await dbService.createTask({ title: 'Old task', priority: 3 });
      await dbService.createLog({ content: 'Test log' });

      const context = await geistService.analyzeContext();

      this.assert(context.tasks, 'should have tasks');
      this.assert(context.logs, 'should have logs');
      this.assert(context.reminders, 'should have reminders');
      this.assert(context.config, 'should have config');
      this.assertEq(context.tasks.length, 2, 'should have 2 tasks');
      this.assertEq(context.logs.length, 1, 'should have 1 log');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeneratePromptsCallsClaude',
    doc: 'generatePrompts should call Claude API with context',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      await dbService.createTask({ title: 'Stale task', priority: 2 });

      geistService.client().setResponse({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                itemType: 'task',
                itemId: 'will-be-looked-up',
                message: 'Did you get around to the stale task?'
              }
            ])
          }
        ],
        stop_reason: 'end_turn'
      });

      const result = await geistService.generatePrompts();

      this.assert(result.success, 'should succeed');
      this.assert(geistService.client().lastRequest, 'should have made API call');
      this.assert(
        geistService.client().lastRequest.system.includes('productivity'),
        'should include prompt generation system prompt'
      );

      database.close();
    }
  });

  $test.Case.new({
    name: 'PromptSystemPromptIncludesFreshTasks',
    doc: 'prompt generation system prompt should mention recently added tasks',
    do() {
      const database = createTestDb();
      const { geistService } = createTestServices(database);

      const prompt = geistService.promptGenerationSystemPrompt();
      this.assert(
        prompt.includes('recently added') || prompt.includes('added today'),
        'should mention recently added items'
      );
      this.assert(
        prompt.includes('clarifying') || prompt.includes('deadline') || prompt.includes('priority'),
        'should suggest clarifying questions for new items'
      );

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeneratePromptsCreatesRecords',
    doc: 'generatePrompts should create Prompt records from Claude response',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const task = await dbService.createTask({ title: 'Test task', priority: 2 });

      geistService.client().setResponse({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                itemType: 'task',
                itemId: task.id,
                message: 'Have you finished the test task?'
              }
            ])
          }
        ],
        stop_reason: 'end_turn'
      });

      const result = await geistService.generatePrompts();

      this.assert(result.success, 'should succeed');
      this.assertEq(result.promptsCreated, 1, 'should create 1 prompt');

      const prompts = await dbService.listPrompts({ status: 'pending', limit: 10 });
      this.assertEq(prompts.length, 1, 'should have 1 prompt in database');
      this.assertEq(prompts[0].itemType, 'task', 'should be task type');
      this.assertEq(prompts[0].itemId, task.id, 'should reference correct task');
      this.assertEq(prompts[0].message, 'Have you finished the test task?', 'should have message');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeneratePromptsUpdatesConfig',
    doc: 'generatePrompts should update lastGenerationAt in PromptConfig',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      geistService.client().setResponse({
        content: [{ type: 'text', text: '[]' }],
        stop_reason: 'end_turn'
      });

      const beforeGen = Date.now();
      await geistService.generatePrompts();
      const afterGen = Date.now();

      const config = await dbService.getPromptConfig({});
      this.assert(config.lastGenerationAt, 'should have lastGenerationAt');
      const genTime = new Date(config.lastGenerationAt).getTime();
      this.assert(genTime >= beforeGen && genTime <= afterGen, 'lastGenerationAt should be recent');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeneratePromptsNoClient',
    doc: 'generatePrompts should fail gracefully when no Claude client',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      geistService.client(null);

      const result = await geistService.generatePrompts();

      this.assertEq(result.success, false, 'should not succeed');
      this.assert(result.error.includes('not configured'), 'should have configuration error');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'PromptConfigLastGenerationTracking',
    doc: 'PromptConfig tracks lastGenerationAt through the database service',
    async do() {
      const database = createTestDb();
      const { dbService } = createTestServices(database);

      const config1 = await dbService.getPromptConfig({});
      this.assert(!config1.lastGenerationAt,
        'should have no lastGenerationAt when freshly created');

      await dbService.updatePromptConfig({
        lastGenerationAt: new Date().toISOString()
      });

      const config2 = await dbService.getPromptConfig({});
      this.assert(config2.lastGenerationAt, 'should have lastGenerationAt after update');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeneratePromptsResultStructure',
    doc: 'generatePrompts returns result with success, promptsCreated, and promptsSkipped fields',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const task = await dbService.createTask({ title: 'Result structure task', priority: 2 });

      geistService.client().setResponse({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                itemType: 'task',
                itemId: task.id,
                message: 'Check on the result structure task?'
              }
            ])
          }
        ],
        stop_reason: 'end_turn'
      });

      const result = await geistService.generatePrompts();

      this.assertEq(result.success, true, 'result should have success: true');
      this.assertEq(result.promptsCreated, 1, 'result should report promptsCreated');
      this.assertEq(result.promptsSkipped, 0, 'result should report promptsSkipped');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GeneratePromptsDuplicatesSkipped',
    doc: 'generatePrompts skips duplicate prompts and reports them in promptsSkipped',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const task = await dbService.createTask({ title: 'Duplicate test task', priority: 2 });

      await dbService.createPrompt({
        itemType: 'task',
        itemId: task.id,
        message: 'Existing prompt for this task',
        status: 'pending'
      });

      geistService.client().setResponse({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                itemType: 'task',
                itemId: task.id,
                message: 'Duplicate prompt for same task'
              }
            ])
          }
        ],
        stop_reason: 'end_turn'
      });

      const result = await geistService.generatePrompts();

      this.assertEq(result.success, true, 'should succeed');
      this.assertEq(result.promptsCreated, 0, 'should create 0 prompts (all duplicates)');
      this.assertEq(result.promptsSkipped, 1, 'should skip 1 duplicate');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ResolveProjectContextEmpty',
    doc: 'resolveProjectContext should return null when no projects exist',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const ctx = await geistService.resolveProjectContext();

      this.assertEq(ctx, null, 'should return null when no projects');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ResolveProjectContextWithProjects',
    doc: 'resolveProjectContext should return projects array and projectList string',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      await dbService.createProject({ title: 'Ancient Coins', slug: 'coins', context: 'Cleaning and identifying ancient Roman coins' });
      await dbService.createProject({ title: 'House Renovation', slug: 'house', context: 'Kitchen and bathroom remodel' });

      const ctx = await geistService.resolveProjectContext();

      this.assert(ctx, 'should return context object');
      this.assertEq(ctx.projects.length, 2, 'should have 2 projects');
      this.assert(ctx.projectList.includes('Ancient Coins'), 'projectList should include first project title');
      this.assert(ctx.projectList.includes('House Renovation'), 'projectList should include second project title');
      this.assert(ctx.projectList.includes('coins'), 'projectList should include first project slug');
      this.assert(ctx.projectList.includes('house'), 'projectList should include second project slug');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ResolveProjectContextExcludesArchived',
    doc: 'resolveProjectContext should only return active (non-archived) projects',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      await dbService.createProject({ title: 'Active Project', slug: 'active' });
      const archived = await dbService.createProject({ title: 'Old Project', slug: 'old' });
      await dbService.updateProject({ id: archived.id, archived: true });

      const ctx = await geistService.resolveProjectContext();

      this.assert(ctx, 'should return context');
      this.assertEq(ctx.projects.length, 1, 'should have 1 active project');
      this.assertEq(ctx.projects[0].title, 'Active Project', 'should be the active one');

      database.close();
    }
  });

  $test.Case.new({
    name: 'BuildSystemPromptNoProjects',
    doc: 'buildSystemPrompt should return base prompt when projectContext is null',
    do() {
      const database = createTestDb();
      const { geistService } = createTestServices(database);

      const prompt = geistService.buildSystemPrompt(null);

      this.assertEq(prompt, geistService.systemPrompt(), 'should return base prompt unchanged');

      database.close();
    }
  });

  $test.Case.new({
    name: 'BuildSystemPromptWithProjects',
    doc: 'buildSystemPrompt should append project listing when projects exist',
    do() {
      const database = createTestDb();
      const { geistService } = createTestServices(database);

      const projectContext = {
        projects: [
          { id: 'p1', title: 'Coins', slug: 'coins', context: 'Ancient coin cleaning' },
          { id: 'p2', title: 'House', slug: 'house', context: 'Kitchen remodel' },
        ],
        projectList: '- [p1] Coins (coins): Ancient coin cleaning\n- [p2] House (house): Kitchen remodel',
      };

      const prompt = geistService.buildSystemPrompt(projectContext);

      this.assert(prompt.includes(geistService.systemPrompt()), 'should include base prompt');
      this.assert(prompt.includes('Coins'), 'should include project name');
      this.assert(prompt.includes('House'), 'should include second project name');
      this.assert(prompt.includes('coins'), 'should include slug');
      this.assert(prompt.includes('projectId'), 'should include projectId instruction');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SystemPromptIncludesProjectToolMappings',
    doc: 'base system prompt should include project tool mappings',
    do() {
      const database = createTestDb();
      const { geistService } = createTestServices(database);

      const prompt = geistService.systemPrompt();

      this.assert(prompt.includes('create_project'), 'should mention create_project');
      this.assert(prompt.includes('list_projects'), 'should mention list_projects');
      this.assert(prompt.includes('move_to_project'), 'should mention move_to_project');
      this.assert(prompt.includes('update_project'), 'should mention update_project');

      database.close();
    }
  });
}.module({
  name: 'test.geist-prompts',
  imports: [base, test, db, sqlite, models, database, geist],
}).load();
