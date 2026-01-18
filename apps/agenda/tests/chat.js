import { __, base } from 'simulabra';
import test from 'simulabra/test';
import helpers from './support/helpers.js';
import redis from '../src/redis.js';
import database from '../src/services/database.js';

export default await async function (_, $, $test, $helpers, $redis, $db) {
  let testCounter = 0;

  const createTestService = async () => {
    const prefix = `test:chat:${++testCounter}:`;
    const service = $db.DatabaseService.new({ uid: 'TestChatDatabaseService' });
    await service.connectRedis();
    service.redis().keyPrefix(prefix);
    await service.redis().deleteByPattern(prefix + '*');
    return service;
  };

  const cleanup = async (redis) => {
    const prefix = redis.keyPrefix();
    await redis.deleteByPattern(prefix + '*');
    await redis.disconnect();
  };

  $test.AsyncCase.new({
    name: 'ChatAppendAndList',
    doc: 'appendChatMessage and listChatMessages should work correctly',
    async do() {
      const service = await createTestService();

      const msg1 = await service.appendChatMessage({
        conversationId: 'main',
        role: 'user',
        content: 'Hello',
        source: 'cli',
      });

      const msg2 = await service.appendChatMessage({
        conversationId: 'main',
        role: 'assistant',
        content: 'Hi there!',
        source: 'geist',
      });

      const msg3 = await service.appendChatMessage({
        conversationId: 'main',
        role: 'user',
        content: 'How are you?',
        source: 'ui',
        clientUid: 'browser-123',
      });

      this.assert(msg1.id, 'msg1 should have id');
      this.assert(msg2.id, 'msg2 should have id');
      this.assert(msg3.id, 'msg3 should have id');

      const messages = await service.listChatMessages({ conversationId: 'main', limit: 10 });

      this.assertEq(messages.length, 3, 'should have 3 messages');
      this.assertEq(messages[0].content, 'Hello', 'first message should be Hello');
      this.assertEq(messages[1].content, 'Hi there!', 'second message should be Hi there!');
      this.assertEq(messages[2].content, 'How are you?', 'third message should be How are you?');
      this.assertEq(messages[2].clientUid, 'browser-123', 'should preserve clientUid');

      await cleanup(service.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'ChatListOrdering',
    doc: 'listChatMessages should return messages oldest to newest',
    async do() {
      const service = await createTestService();

      for (let i = 1; i <= 5; i++) {
        await service.appendChatMessage({
          conversationId: 'main',
          role: 'user',
          content: `Message ${i}`,
          source: 'test',
        });
      }

      const messages = await service.listChatMessages({ conversationId: 'main', limit: 10 });

      this.assertEq(messages.length, 5, 'should have 5 messages');
      this.assertEq(messages[0].content, 'Message 1', 'first should be oldest');
      this.assertEq(messages[4].content, 'Message 5', 'last should be newest');

      await cleanup(service.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'ChatListLimit',
    doc: 'listChatMessages should respect limit and return newest N messages',
    async do() {
      const service = await createTestService();

      for (let i = 1; i <= 10; i++) {
        await service.appendChatMessage({
          conversationId: 'main',
          role: 'user',
          content: `Message ${i}`,
          source: 'test',
        });
      }

      const messages = await service.listChatMessages({ conversationId: 'main', limit: 3 });

      this.assertEq(messages.length, 3, 'should have 3 messages');
      this.assertEq(messages[0].content, 'Message 8', 'should start from 8th');
      this.assertEq(messages[2].content, 'Message 10', 'should end at 10th');

      await cleanup(service.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'ChatReadAfter',
    doc: 'readChatMessages should return messages after a given id',
    async do() {
      const service = await createTestService();

      const msg1 = await service.appendChatMessage({
        conversationId: 'main',
        role: 'user',
        content: 'First',
        source: 'test',
      });

      const msg2 = await service.appendChatMessage({
        conversationId: 'main',
        role: 'user',
        content: 'Second',
        source: 'test',
      });

      const msg3 = await service.appendChatMessage({
        conversationId: 'main',
        role: 'user',
        content: 'Third',
        source: 'test',
      });

      const after1 = await service.readChatMessages({
        conversationId: 'main',
        afterId: msg1.id,
        limit: 10
      });

      this.assertEq(after1.length, 2, 'should have 2 messages after first');
      this.assertEq(after1[0].content, 'Second', 'first after should be Second');
      this.assertEq(after1[1].content, 'Third', 'second after should be Third');

      const after2 = await service.readChatMessages({
        conversationId: 'main',
        afterId: msg2.id,
        limit: 10
      });

      this.assertEq(after2.length, 1, 'should have 1 message after second');
      this.assertEq(after2[0].content, 'Third', 'should be Third');

      await cleanup(service.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'ChatWaitTimeout',
    doc: 'waitForChatMessages should timeout and return empty when no new messages',
    async do() {
      const service = await createTestService();

      await service.appendChatMessage({
        conversationId: 'main',
        role: 'user',
        content: 'Initial',
        source: 'test',
      });

      const messages = await service.listChatMessages({ conversationId: 'main', limit: 1 });
      const lastId = messages[0].id;

      const start = Date.now();
      const result = await service.waitForChatMessages({
        conversationId: 'main',
        afterId: lastId,
        timeoutMs: 500,
        limit: 10,
      });
      const elapsed = Date.now() - start;

      this.assertEq(result.length, 0, 'should return empty on timeout');
      this.assert(elapsed >= 400, 'should have waited ~500ms');

      await cleanup(service.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'ChatReadNewMessages',
    doc: 'readChatMessages should return new messages after a given id',
    async do() {
      const service = await createTestService();

      await service.appendChatMessage({
        conversationId: 'main',
        role: 'user',
        content: 'Initial',
        source: 'test',
      });

      const messages = await service.listChatMessages({ conversationId: 'main', limit: 1 });
      const lastId = messages[0].id;

      await service.appendChatMessage({
        conversationId: 'main',
        role: 'user',
        content: 'New message!',
        source: 'background',
      });

      const result = await service.readChatMessages({
        conversationId: 'main',
        afterId: lastId,
        limit: 10,
      });

      this.assertEq(result.length, 1, 'should find 1 new message');
      this.assertEq(result[0].content, 'New message!', 'should be the new message');

      await cleanup(service.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'ChatMetadata',
    doc: 'appendChatMessage should preserve metadata',
    async do() {
      const service = await createTestService();

      const msg = await service.appendChatMessage({
        conversationId: 'main',
        role: 'assistant',
        content: 'Task created',
        source: 'geist',
        meta: { toolsExecuted: ['create_task'], taskId: 'abc123' },
      });

      this.assert(msg.meta, 'should have meta');
      this.assertEq(msg.meta.toolsExecuted[0], 'create_task', 'should preserve toolsExecuted');
      this.assertEq(msg.meta.taskId, 'abc123', 'should preserve taskId');

      const messages = await service.listChatMessages({ conversationId: 'main', limit: 1 });
      this.assert(messages[0].meta, 'listed message should have meta');
      this.assertEq(messages[0].meta.toolsExecuted[0], 'create_task', 'should preserve meta through list');

      await cleanup(service.redis());
    }
  });

  $test.AsyncCase.new({
    name: 'ChatMultipleConversations',
    doc: 'messages should be isolated by conversationId',
    async do() {
      const service = await createTestService();

      await service.appendChatMessage({
        conversationId: 'conv1',
        role: 'user',
        content: 'Hello conv1',
        source: 'test',
      });

      await service.appendChatMessage({
        conversationId: 'conv2',
        role: 'user',
        content: 'Hello conv2',
        source: 'test',
      });

      const conv1Messages = await service.listChatMessages({ conversationId: 'conv1', limit: 10 });
      const conv2Messages = await service.listChatMessages({ conversationId: 'conv2', limit: 10 });

      this.assertEq(conv1Messages.length, 1, 'conv1 should have 1 message');
      this.assertEq(conv2Messages.length, 1, 'conv2 should have 1 message');
      this.assertEq(conv1Messages[0].content, 'Hello conv1', 'conv1 message content');
      this.assertEq(conv2Messages[0].content, 'Hello conv2', 'conv2 message content');

      await cleanup(service.redis());
    }
  });
}.module({
  name: 'test.chat',
  imports: [base, test, helpers, redis, database],
}).load();
