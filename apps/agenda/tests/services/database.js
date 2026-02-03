import { Database } from 'bun:sqlite';
import { __, base } from 'simulabra';
import test from 'simulabra/test';
import db from 'simulabra/db';
import helpers from '../support/helpers.js';
import sqlite from '../../src/sqlite.js';
import models from '../../src/models.js';
import database from '../../src/services/database.js';

export default await async function (_, $, $test, $db, $helpers, $sqlite, $models, $database) {
  const createTestService = () => {
    const service = $database.DatabaseService.new({
      uid: 'TestDatabaseService',
      dbPath: ':memory:'
    });
    service.initDatabase();
    return service;
  };

  $test.Case.new({
    name: 'DatabaseServiceHealth',
    doc: 'DatabaseService should report health',
    do() {
      const service = createTestService();
      const health = service.health();
      this.assertEq(health.status, 'ok');
      this.assertEq(health.service, 'DatabaseService');
      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateLog',
    doc: 'DatabaseService should create logs',
    do() {
      const service = createTestService();

      const log = service.createLog({ content: 'test log entry', tags: ['tag1', 'tag2'] });
      this.assert(log.$class === 'Log', 'should return Log');
      this.assertEq(log.content, 'test log entry');
      this.assertEq(log.tags[0], 'tag1');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListLogs',
    doc: 'DatabaseService should list logs',
    do() {
      const service = createTestService();

      service.createLog({ content: 'log 1' });
      service.createLog({ content: 'log 2' });

      const logs = service.listLogs({ limit: 10 });
      this.assertEq(logs.length, 2, 'should have 2 logs');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateTask',
    doc: 'DatabaseService should create tasks',
    do() {
      const service = createTestService();

      const task = service.createTask({ title: 'test task', priority: 1, dueDate: '2025-12-31' });
      this.assert(task.$class === 'Task', 'should return Task');
      this.assertEq(task.title, 'test task');
      this.assertEq(task.priority, 1);
      this.assertEq(task.done, false);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCompleteTask',
    doc: 'DatabaseService should complete tasks',
    do() {
      const service = createTestService();

      const task = service.createTask({ title: 'complete me' });
      const completed = service.completeTask({ id: task.id });
      this.assertEq(completed.done, true);
      this.assert(completed.completedAt, 'should have completedAt');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceToggleTask',
    doc: 'DatabaseService should toggle tasks between done and not-done',
    do() {
      const service = createTestService();

      const task = service.createTask({ title: 'toggle me' });
      this.assertEq(task.done, false, 'should start not done');

      const toggled = service.toggleTask({ id: task.id });
      this.assertEq(toggled.done, true, 'should be done after first toggle');
      this.assert(toggled.completedAt, 'should have completedAt after completing');

      const unToggled = service.toggleTask({ id: task.id });
      this.assertEq(unToggled.done, false, 'should be not done after second toggle');
      this.assertEq(unToggled.completedAt, null, 'completedAt should be cleared');

      const reToggled = service.toggleTask({ id: task.id });
      this.assertEq(reToggled.done, true, 'should be done again after third toggle');
      this.assert(reToggled.completedAt, 'should have completedAt again');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListTasks',
    doc: 'DatabaseService should list and filter tasks',
    do() {
      const service = createTestService();

      service.createTask({ title: 'task 1', priority: 1 });
      const task2 = service.createTask({ title: 'task 2', priority: 2 });
      service.completeTask({ id: task2.id });

      const allTasks = service.listTasks({});
      this.assertEq(allTasks.length, 2, 'should have 2 tasks');

      const incompleteTasks = service.listTasks({ done: false });
      this.assert(incompleteTasks.every(t => !t.done), 'should all be incomplete');

      const completeTasks = service.listTasks({ done: true });
      this.assert(completeTasks.every(t => t.done), 'should all be complete');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateReminder',
    doc: 'DatabaseService should create reminders',
    do() {
      const service = createTestService();

      const reminder = service.createReminder({
        message: 'test reminder',
        triggerAt: '2025-12-31T12:00:00Z'
      });
      this.assert(reminder.$class === 'Reminder', 'should return Reminder');
      this.assertEq(reminder.message, 'test reminder');
      this.assertEq(reminder.sent, false);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceRecurringReminder',
    doc: 'DatabaseService should create recurring reminders',
    do() {
      const service = createTestService();

      const reminder = service.createReminder({
        message: 'daily reminder',
        triggerAt: '2025-01-15T10:00:00Z',
        recurrence: { pattern: 'daily', interval: 1 }
      });
      this.assert(reminder.recurrence, 'should have recurrence');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceGetDueReminders',
    doc: 'DatabaseService should get due reminders',
    do() {
      const service = createTestService();

      // Create a past reminder (due)
      service.createReminder({ message: 'past reminder', triggerAt: '2020-01-01T00:00:00Z' });
      // Create a future reminder (not due)
      service.createReminder({ message: 'future reminder', triggerAt: '2099-01-01T00:00:00Z' });

      const dueReminders = service.getDueReminders();
      this.assert(dueReminders.length >= 1, 'should have at least 1 due reminder');
      this.assert(dueReminders.some(r => r.message === 'past reminder'), 'should include past reminder');
      this.assert(!dueReminders.some(r => r.message === 'future reminder'), 'should not include future reminder');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceMarkReminderSent',
    doc: 'DatabaseService should mark reminders as sent',
    do() {
      const service = createTestService();

      const reminder = service.createReminder({ message: 'mark me', triggerAt: '2020-01-01T00:00:00Z' });
      const marked = service.markReminderSent({ id: reminder.id });
      this.assertEq(marked.sent, true);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceSearch',
    doc: 'DatabaseService should search across all items',
    do() {
      const service = createTestService();

      service.createLog({ content: 'searchable log entry' });
      service.createTask({ title: 'searchable task' });
      service.createReminder({ message: 'searchable reminder', triggerAt: '2025-12-31T00:00:00Z' });

      const results = service.search({ query: 'searchable' });
      this.assert(results.logs.length >= 1, 'should find logs');
      this.assert(results.tasks.length >= 1, 'should find tasks');
      this.assert(results.reminders.length >= 1, 'should find reminders');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceSearchWildcard',
    doc: 'DatabaseService search with * should return all items',
    do() {
      const service = createTestService();

      service.createLog({ content: 'wildcard test log' });
      service.createTask({ title: 'wildcard test task' });

      const results = service.search({ query: '*' });
      this.assert(results.logs.length >= 1, 'should find all logs');
      this.assert(results.tasks.length >= 1, 'should find all tasks');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceChatStream',
    doc: 'DatabaseService should append and list chat messages',
    do() {
      const service = createTestService();

      const msg1 = service.appendChatMessage({
        role: 'user',
        content: 'Hello',
        source: 'test'
      });
      this.assert(msg1.id, 'should have id');
      this.assertEq(msg1.content, 'Hello');

      const msg2 = service.appendChatMessage({
        role: 'assistant',
        content: 'Hi there',
        source: 'test'
      });

      const messages = service.listChatMessages({ limit: 10 });
      this.assertEq(messages.length, 2);
      this.assertEq(messages[0].content, 'Hello');
      this.assertEq(messages[1].content, 'Hi there');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceChatReadAfter',
    doc: 'DatabaseService should read chat messages after an id',
    do() {
      const service = createTestService();

      service.appendChatMessage({ role: 'user', content: 'First', source: 'test' });
      const lastId = service.getLastChatInternalId({});

      service.appendChatMessage({ role: 'user', content: 'Second', source: 'test' });
      service.appendChatMessage({ role: 'user', content: 'Third', source: 'test' });

      const newMessages = service.readChatMessages({ afterId: lastId });
      this.assertEq(newMessages.length, 2);
      this.assertEq(newMessages[0].content, 'Second');
      this.assertEq(newMessages[1].content, 'Third');

      service.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceChatWait',
    doc: 'DatabaseService should poll for new messages',
    async do() {
      const service = createTestService();

      const lastId = service.getLastChatInternalId({});

      // Append a message after a delay
      setTimeout(() => {
        service.appendChatMessage({ role: 'user', content: 'Delayed', source: 'test' });
      }, 100);

      const newMessages = await service.waitForChatMessages({ afterId: lastId, timeoutMs: 1000 });
      this.assertEq(newMessages.length, 1);
      this.assertEq(newMessages[0].content, 'Delayed');

      service.db().close();
    }
  });

  $test.AsyncCase.new({
    name: 'DatabaseServiceChatWaitTimeout',
    doc: 'DatabaseService waitForChatMessages should return empty on timeout',
    async do() {
      const service = createTestService();

      const lastId = service.getLastChatInternalId({});
      const newMessages = await service.waitForChatMessages({ afterId: lastId, timeoutMs: 300 });
      this.assertEq(newMessages.length, 0);

      service.db().close();
    }
  });

  // Prompt service tests
  $test.Case.new({
    name: 'DatabaseServiceCreatePrompt',
    doc: 'DatabaseService should create prompts',
    do() {
      const service = createTestService();

      const prompt = service.createPrompt({
        itemType: 'task',
        itemId: 'task-123',
        message: 'Did you finish this task?'
      });
      this.assert(prompt.$class === 'Prompt', 'should return Prompt');
      this.assertEq(prompt.itemType, 'task');
      this.assertEq(prompt.itemId, 'task-123');
      this.assertEq(prompt.message, 'Did you finish this task?');
      this.assertEq(prompt.status, 'pending');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreatePromptWithContext',
    doc: 'DatabaseService should create prompts with context',
    do() {
      const service = createTestService();

      const prompt = service.createPrompt({
        itemType: 'task',
        itemId: 'task-123',
        message: 'Check on this',
        context: { daysSinceUpdate: 7, taskTitle: 'Important task' }
      });
      this.assertEq(prompt.context.daysSinceUpdate, 7);
      this.assertEq(prompt.context.taskTitle, 'Important task');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListPrompts',
    doc: 'DatabaseService should list prompts',
    do() {
      const service = createTestService();

      service.createPrompt({ itemType: 'task', itemId: '1', message: 'Prompt 1' });
      service.createPrompt({ itemType: 'task', itemId: '2', message: 'Prompt 2' });

      const prompts = service.listPrompts({});
      this.assertEq(prompts.length, 2);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListPromptsWithStatusFilter',
    doc: 'DatabaseService should filter prompts by status',
    do() {
      const service = createTestService();

      const prompt1 = service.createPrompt({ itemType: 'task', itemId: '1', message: 'Pending 1' });
      service.createPrompt({ itemType: 'task', itemId: '2', message: 'Pending 2' });
      service.updatePrompt({ id: prompt1.id, status: 'shown' });

      const pendingPrompts = service.listPrompts({ status: 'pending' });
      this.assertEq(pendingPrompts.length, 1);
      this.assertEq(pendingPrompts[0].message, 'Pending 2');

      const shownPrompts = service.listPrompts({ status: 'shown' });
      this.assertEq(shownPrompts.length, 1);
      this.assertEq(shownPrompts[0].message, 'Pending 1');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdatePrompt',
    doc: 'DatabaseService should update prompts',
    do() {
      const service = createTestService();

      const prompt = service.createPrompt({ itemType: 'task', itemId: '1', message: 'Test' });
      const updated = service.updatePrompt({
        id: prompt.id,
        status: 'actioned',
        action: 'done',
        actionedAt: new Date().toISOString()
      });

      this.assertEq(updated.status, 'actioned');
      this.assertEq(updated.action, 'done');
      this.assert(updated.actionedAt, 'should have actionedAt');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdatePromptSnooze',
    doc: 'DatabaseService should update prompt with snooze',
    do() {
      const service = createTestService();

      const prompt = service.createPrompt({ itemType: 'task', itemId: '1', message: 'Test' });
      const snoozeTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const updated = service.updatePrompt({
        id: prompt.id,
        action: 'snooze',
        snoozeUntil: snoozeTime
      });

      this.assertEq(updated.action, 'snooze');
      this.assert(updated.snoozeUntil, 'should have snoozeUntil');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdatePromptNotFound',
    doc: 'DatabaseService should throw when updating non-existent prompt',
    do() {
      const service = createTestService();

      this.assertThrows(
        () => service.updatePrompt({ id: 'nonexistent', status: 'shown' }),
        'Prompt not found',
        'should throw for non-existent prompt'
      );

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceGetPromptConfig',
    doc: 'DatabaseService should get or create prompt config',
    do() {
      const service = createTestService();

      const config = service.getPromptConfig({});
      this.assert(config.$class === 'PromptConfig', 'should return PromptConfig');
      this.assertEq(config.key, 'main');
      this.assertEq(config.promptFrequencyHours, 8);
      this.assertEq(config.maxPromptsPerCycle, 3);
      this.assertEq(config.taskStalenessDays, 7);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceGetPromptConfigIdempotent',
    doc: 'DatabaseService getPromptConfig should return same config on multiple calls',
    do() {
      const service = createTestService();

      const config1 = service.getPromptConfig({});
      const config2 = service.getPromptConfig({});

      this.assertEq(config1.id, config2.id);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdatePromptConfig',
    doc: 'DatabaseService should update prompt config',
    do() {
      const service = createTestService();

      service.getPromptConfig({});
      const updated = service.updatePromptConfig({
        promptFrequencyHours: 12,
        maxPromptsPerCycle: 5,
        taskStalenessDays: 14
      });

      this.assertEq(updated.promptFrequencyHours, 12);
      this.assertEq(updated.maxPromptsPerCycle, 5);
      this.assertEq(updated.taskStalenessDays, 14);

      const fetched = service.getPromptConfig({});
      this.assertEq(fetched.promptFrequencyHours, 12);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdatePromptConfigLastGeneration',
    doc: 'DatabaseService should update lastGenerationAt',
    do() {
      const service = createTestService();

      const now = new Date().toISOString();
      const updated = service.updatePromptConfig({ lastGenerationAt: now });

      this.assert(updated.lastGenerationAt, 'should have lastGenerationAt');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdatePromptConfigResponseHistory',
    doc: 'DatabaseService should update response history',
    do() {
      const service = createTestService();

      const history = [
        { promptId: '1', action: 'done', timestamp: new Date().toISOString() },
        { promptId: '2', action: 'dismiss', timestamp: new Date().toISOString() }
      ];
      const updated = service.updatePromptConfig({ responseHistory: history });

      this.assertEq(updated.responseHistory.length, 2);
      this.assertEq(updated.responseHistory[0].action, 'done');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceHasActivePendingPromptTrue',
    doc: 'hasActivePendingPrompt should return true when pending prompt exists',
    do() {
      const service = createTestService();

      service.createPrompt({
        itemType: 'task',
        itemId: 'task-xyz',
        message: 'Check on this task',
        status: 'pending'
      });

      const hasPending = service.hasActivePendingPrompt({
        itemType: 'task',
        itemId: 'task-xyz'
      });
      this.assertEq(hasPending, true, 'should have pending prompt');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceHasActivePendingPromptFalse',
    doc: 'hasActivePendingPrompt should return false when no pending prompt exists',
    do() {
      const service = createTestService();

      const hasPending = service.hasActivePendingPrompt({
        itemType: 'task',
        itemId: 'nonexistent'
      });
      this.assertEq(hasPending, false, 'should not have pending prompt');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceHasActivePendingPromptIgnoresNonPending',
    doc: 'hasActivePendingPrompt should ignore non-pending prompts',
    do() {
      const service = createTestService();

      const prompt = service.createPrompt({
        itemType: 'task',
        itemId: 'task-abc',
        message: 'Already actioned',
        status: 'pending'
      });
      service.updatePrompt({ id: prompt.id, status: 'actioned' });

      const hasPending = service.hasActivePendingPrompt({
        itemType: 'task',
        itemId: 'task-abc'
      });
      this.assertEq(hasPending, false, 'should not count actioned prompts');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceHasActivePendingPromptDifferentItem',
    doc: 'hasActivePendingPrompt should distinguish between different items',
    do() {
      const service = createTestService();

      service.createPrompt({
        itemType: 'task',
        itemId: 'task-1',
        message: 'Prompt for task 1',
        status: 'pending'
      });

      const hasPendingTask1 = service.hasActivePendingPrompt({ itemType: 'task', itemId: 'task-1' });
      const hasPendingTask2 = service.hasActivePendingPrompt({ itemType: 'task', itemId: 'task-2' });
      const hasPendingLog1 = service.hasActivePendingPrompt({ itemType: 'log', itemId: 'task-1' });

      this.assertEq(hasPendingTask1, true, 'should have pending for task-1');
      this.assertEq(hasPendingTask2, false, 'should not have pending for task-2');
      this.assertEq(hasPendingLog1, false, 'should not match different itemType');

      service.db().close();
    }
  });

  // Project CRUD tests (Phase 2)
  $test.Case.new({
    name: 'DatabaseServiceCreateProject',
    doc: 'DatabaseService should create projects',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Coin Cleaning', slug: 'coin-cleaning', context: 'Ancient Roman coins' });
      this.assertEq(project.$class, 'Project');
      this.assertEq(project.title, 'Coin Cleaning');
      this.assertEq(project.slug, 'coin-cleaning');
      this.assertEq(project.context, 'Ancient Roman coins');
      this.assertEq(project.archived, false);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceGetProject',
    doc: 'DatabaseService should get a project by id',
    do() {
      const service = createTestService();

      const created = service.createProject({ title: 'House Reno', slug: 'house-reno' });
      const fetched = service.getProject({ id: created.id });
      this.assertEq(fetched.id, created.id);
      this.assertEq(fetched.title, 'House Reno');
      this.assertEq(fetched.slug, 'house-reno');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceGetProjectBySlug',
    doc: 'DatabaseService should get a project by slug',
    do() {
      const service = createTestService();

      service.createProject({ title: 'Garden', slug: 'garden' });
      const fetched = service.getProjectBySlug({ slug: 'garden' });
      this.assertEq(fetched.title, 'Garden');
      this.assertEq(fetched.slug, 'garden');

      const missing = service.getProjectBySlug({ slug: 'nonexistent' });
      this.assertEq(missing, null);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListProjects',
    doc: 'DatabaseService should list projects with optional archived filter',
    do() {
      const service = createTestService();

      service.createProject({ title: 'Active Project', slug: 'active' });
      service.createProject({ title: 'Archived Project', slug: 'archived', archived: true });

      const all = service.listProjects({});
      this.assertEq(all.length, 2, 'should list all projects');

      const activeOnly = service.listProjects({ archived: false });
      this.assertEq(activeOnly.length, 1, 'should filter to active only');
      this.assertEq(activeOnly[0].title, 'Active Project');

      const archivedOnly = service.listProjects({ archived: true });
      this.assertEq(archivedOnly.length, 1, 'should filter to archived only');
      this.assertEq(archivedOnly[0].title, 'Archived Project');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdateProject',
    doc: 'DatabaseService should update a project',
    do() {
      const service = createTestService();

      const created = service.createProject({ title: 'Old Title', slug: 'proj' });
      const updated = service.updateProject({ id: created.id, title: 'New Title', context: 'updated context' });
      this.assertEq(updated.title, 'New Title');
      this.assertEq(updated.context, 'updated context');
      this.assertEq(updated.slug, 'proj');

      const refetched = service.getProject({ id: created.id });
      this.assertEq(refetched.title, 'New Title');
      this.assertEq(refetched.context, 'updated context');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdateProjectNotFound',
    doc: 'DatabaseService should throw when updating a non-existent project',
    do() {
      const service = createTestService();

      this.assertThrows(
        () => service.updateProject({ id: 'nonexistent', title: 'Nope' }),
        'Project not found',
        'should throw for non-existent project'
      );

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateTaskWithProjectId',
    doc: 'DatabaseService should create a task with projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Test Project', slug: 'test-proj' });
      const task = service.createTask({ title: 'project task', projectId: project.id });
      this.assertEq(task.projectId, project.id);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListTasksFilterByProjectId',
    doc: 'DatabaseService should filter tasks by projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Filter Project', slug: 'filter-proj' });
      service.createTask({ title: 'in project 1', projectId: project.id });
      service.createTask({ title: 'in project 2', projectId: project.id });
      service.createTask({ title: 'inbox task' });

      const projectTasks = service.listTasks({ projectId: project.id });
      this.assertEq(projectTasks.length, 2, 'should return 2 project tasks');

      const inboxTasks = service.listTasks({ projectId: null });
      this.assertEq(inboxTasks.length, 1, 'should return 1 inbox task');

      const allTasks = service.listTasks({});
      this.assertEq(allTasks.length, 3, 'should return all tasks when no projectId filter');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdateTaskProjectId',
    doc: 'DatabaseService should update a task projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Move Target', slug: 'move-target' });
      const task = service.createTask({ title: 'movable task' });
      this.assertEq(task.projectId, null);

      const updated = service.updateTask({ id: task.id, projectId: project.id });
      this.assertEq(updated.projectId, project.id);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateLogWithProjectId',
    doc: 'DatabaseService should create a log with projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Log Project', slug: 'log-proj' });
      const log = service.createLog({ content: 'project log', projectId: project.id });
      this.assertEq(log.projectId, project.id);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListLogsFilterByProjectId',
    doc: 'DatabaseService should filter logs by projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Log Filter', slug: 'log-filter' });
      service.createLog({ content: 'in project', projectId: project.id });
      service.createLog({ content: 'inbox log' });

      const projectLogs = service.listLogs({ projectId: project.id });
      this.assertEq(projectLogs.length, 1, 'should return 1 project log');
      this.assertEq(projectLogs[0].content, 'in project');

      const inboxLogs = service.listLogs({ projectId: null });
      this.assertEq(inboxLogs.length, 1, 'should return 1 inbox log');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceCreateReminderWithProjectId',
    doc: 'DatabaseService should create a reminder with projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Reminder Project', slug: 'reminder-proj' });
      const reminder = service.createReminder({
        message: 'project reminder',
        triggerAt: '2025-12-31T12:00:00Z',
        projectId: project.id
      });
      this.assertEq(reminder.projectId, project.id);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceListRemindersFilterByProjectId',
    doc: 'DatabaseService should filter reminders by projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Reminder Filter', slug: 'rem-filter' });
      service.createReminder({ message: 'in project', triggerAt: '2025-12-31T12:00:00Z', projectId: project.id });
      service.createReminder({ message: 'inbox reminder', triggerAt: '2025-12-31T12:00:00Z' });

      const projectReminders = service.listReminders({ projectId: project.id });
      this.assertEq(projectReminders.length, 1, 'should return 1 project reminder');

      const inboxReminders = service.listReminders({ projectId: null });
      this.assertEq(inboxReminders.length, 1, 'should return 1 inbox reminder');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdateLog',
    doc: 'DatabaseService should update a log projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Log Move', slug: 'log-move' });
      const log = service.createLog({ content: 'movable log' });
      this.assertEq(log.projectId, null);

      const updated = service.updateLog({ id: log.id, projectId: project.id });
      this.assertEq(updated.projectId, project.id);

      const refetched = service.getLog({ id: log.id });
      this.assertEq(refetched.projectId, project.id);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdateLogNotFound',
    doc: 'DatabaseService should throw when updating a non-existent log',
    do() {
      const service = createTestService();

      this.assertThrows(
        () => service.updateLog({ id: 'nonexistent', projectId: 'abc' }),
        'Log not found',
        'should throw for non-existent log'
      );

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdateReminder',
    doc: 'DatabaseService should update a reminder projectId',
    do() {
      const service = createTestService();

      const project = service.createProject({ title: 'Rem Move', slug: 'rem-move' });
      const reminder = service.createReminder({ message: 'movable reminder', triggerAt: '2025-12-31T12:00:00Z' });
      this.assertEq(reminder.projectId, null);

      const updated = service.updateReminder({ id: reminder.id, projectId: project.id });
      this.assertEq(updated.projectId, project.id);

      const refetched = service.getReminder({ id: reminder.id });
      this.assertEq(refetched.projectId, project.id);

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceUpdateReminderNotFound',
    doc: 'DatabaseService should throw when updating a non-existent reminder',
    do() {
      const service = createTestService();

      this.assertThrows(
        () => service.updateReminder({ id: 'nonexistent', projectId: 'abc' }),
        'Reminder not found',
        'should throw for non-existent reminder'
      );

      service.db().close();
    }
  });
}.module({
  name: 'test.services.database',
  imports: [base, test, db, helpers, sqlite, models, database],
}).load();
