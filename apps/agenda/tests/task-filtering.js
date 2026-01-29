import { __, base } from 'simulabra';
import test from 'simulabra/test';
import db from 'simulabra/db';
import helpers from './support/helpers.js';
import sqlite from '../src/sqlite.js';
import models from '../src/models.js';
import database from '../src/services/database.js';

export default await async function (_, $, $test, $db, $helpers, $sqlite, $models, $database) {
  const createTestService = () => {
    const service = $database.DatabaseService.new({
      uid: 'TestFilterService',
      dbPath: ':memory:'
    });
    service.initDatabase();
    return service;
  };

  function makeTasks() {
    const now = Date.now();
    return [
      { id: '1', title: 'p1 active', done: false, priority: 1, completedAt: null },
      { id: '2', title: 'p2 active', done: false, priority: 2, completedAt: null },
      { id: '3', title: 'p3 active', done: false, priority: 3, completedAt: null },
      { id: '4', title: 'p4 backlog', done: false, priority: 4, completedAt: null },
      { id: '5', title: 'p5 backlog', done: false, priority: 5, completedAt: null },
      { id: '6', title: 'done recent 1', done: true, priority: 2, completedAt: new Date(now - 1000).toISOString() },
      { id: '7', title: 'done recent 2', done: true, priority: 1, completedAt: new Date(now - 2000).toISOString() },
      { id: '8', title: 'done recent 3', done: true, priority: 3, completedAt: new Date(now - 3000).toISOString() },
      { id: '9', title: 'done old', done: true, priority: 2, completedAt: new Date(now - 100000).toISOString() },
    ];
  }

  function filterTasks(tasks, mode) {
    if (mode === 'active') {
      const items = tasks
        .filter(t => !t.done && (t.priority || 3) <= 3)
        .sort((a, b) => (a.priority || 3) - (b.priority || 3));
      const recentDone = tasks
        .filter(t => t.done && t.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 3);
      return { items, recentDone };
    } else if (mode === 'backlog') {
      const items = tasks
        .filter(t => !t.done && (t.priority || 3) > 3)
        .sort((a, b) => (a.priority || 3) - (b.priority || 3));
      return { items, recentDone: [] };
    } else if (mode === 'completed') {
      const items = tasks
        .filter(t => t.done)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      return { items, recentDone: [] };
    }
    return { items: [], recentDone: [] };
  }

  $test.Case.new({
    name: 'ActiveFilterReturnsP1P2P3',
    doc: 'Active mode returns only incomplete tasks with priority <= 3',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'active');
      this.assertEq(result.items.length, 3, 'should have 3 active tasks');
      this.assert(result.items.every(t => !t.done), 'all should be incomplete');
      this.assert(result.items.every(t => t.priority <= 3), 'all should be p1-p3');
    }
  });

  $test.Case.new({
    name: 'ActiveFilterSortsByPriority',
    doc: 'Active mode sorts incomplete tasks by priority ascending',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'active');
      this.assertEq(result.items[0].priority, 1, 'first should be p1');
      this.assertEq(result.items[1].priority, 2, 'second should be p2');
      this.assertEq(result.items[2].priority, 3, 'third should be p3');
    }
  });

  $test.Case.new({
    name: 'ActiveFilterIncludesRecentlyCompleted',
    doc: 'Active mode includes exactly 3 most recently completed tasks',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'active');
      this.assertEq(result.recentDone.length, 3, 'should have 3 recently completed');
      this.assert(result.recentDone.every(t => t.done), 'all should be completed');
      this.assertEq(result.recentDone[0].title, 'done recent 1', 'most recent first');
      this.assertEq(result.recentDone[1].title, 'done recent 2', 'second most recent');
      this.assertEq(result.recentDone[2].title, 'done recent 3', 'third most recent');
    }
  });

  $test.Case.new({
    name: 'ActiveFilterExcludesOldCompleted',
    doc: 'Active mode recent done list excludes the 4th oldest completed task',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'active');
      const titles = result.recentDone.map(t => t.title);
      this.assert(!titles.includes('done old'), 'should not include old completed task');
    }
  });

  $test.Case.new({
    name: 'BacklogFilterReturnsP4P5',
    doc: 'Backlog mode returns only incomplete tasks with priority > 3',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'backlog');
      this.assertEq(result.items.length, 2, 'should have 2 backlog tasks');
      this.assert(result.items.every(t => !t.done), 'all should be incomplete');
      this.assert(result.items.every(t => t.priority > 3), 'all should be p4-p5');
    }
  });

  $test.Case.new({
    name: 'BacklogFilterExcludesP1P2P3',
    doc: 'Backlog mode excludes p1-p3 tasks',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'backlog');
      this.assert(!result.items.some(t => t.priority <= 3), 'should not include p1-p3');
    }
  });

  $test.Case.new({
    name: 'BacklogFilterSortsByPriority',
    doc: 'Backlog mode sorts by priority ascending',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'backlog');
      this.assertEq(result.items[0].priority, 4, 'first should be p4');
      this.assertEq(result.items[1].priority, 5, 'second should be p5');
    }
  });

  $test.Case.new({
    name: 'CompletedFilterReturnsAllDone',
    doc: 'Completed mode returns all completed tasks',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'completed');
      this.assertEq(result.items.length, 4, 'should have 4 completed tasks');
      this.assert(result.items.every(t => t.done), 'all should be completed');
    }
  });

  $test.Case.new({
    name: 'CompletedFilterSortsByCompletedAtDescending',
    doc: 'Completed mode sorts by completedAt descending',
    do() {
      const tasks = makeTasks();
      const result = filterTasks(tasks, 'completed');
      for (let i = 1; i < result.items.length; i++) {
        const prev = new Date(result.items[i - 1].completedAt).getTime();
        const curr = new Date(result.items[i].completedAt).getTime();
        this.assert(prev >= curr, 'should be sorted by completedAt descending');
      }
    }
  });

  $test.Case.new({
    name: 'ActiveFilterEmptyTasks',
    doc: 'Active mode handles empty task list',
    do() {
      const result = filterTasks([], 'active');
      this.assertEq(result.items.length, 0, 'no active tasks');
      this.assertEq(result.recentDone.length, 0, 'no recent done tasks');
    }
  });

  $test.Case.new({
    name: 'ActiveFilterFewerThanThreeCompleted',
    doc: 'Active mode handles fewer than 3 completed tasks',
    do() {
      const tasks = [
        { id: '1', title: 'active', done: false, priority: 1, completedAt: null },
        { id: '2', title: 'done', done: true, priority: 2, completedAt: new Date().toISOString() },
      ];
      const result = filterTasks(tasks, 'active');
      this.assertEq(result.items.length, 1, 'one active task');
      this.assertEq(result.recentDone.length, 1, 'one recent done task');
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceMaxPriorityFilter',
    doc: 'listTasks should filter by maxPriority',
    do() {
      const service = createTestService();

      service.createTask({ title: 'p1 task', priority: 1 });
      service.createTask({ title: 'p2 task', priority: 2 });
      service.createTask({ title: 'p3 task', priority: 3 });
      service.createTask({ title: 'p4 task', priority: 4 });
      service.createTask({ title: 'p5 task', priority: 5 });

      const filtered = service.listTasks({ maxPriority: 3 });
      this.assertEq(filtered.length, 3, 'should have 3 tasks with priority <= 3');
      this.assert(filtered.every(t => t.priority <= 3), 'all should have priority <= 3');

      const all = service.listTasks({});
      this.assertEq(all.length, 5, 'unfiltered should have all 5 tasks');

      service.db().close();
    }
  });

  $test.Case.new({
    name: 'DatabaseServiceMaxPriorityWithDoneFilter',
    doc: 'listTasks should combine maxPriority with done filter',
    do() {
      const service = createTestService();

      const t1 = service.createTask({ title: 'p1 task', priority: 1 });
      service.createTask({ title: 'p2 task', priority: 2 });
      service.createTask({ title: 'p4 task', priority: 4 });
      service.completeTask({ id: t1.id });

      const activeLow = service.listTasks({ done: false, maxPriority: 3 });
      this.assertEq(activeLow.length, 1, 'should have 1 incomplete p1-p3 task');
      this.assertEq(activeLow[0].title, 'p2 task');

      service.db().close();
    }
  });

}.module({
  name: 'test.task-filtering',
  imports: [base, test, db, helpers, sqlite, models, database],
}).load();
