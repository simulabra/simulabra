import { __, base } from 'simulabra';
import framework from '../framework.js';

export default await async function (_, $, $framework) {
  $framework.EvalCase.new({
    title: 'Create a task from natural language',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'add a task: buy new kitchen tiles, high priority, for the house renovation project'
      );
      if (!result.success) {
        throw new Error(`interpret failed: ${result.error}`);
      }
      ctx.assertToolCalled(result, 'create_task');
    }
  });

  $framework.EvalCase.new({
    title: 'Search for existing items',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'find my notes about countertops'
      );
      if (!result.success) {
        throw new Error(`interpret failed: ${result.error}`);
      }
      ctx.assertToolCalled(result, 'search');
    }
  });

  $framework.EvalCase.new({
    title: 'Create a new project',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'start a new project called garden for landscaping the backyard'
      );
      if (!result.success) {
        throw new Error(`interpret failed: ${result.error}`);
      }
      ctx.assertToolCalled(result, 'create_project');
    }
  });
}.module({
  name: 'eval.scenarios.basic',
  imports: [base, framework],
}).load();
