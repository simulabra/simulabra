import { __, base } from 'simulabra';
import test from 'simulabra/test';
import redisModule from '../src/redis.js';
import models from '../src/models.js';
import database from '../src/services/database.js';
import geist from '../src/services/geist.js';

export default await async function (_, $, $test, $redis, $models, $db, $geist) {
  const TEST_PREFIX = 'test:integration:';

  // Access module-level functions from the raw redis module
  const { setKeyPrefix } = await redisModule;

  // Mock Anthropic client for testing tool calls without actual API
  class MockAnthropicClient {
    constructor() {
      this.responses = [];
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
          if (self.responses.length === 0) {
            throw new Error('No mock response set');
          }
          return self.responses.shift();
        }
      };
    }
  }

  // Helper to create isolated test services
  const createTestServices = async () => {
    // Set test prefix for isolation
    setKeyPrefix(TEST_PREFIX);

    const dbService = $db.DatabaseService.new({ uid: 'TestDatabaseService' });
    await dbService.connectRedis();

    const geistService = $geist.GeistService.new({ uid: 'TestGeistService' });
    geistService.dbService(dbService);
    geistService.client(new MockAnthropicClient());

    return { dbService, geistService };
  };

  // Cleanup helper
  const cleanup = async (redis) => {
    await redis.deleteByPattern(TEST_PREFIX + '*');
    setKeyPrefix('');
    await redis.disconnect();
  };

  $test.AsyncCase.new({
    name: 'IntegrationSearchWildcard',
    doc: 'Search with * should return all items',
    async do() {
      const { dbService, geistService } = await createTestServices();

      // Create test data
      await dbService.createLog('integration test log 1');
      await dbService.createLog('integration test log 2');
      await dbService.createTask('integration test task');

      // Mock Claude responding with search tool
      geistService.client().setResponses([
        {
          content: [
            { type: 'tool_use', id: 'tool_1', name: 'search', input: { query: '*' } }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'Found 2 logs and 1 task.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('show me everything');

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted.length, 1, 'should execute 1 tool');
      this.assertEq(result.toolsExecuted[0].tool, 'search');
      this.assert(result.toolsExecuted[0].result.success, 'search should succeed');
      this.assertEq(result.toolsExecuted[0].result.data.logs.length, 2, 'should find 2 logs');
      this.assertEq(result.toolsExecuted[0].result.data.tasks.length, 1, 'should find 1 task');

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationCreateLog',
    doc: 'Create log via interpret with mocked LLM',
    async do() {
      const { dbService, geistService } = await createTestServices();

      // Mock Claude responding with create_log tool
      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'create_log',
              input: { content: 'had a great day today', tags: ['mood', 'positive'] }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'I\'ve recorded your journal entry about having a great day.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('log that I had a great day today');

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted.length, 1);
      this.assertEq(result.toolsExecuted[0].tool, 'create_log');
      this.assertEq(result.toolsExecuted[0].result.data.content, 'had a great day today');
      this.assert(result.response.includes('journal entry'), 'should have response text');

      // Verify it's actually in Redis
      const logs = await dbService.listLogs();
      this.assert(logs.some(l => l.content === 'had a great day today'), 'log should be in Redis');

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationCreateTask',
    doc: 'Create task via interpret with mocked LLM',
    async do() {
      const { dbService, geistService } = await createTestServices();

      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'create_task',
              input: { title: 'buy groceries', priority: 2 }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'Added "buy groceries" as a high priority task.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('remind me to buy groceries, high priority');

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted[0].tool, 'create_task');
      this.assertEq(result.toolsExecuted[0].result.data.title, 'buy groceries');
      this.assertEq(result.toolsExecuted[0].result.data.priority, 2);

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationCompleteTask',
    doc: 'Complete task via interpret with mocked LLM',
    async do() {
      const { dbService, geistService } = await createTestServices();

      // First create a task
      const task = await dbService.createTask('finish report');

      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'complete_task',
              input: { id: task.rid }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'Marked "finish report" as done.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret(`mark task ${task.rid} as done`);

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted[0].result.data.done, true);

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationCreateReminder',
    doc: 'Create reminder via interpret with mocked LLM',
    async do() {
      const { dbService, geistService } = await createTestServices();

      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'create_reminder',
              input: {
                message: 'call mom',
                when: '2026-01-05T15:00:00Z'
              }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'I\'ll remind you to call mom tomorrow at 3 PM.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('remind me to call mom tomorrow at 3pm');

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted[0].tool, 'create_reminder');
      this.assertEq(result.toolsExecuted[0].result.data.message, 'call mom');

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationListLogs',
    doc: 'List logs via interpret with mocked LLM',
    async do() {
      const { dbService, geistService } = await createTestServices();

      await dbService.createLog('log entry 1');
      await dbService.createLog('log entry 2');
      await dbService.createLog('log entry 3');

      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'list_logs',
              input: { limit: 10 }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'Here are your recent journal entries...' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('show me my recent journal entries');

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted[0].tool, 'list_logs');
      this.assertEq(result.toolsExecuted[0].result.data.length, 3, 'should have 3 logs');

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationListTasks',
    doc: 'List tasks via interpret with mocked LLM',
    async do() {
      const { dbService, geistService } = await createTestServices();

      await dbService.createTask('task 1', 1);
      await dbService.createTask('task 2', 2);

      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'list_tasks',
              input: { done: false }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'You have 2 incomplete tasks.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('what tasks do I have?');

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted[0].tool, 'list_tasks');
      this.assertEq(result.toolsExecuted[0].result.data.length, 2);

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationSearchByContent',
    doc: 'Search by content via interpret with mocked LLM',
    async do() {
      const { dbService, geistService } = await createTestServices();

      await dbService.createLog('meeting with alice about project');
      await dbService.createLog('dentist appointment');
      await dbService.createTask('email alice');

      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'search',
              input: { query: 'alice' }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'Found 1 log and 1 task mentioning alice.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('find anything about alice');

      this.assert(result.success, 'interpret should succeed');
      const searchResult = result.toolsExecuted[0].result.data;
      this.assertEq(searchResult.logs.length, 1, 'should find 1 log');
      this.assertEq(searchResult.tasks.length, 1, 'should find 1 task');

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationMultipleTools',
    doc: 'Handle multiple tool calls in sequence',
    async do() {
      const { dbService, geistService } = await createTestServices();

      // Simulate Claude calling two tools
      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'create_log',
              input: { content: 'started working on project X' }
            },
            {
              type: 'tool_use',
              id: 'tool_2',
              name: 'create_task',
              input: { title: 'finish project X', priority: 1 }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'Logged your work start and created a task to finish project X.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('started working on project X, add task to finish it');

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted.length, 2, 'should execute 2 tools');
      this.assertEq(result.toolsExecuted[0].tool, 'create_log');
      this.assertEq(result.toolsExecuted[1].tool, 'create_task');

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationToolError',
    doc: 'Handle tool execution errors gracefully',
    async do() {
      const { dbService, geistService } = await createTestServices();

      // Try to complete a non-existent task
      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'complete_task',
              input: { id: 'non-existent-id' }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'Sorry, I couldn\'t find that task.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('mark task xyz as done');

      this.assert(result.success, 'interpret should still succeed');
      this.assertEq(result.toolsExecuted[0].result.success, false, 'tool should fail');
      this.assert(result.toolsExecuted[0].result.error.includes('not found'), 'should have error message');

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationTextOnlyResponse',
    doc: 'Handle responses with no tool calls',
    async do() {
      const { dbService, geistService } = await createTestServices();

      geistService.client().setResponses([
        {
          content: [
            { type: 'text', text: 'I\'m Agenda, your personal productivity assistant. How can I help?' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('hello');

      this.assert(result.success, 'interpret should succeed');
      this.assertEq(result.toolsExecuted.length, 0, 'no tools should be executed');
      this.assert(result.response.includes('Agenda'), 'should have text response');

      await cleanup(dbService.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'IntegrationRecurringReminder',
    doc: 'Create recurring reminder via interpret',
    async do() {
      const { dbService, geistService } = await createTestServices();

      geistService.client().setResponses([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'create_reminder',
              input: {
                message: 'take vitamins',
                when: '2026-01-05T09:00:00Z',
                recurrence: { pattern: 'daily', interval: 1 }
              }
            }
          ],
          stop_reason: 'tool_use'
        },
        {
          content: [
            { type: 'text', text: 'Set up a daily reminder to take vitamins at 9 AM.' }
          ],
          stop_reason: 'end_turn'
        }
      ]);

      const result = await geistService.interpret('remind me to take vitamins every day at 9am');

      this.assert(result.success, 'interpret should succeed');
      const reminder = result.toolsExecuted[0].result.data;
      this.assertEq(reminder.message, 'take vitamins');
      this.assert(reminder.recurrence, 'should have recurrence');

      await cleanup(dbService.redis());
    }
  });
}.module({
  name: 'test.integration',
  imports: [base, test, redisModule, models, database, geist],
}).load();
