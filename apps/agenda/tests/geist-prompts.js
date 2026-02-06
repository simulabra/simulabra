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
    name: 'GetHauntById',
    doc: 'getHaunt should return a single haunt by id',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const created = await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Test haunt',
        status: 'pending'
      });

      const fetched = await dbService.getHaunt({ id: created.id });

      this.assertEq(fetched.id, created.id, 'should have matching id');
      this.assertEq(fetched.message, 'Test haunt', 'should have message');

      const missing = await dbService.getHaunt({ id: 'nonexistent' });
      this.assertEq(missing, null, 'should return null for missing haunt');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GetPendingHauntsEmpty',
    doc: 'getPendingHaunts should return empty array when no haunts exist',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const haunts = await geistService.getPendingHaunts({ limit: 10 });

      this.assertEq(haunts.length, 0, 'should return empty array');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GetPendingHauntsWithData',
    doc: 'getPendingHaunts should return pending haunts, excluding snoozed ones',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Haunt 1',
        status: 'pending'
      });
      await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-2',
        message: 'Haunt 2',
        status: 'pending'
      });
      await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-3',
        message: 'Actioned haunt',
        status: 'actioned'
      });

      const haunts = await geistService.getPendingHaunts({ limit: 10 });

      this.assertEq(haunts.length, 2, 'should return 2 pending haunts');
      this.assert(haunts.every(h => h.status === 'pending'), 'all should be pending');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GetPendingHauntsExcludesSnoozed',
    doc: 'getPendingHaunts should exclude haunts that are snoozed until later',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pastTime = new Date(Date.now() - 60 * 60 * 1000);

      await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Active haunt',
        status: 'pending'
      });

      const snoozedHaunt = await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-2',
        message: 'Snoozed haunt',
        status: 'pending'
      });
      await dbService.updateHaunt({
        id: snoozedHaunt.id,
        snoozeUntil: futureTime.toISOString()
      });

      const expiredSnooze = await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-3',
        message: 'Expired snooze haunt',
        status: 'pending'
      });
      await dbService.updateHaunt({
        id: expiredSnooze.id,
        snoozeUntil: pastTime.toISOString()
      });

      const haunts = await geistService.getPendingHaunts({ limit: 10 });

      this.assertEq(haunts.length, 2, 'should return 2 haunts (active + expired snooze)');
      const messages = haunts.map(h => h.message);
      this.assert(messages.includes('Active haunt'), 'should include active haunt');
      this.assert(messages.includes('Expired snooze haunt'), 'should include expired snooze');
      this.assert(!messages.includes('Snoozed haunt'), 'should not include future snoozed');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionHauntDone',
    doc: 'actionHaunt with done action should complete the related task',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const task = await dbService.createTask({ title: 'Test task', priority: 2 });
      const haunt = await dbService.createHaunt({
        itemType: 'task',
        itemId: task.id,
        message: 'Did you finish this?',
        status: 'pending'
      });

      const result = await geistService.actionHaunt({ id: haunt.id, action: 'done' });

      this.assertEq(result.status, 'actioned', 'haunt should be actioned');
      this.assertEq(result.action, 'done', 'action should be done');
      this.assert(result.actionedAt, 'should have actionedAt');

      const updatedTask = await dbService.getTask({ id: task.id });
      this.assertEq(updatedTask.done, true, 'task should be completed');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionHauntBacklog',
    doc: 'actionHaunt with backlog action should set task priority to 5',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const task = await dbService.createTask({ title: 'Test task', priority: 2 });
      const haunt = await dbService.createHaunt({
        itemType: 'task',
        itemId: task.id,
        message: 'Is this still important?',
        status: 'pending'
      });

      const result = await geistService.actionHaunt({ id: haunt.id, action: 'backlog' });

      this.assertEq(result.status, 'actioned', 'haunt should be actioned');
      this.assertEq(result.action, 'backlog', 'action should be backlog');

      const updatedTask = await dbService.getTask({ id: task.id });
      this.assertEq(updatedTask.priority, 5, 'task priority should be 5');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionHauntSnooze',
    doc: 'actionHaunt with snooze action should set snoozeUntil to +24 hours',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const haunt = await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Check on this later',
        status: 'pending'
      });

      const beforeAction = Date.now();
      const result = await geistService.actionHaunt({ id: haunt.id, action: 'snooze' });
      const afterAction = Date.now();

      this.assertEq(result.status, 'pending', 'haunt should stay pending when snoozed');
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
    name: 'ActionHauntDismiss',
    doc: 'actionHaunt with dismiss action should mark as dismissed',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const haunt = await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Dismissable haunt',
        status: 'pending'
      });

      const result = await geistService.actionHaunt({ id: haunt.id, action: 'dismiss' });

      this.assertEq(result.status, 'dismissed', 'haunt should be dismissed');
      this.assertEq(result.action, 'dismiss', 'action should be dismiss');
      this.assert(result.actionedAt, 'should have actionedAt');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'ActionHauntRecordsHistory',
    doc: 'actionHaunt should record response in HauntConfig.responseHistory',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const haunt = await dbService.createHaunt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Test haunt',
        status: 'pending'
      });

      await geistService.actionHaunt({ id: haunt.id, action: 'done' });

      const config = await dbService.getHauntConfig({});
      this.assert(config.responseHistory.length > 0, 'should have response history');
      this.assertEq(config.responseHistory[0].hauntId, haunt.id, 'should record haunt id');
      this.assertEq(config.responseHistory[0].action, 'done', 'should record action');
      this.assertEq(config.responseHistory[0].itemType, 'task', 'should record item type');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'AnalyzeContext',
    doc: 'analyzeContext should gather tasks, logs, reminders, and projects',
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
      this.assert(context.projects, 'should have projects');
      this.assert(context.projectMap, 'should have projectMap');
      this.assert(context.tasksByProject, 'should have tasksByProject');
      this.assertEq(context.tasks.length, 2, 'should have 2 tasks');
      this.assertEq(context.logs.length, 1, 'should have 1 log');
      this.assertEq(context.projects.length, 0, 'should have 0 projects');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'AnalyzeContextIncludesProjects',
    doc: 'analyzeContext should include projects and group tasks by project',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const project = await dbService.createProject({ title: 'Coins', slug: 'coins', context: 'Ancient coin cleaning' });
      await dbService.createTask({ title: 'Clean denarius', priority: 2, projectId: project.id });
      await dbService.createTask({ title: 'ID sestertius', priority: 3, projectId: project.id });

      const context = await geistService.analyzeContext();

      this.assertEq(context.projects.length, 1, 'should have 1 project');
      this.assertEq(context.projects[0].title, 'Coins', 'project title should match');
      this.assert(context.projectMap[project.id], 'projectMap should have project by id');
      this.assertEq(context.projectMap[project.id].title, 'Coins', 'projectMap entry should match');
      this.assert(context.tasksByProject[project.id], 'tasksByProject should have project key');
      this.assertEq(context.tasksByProject[project.id].length, 2, 'should have 2 tasks for project');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'AnalyzeContextGroupsCorrectly',
    doc: 'analyzeContext should group tasks by project and inbox correctly',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const proj1 = await dbService.createProject({ title: 'Coins', slug: 'coins' });
      const proj2 = await dbService.createProject({ title: 'House', slug: 'house' });
      await dbService.createTask({ title: 'Clean coin', priority: 2, projectId: proj1.id });
      await dbService.createTask({ title: 'Fix roof', priority: 1, projectId: proj2.id });
      await dbService.createTask({ title: 'Buy groceries', priority: 3 });

      const context = await geistService.analyzeContext();

      this.assertEq(context.projects.length, 2, 'should have 2 projects');
      this.assertEq(context.tasksByProject[proj1.id].length, 1, 'project 1 should have 1 task');
      this.assertEq(context.tasksByProject[proj2.id].length, 1, 'project 2 should have 1 task');
      this.assert(context.tasksByProject['inbox'], 'should have inbox key');
      this.assertEq(context.tasksByProject['inbox'].length, 1, 'inbox should have 1 task');
      this.assertEq(context.tasksByProject['inbox'][0].title, 'Buy groceries', 'inbox task should match');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'AnalyzeContextNoProjects',
    doc: 'analyzeContext should work with zero projects, all tasks under inbox',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      await dbService.createTask({ title: 'Task 1', priority: 2 });
      await dbService.createTask({ title: 'Task 2', priority: 3 });

      const context = await geistService.analyzeContext();

      this.assertEq(context.projects.length, 0, 'should have 0 projects');
      this.assert(context.tasksByProject['inbox'], 'should have inbox key');
      this.assertEq(context.tasksByProject['inbox'].length, 2, 'inbox should have 2 tasks');
      this.assertEq(Object.keys(context.tasksByProject).length, 1, 'should only have inbox key');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GenerateHauntsGroupsByProject',
    doc: 'generateHaunts should format tasks grouped by project in the user message',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const project = await dbService.createProject({ title: 'Coins', slug: 'coins', context: 'Ancient coin identification and cleaning' });
      const task = await dbService.createTask({ title: 'Clean denarius', priority: 2, projectId: project.id });
      await dbService.createTask({ title: 'Buy groceries', priority: 3 });

      geistService.client().setResponse({
        content: [{ type: 'text', text: '[]' }],
        stop_reason: 'end_turn'
      });

      await geistService.generateHaunts();

      const userMsg = geistService.client().lastRequest.messages[0].content;
      this.assert(userMsg.includes('Coins:'), 'should include project name as header');
      this.assert(userMsg.includes('Ancient coin'), 'should include project context snippet');
      this.assert(userMsg.includes('Inbox (unassigned):'), 'should include inbox section');
      this.assert(userMsg.includes('Clean denarius'), 'should include project task');
      this.assert(userMsg.includes('Buy groceries'), 'should include inbox task');
      this.assert(userMsg.includes('Active projects (1):'), 'should include project listing');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GenerateHauntsProjectId',
    doc: 'generateHaunts should store projectId in haunt context when Claude includes it',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const project = await dbService.createProject({ title: 'Coins', slug: 'coins' });
      const task = await dbService.createTask({ title: 'Clean coin', priority: 2, projectId: project.id });

      geistService.client().setResponse({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                itemType: 'task',
                itemId: task.id,
                message: 'How is the coin cleaning going?',
                projectId: project.id
              }
            ])
          }
        ],
        stop_reason: 'end_turn'
      });

      const result = await geistService.generateHaunts();

      this.assert(result.success, 'should succeed');
      this.assertEq(result.hauntsCreated, 1, 'should create 1 haunt');

      const haunts = await dbService.listHaunts({ status: 'pending', limit: 10 });
      const created = haunts[0];
      this.assert(created.context, 'should have context');
      const ctx = typeof created.context === 'string' ? JSON.parse(created.context) : created.context;
      this.assertEq(ctx.projectId, project.id, 'context should carry projectId');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GenerateHauntsCallsClaude',
    doc: 'generateHaunts should call Claude API with context',
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

      const result = await geistService.generateHaunts();

      this.assert(result.success, 'should succeed');
      this.assert(geistService.client().lastRequest, 'should have made API call');
      this.assert(
        geistService.client().lastRequest.system.includes('productivity'),
        'should include haunt generation system prompt'
      );

      database.close();
    }
  });

  $test.Case.new({
    name: 'HauntSystemPromptIncludesFreshTasks',
    doc: 'haunt generation system prompt should mention recently added tasks',
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
    name: 'GenerateHauntsCreatesRecords',
    doc: 'generateHaunts should create Haunt records from Claude response',
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

      const result = await geistService.generateHaunts();

      this.assert(result.success, 'should succeed');
      this.assertEq(result.hauntsCreated, 1, 'should create 1 haunt');

      const haunts = await dbService.listHaunts({ status: 'pending', limit: 10 });
      this.assertEq(haunts.length, 1, 'should have 1 haunt in database');
      this.assertEq(haunts[0].itemType, 'task', 'should be task type');
      this.assertEq(haunts[0].itemId, task.id, 'should reference correct task');
      this.assertEq(haunts[0].message, 'Have you finished the test task?', 'should have message');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GenerateHauntsUpdatesConfig',
    doc: 'generateHaunts should update lastGenerationAt in HauntConfig',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      geistService.client().setResponse({
        content: [{ type: 'text', text: '[]' }],
        stop_reason: 'end_turn'
      });

      const beforeGen = Date.now();
      await geistService.generateHaunts();
      const afterGen = Date.now();

      const config = await dbService.getHauntConfig({});
      this.assert(config.lastGenerationAt, 'should have lastGenerationAt');
      const genTime = new Date(config.lastGenerationAt).getTime();
      this.assert(genTime >= beforeGen && genTime <= afterGen, 'lastGenerationAt should be recent');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GenerateHauntsNoClient',
    doc: 'generateHaunts should fail gracefully when no Claude client',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      geistService.client(null);

      const result = await geistService.generateHaunts();

      this.assertEq(result.success, false, 'should not succeed');
      this.assert(result.error.includes('not configured'), 'should have configuration error');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'HauntConfigLastGenerationTracking',
    doc: 'HauntConfig tracks lastGenerationAt through the database service',
    async do() {
      const database = createTestDb();
      const { dbService } = createTestServices(database);

      const config1 = await dbService.getHauntConfig({});
      this.assert(!config1.lastGenerationAt,
        'should have no lastGenerationAt when freshly created');

      await dbService.updateHauntConfig({
        lastGenerationAt: new Date().toISOString()
      });

      const config2 = await dbService.getHauntConfig({});
      this.assert(config2.lastGenerationAt, 'should have lastGenerationAt after update');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GenerateHauntsResultStructure',
    doc: 'generateHaunts returns result with success, hauntsCreated, and hauntsSkipped fields',
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

      const result = await geistService.generateHaunts();

      this.assertEq(result.success, true, 'result should have success: true');
      this.assertEq(result.hauntsCreated, 1, 'result should report hauntsCreated');
      this.assertEq(result.hauntsSkipped, 0, 'result should report hauntsSkipped');

      database.close();
    }
  });

  $test.AsyncCase.new({
    name: 'GenerateHauntsDuplicatesSkipped',
    doc: 'generateHaunts skips duplicate haunts and reports them in hauntsSkipped',
    async do() {
      const database = createTestDb();
      const { dbService, geistService } = createTestServices(database);

      const task = await dbService.createTask({ title: 'Duplicate test task', priority: 2 });

      await dbService.createHaunt({
        itemType: 'task',
        itemId: task.id,
        message: 'Existing haunt for this task',
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
                message: 'Duplicate haunt for same task'
              }
            ])
          }
        ],
        stop_reason: 'end_turn'
      });

      const result = await geistService.generateHaunts();

      this.assertEq(result.success, true, 'should succeed');
      this.assertEq(result.hauntsCreated, 0, 'should create 0 haunts (all duplicates)');
      this.assertEq(result.hauntsSkipped, 1, 'should skip 1 duplicate');

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

  const mergeTimeline = (messages, prompts) => {
    const tagged = [
      ...messages.map(m => ({ kind: 'message', ts: m.timestamp || m.createdAt, item: m })),
      ...prompts.map(p => ({ kind: 'prompt', ts: p.createdAt, item: p })),
    ];
    const withTs = tagged.filter(e => e.ts);
    const withoutTs = tagged.filter(e => !e.ts);
    withTs.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    return [...withTs, ...withoutTs];
  };

  $test.Case.new({
    name: 'ChatTimelineMergesChronologically',
    doc: 'chatTimeline should interleave messages and prompts by timestamp',
    do() {
      const messages = [
        { role: 'user', content: 'Hello', timestamp: '2025-01-15T10:00:00Z' },
        { role: 'assistant', content: 'Hi', timestamp: '2025-01-15T10:02:00Z' },
        { role: 'user', content: 'Bye', timestamp: '2025-01-15T10:04:00Z' },
      ];
      const prompts = [
        { id: 'p1', message: 'Check task?', createdAt: '2025-01-15T10:01:00Z' },
        { id: 'p2', message: 'How about this?', createdAt: '2025-01-15T10:03:00Z' },
      ];

      const timeline = mergeTimeline(messages, prompts);

      this.assertEq(timeline.length, 5, 'should have 5 entries');
      this.assertEq(timeline[0].kind, 'message', 'T+0 should be message');
      this.assertEq(timeline[1].kind, 'prompt', 'T+1 should be prompt');
      this.assertEq(timeline[2].kind, 'message', 'T+2 should be message');
      this.assertEq(timeline[3].kind, 'prompt', 'T+3 should be prompt');
      this.assertEq(timeline[4].kind, 'message', 'T+4 should be message');
    }
  });

  $test.Case.new({
    name: 'ChatTimelineNoTimestampSortsToEnd',
    doc: 'messages without timestamps should appear after all timestamped items',
    do() {
      const messages = [
        { role: 'system', content: 'Connected' },
        { role: 'user', content: 'Hello', timestamp: '2025-01-15T10:00:00Z' },
      ];
      const prompts = [
        { id: 'p1', message: 'Check task?', createdAt: '2025-01-15T10:01:00Z' },
      ];

      const timeline = mergeTimeline(messages, prompts);

      this.assertEq(timeline.length, 3, 'should have 3 entries');
      this.assertEq(timeline[0].kind, 'message', 'first should be timestamped message');
      this.assertEq(timeline[0].item.content, 'Hello', 'first should be Hello');
      this.assertEq(timeline[1].kind, 'prompt', 'second should be prompt');
      this.assertEq(timeline[2].kind, 'message', 'last should be no-timestamp message');
      this.assertEq(timeline[2].item.content, 'Connected', 'last should be system message');
    }
  });

  $test.Case.new({
    name: 'ChatTimelineEmptyPrompts',
    doc: 'chatTimeline with no prompts should return messages only',
    do() {
      const messages = [
        { role: 'user', content: 'Hello', timestamp: '2025-01-15T10:00:00Z' },
        { role: 'assistant', content: 'Hi', timestamp: '2025-01-15T10:01:00Z' },
      ];

      const timeline = mergeTimeline(messages, []);

      this.assertEq(timeline.length, 2, 'should have 2 entries');
      this.assert(timeline.every(e => e.kind === 'message'), 'all should be messages');
    }
  });

  $test.Case.new({
    name: 'ChatTimelineEmptyMessages',
    doc: 'chatTimeline with no messages should return prompts only',
    do() {
      const prompts = [
        { id: 'p1', message: 'Check this?', createdAt: '2025-01-15T10:00:00Z' },
        { id: 'p2', message: 'How about that?', createdAt: '2025-01-15T10:01:00Z' },
      ];

      const timeline = mergeTimeline([], prompts);

      this.assertEq(timeline.length, 2, 'should have 2 entries');
      this.assert(timeline.every(e => e.kind === 'prompt'), 'all should be prompts');
    }
  });

  $test.Case.new({
    name: 'SystemPromptIncludesProjectToolMappings',
    doc: 'base system prompt should include project and task tool mappings',
    do() {
      const database = createTestDb();
      const { geistService } = createTestServices(database);

      const prompt = geistService.systemPrompt();

      this.assert(prompt.includes('create_project'), 'should mention create_project');
      this.assert(prompt.includes('list_projects'), 'should mention list_projects');
      this.assert(prompt.includes('move_to_project'), 'should mention move_to_project');
      this.assert(prompt.includes('update_project'), 'should mention update_project');
      this.assert(prompt.includes('update_task'), 'should mention update_task');

      database.close();
    }
  });

  $test.Case.new({
    name: 'SystemPromptDistinguishesProjectsFromTasks',
    doc: 'base system prompt should clearly explain that projects are containers, not tasks',
    do() {
      const database = createTestDb();
      const { geistService } = createTestServices(database);

      const prompt = geistService.systemPrompt();

      this.assert(prompt.includes('organizational containers'), 'should describe projects as organizational containers');
      this.assert(prompt.includes('do NOT use create_task'), 'should warn against using create_task for projects');
      this.assert(prompt.includes('projects and tasks are different'), 'should state projects and tasks are different');

      database.close();
    }
  });
}.module({
  name: 'test.geist-prompts',
  imports: [base, test, db, sqlite, models, database, geist],
}).load();
