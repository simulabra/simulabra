import { __, base } from 'simulabra';
import test from 'simulabra/test';
import redis from '../../src/redis.js';
import models from '../../src/models.js';
import database from '../../src/services/database.js';
import geist from '../../src/services/geist.js';

export default await async function (_, $, $test, $redis, $models, $db, $geist) {
  // Helper to create a test DatabaseService
  const createDbService = async () => {
    const service = $db.DatabaseService.new({ uid: 'TestDatabaseService' });
    await service.connectRedis();
    return service;
  };

  // Helper to create a test GeistService with mocked database
  const createGeistService = (dbService) => {
    const service = $geist.GeistService.new({ uid: 'TestGeistService' });
    service.dbService(dbService);
    return service;
  };

  $test.Case.new({
    name: 'GeistServiceCreation',
    doc: 'GeistService should be created with defaults',
    do() {
      const service = $geist.GeistService.new({ uid: 'TestGeistService' });
      this.assert(service.tools().length > 0, 'should have tools defined');
    }
  });

  $test.Case.new({
    name: 'GeistServiceHealth',
    doc: 'GeistService should report health',
    do() {
      const service = $geist.GeistService.new({ uid: 'TestGeistService' });
      const health = service.health();
      this.assertEq(health.status, 'ok');
      this.assertEq(health.service, 'GeistService');
    }
  });

  $test.Case.new({
    name: 'GeistServiceToolDefinitions',
    doc: 'GeistService should have correct tool definitions',
    do() {
      const service = $geist.GeistService.new({ uid: 'TestGeistService' });
      const tools = service.tools();

      const toolNames = tools.map(t => t.name);
      this.assert(toolNames.includes('create_log'), 'should have create_log');
      this.assert(toolNames.includes('create_task'), 'should have create_task');
      this.assert(toolNames.includes('complete_task'), 'should have complete_task');
      this.assert(toolNames.includes('create_reminder'), 'should have create_reminder');
      this.assert(toolNames.includes('search'), 'should have search');
      this.assert(toolNames.includes('list_tasks'), 'should have list_tasks');
      this.assert(toolNames.includes('list_logs'), 'should have list_logs');
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteCreateLog',
    doc: 'GeistService should execute create_log tool',
    async do() {
      const dbService = await createDbService();
      const geistService = createGeistService(dbService);

      const result = await geistService.executeTool('create_log', {
        content: 'test log from geist'
      });

      this.assert(result.success, 'should succeed');
      this.assertEq(result.data.$class, 'Log');
      this.assertEq(result.data.content, 'test log from geist');

      // Cleanup
      const log = await $models.Log.findById(dbService.redis(), result.data.rid);
      await log.delete(dbService.redis());
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteCreateTask',
    doc: 'GeistService should execute create_task tool',
    async do() {
      const dbService = await createDbService();
      const geistService = createGeistService(dbService);

      const result = await geistService.executeTool('create_task', {
        title: 'test task from geist',
        priority: 2
      });

      this.assert(result.success, 'should succeed');
      this.assertEq(result.data.$class, 'Task');
      this.assertEq(result.data.title, 'test task from geist');
      this.assertEq(result.data.priority, 2);

      // Cleanup
      const task = await $models.Task.findById(dbService.redis(), result.data.rid);
      await task.delete(dbService.redis());
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteCompleteTask',
    doc: 'GeistService should execute complete_task tool',
    async do() {
      const dbService = await createDbService();
      const geistService = createGeistService(dbService);

      // First create a task
      const task = await dbService.createTask('task to complete');

      const result = await geistService.executeTool('complete_task', {
        id: task.rid
      });

      this.assert(result.success, 'should succeed');
      this.assertEq(result.data.done, true);

      // Cleanup
      const taskObj = await $models.Task.findById(dbService.redis(), task.rid);
      await taskObj.delete(dbService.redis());
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteCreateReminder',
    doc: 'GeistService should execute create_reminder tool',
    async do() {
      const dbService = await createDbService();
      const geistService = createGeistService(dbService);

      const result = await geistService.executeTool('create_reminder', {
        message: 'test reminder from geist',
        when: '2025-12-31T10:00:00Z'
      });

      this.assert(result.success, 'should succeed');
      this.assertEq(result.data.$class, 'Reminder');
      this.assertEq(result.data.message, 'test reminder from geist');

      // Cleanup
      const reminder = await $models.Reminder.findById(dbService.redis(), result.data.rid);
      await reminder.delete(dbService.redis());
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteSearch',
    doc: 'GeistService should execute search tool',
    async do() {
      const dbService = await createDbService();
      const geistService = createGeistService(dbService);

      // Create some searchable items
      await dbService.createLog('geist search test log');
      await dbService.createTask('geist search test task');

      const result = await geistService.executeTool('search', {
        query: 'geist search test'
      });

      this.assert(result.success, 'should succeed');
      this.assert(result.data.logs.length >= 1, 'should find logs');
      this.assert(result.data.tasks.length >= 1, 'should find tasks');

      // Cleanup
      for (const log of result.data.logs) {
        const obj = await $models.Log.findById(dbService.redis(), log.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      for (const task of result.data.tasks) {
        const obj = await $models.Task.findById(dbService.redis(), task.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteListTasks',
    doc: 'GeistService should execute list_tasks tool',
    async do() {
      const dbService = await createDbService();
      const geistService = createGeistService(dbService);

      // Create some tasks
      await dbService.createTask('geist list task 1');
      await dbService.createTask('geist list task 2');

      const result = await geistService.executeTool('list_tasks', {});

      this.assert(result.success, 'should succeed');
      this.assert(result.data.length >= 2, 'should have at least 2 tasks');

      // Cleanup
      for (const task of result.data) {
        const obj = await $models.Task.findById(dbService.redis(), task.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceExecuteListLogs',
    doc: 'GeistService should execute list_logs tool',
    async do() {
      const dbService = await createDbService();
      const geistService = createGeistService(dbService);

      await dbService.createLog('geist list log 1');
      await dbService.createLog('geist list log 2');

      const result = await geistService.executeTool('list_logs', { limit: 10 });

      this.assert(result.success, 'should succeed');
      this.assert(result.data.length >= 2, 'should have at least 2 logs');

      // Cleanup
      for (const log of result.data) {
        const obj = await $models.Log.findById(dbService.redis(), log.rid);
        if (obj) await obj.delete(dbService.redis());
      }
      await dbService.redis().disconnect();
    }
  });

  $test.AsyncCase.new({
    name: 'GeistServiceUnknownTool',
    doc: 'GeistService should handle unknown tool gracefully',
    async do() {
      const dbService = await createDbService();
      const geistService = createGeistService(dbService);

      const result = await geistService.executeTool('unknown_tool', {});

      this.assertEq(result.success, false);
      this.assert(result.error.includes('Unknown tool'), 'should have error message');

      await dbService.redis().disconnect();
    }
  });

  $test.Case.new({
    name: 'GeistServiceBuildMessages',
    doc: 'GeistService should build messages for Claude',
    do() {
      const service = $geist.GeistService.new({ uid: 'TestGeistService' });
      const messages = service.buildMessages('remind me to call mom tomorrow');

      this.assertEq(messages.length, 1);
      this.assertEq(messages[0].role, 'user');
      this.assertEq(messages[0].content, 'remind me to call mom tomorrow');
    }
  });
}.module({
  name: 'test.services.geist',
  imports: [base, test, redis, models, database, geist],
}).load();
