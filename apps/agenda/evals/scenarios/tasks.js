import { __, base } from 'simulabra';
import framework from '../framework.js';

export default await async function (_, $, $framework) {
  $framework.EvalCase.new({
    title: 'Create task with priority and due date',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'I need to file taxes by april 15, make it high priority'
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'create_task');
      const snap = await ctx.snapshot();
      const taxTask = snap.tasks.find(t =>
        t.title?.toLowerCase().includes('tax')
      );
      if (!taxTask) {
        throw new Error('Expected a task mentioning "tax" in the DB');
      }
    }
  });

  $framework.EvalCase.new({
    title: 'Complete a task by description',
    async scenario(ctx) {
      const taskId = ctx.seed.tasks.getPlumberQuote.id;
      const result = await ctx.interpret(
        `complete task ${taskId}`
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'complete_task');
    }
  });

  $framework.EvalCase.new({
    title: 'Update task priority',
    async scenario(ctx) {
      const taskId = ctx.seed.tasks.planWorkout.id;
      const result = await ctx.interpret(
        `update task ${taskId}, set priority to 1`
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'update_task');
    }
  });

  $framework.EvalCase.new({
    title: 'List tasks with filter',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'show me my high priority tasks'
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'list_tasks');
    }
  });
}.module({
  name: 'eval.scenarios.tasks',
  imports: [base, framework],
}).load();
