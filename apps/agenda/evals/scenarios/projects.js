import { __, base } from 'simulabra';
import framework from '../framework.js';

export default await async function (_, $, $framework) {
  $framework.EvalCase.new({
    title: 'Create project with context',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'create a project called reading list for tracking books I want to read'
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'create_project');
      const snap = await ctx.snapshot();
      const proj = snap.projects.find(p =>
        p.title?.toLowerCase().includes('reading')
      );
      if (!proj) {
        throw new Error('Expected a project mentioning "reading" in the DB');
      }
    }
  });

  $framework.EvalCase.new({
    title: 'List projects',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'show me my projects'
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'list_projects');
    }
  });

  $framework.EvalCase.new({
    title: 'Move item to project',
    async scenario(ctx) {
      const taskId = ctx.seed.tasks.callDentist.id;
      const projectId = ctx.seed.projects.fitness.id;
      const result = await ctx.interpret(
        `move task ${taskId} to project ${projectId}`
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'move_to_project');
    }
  });
}.module({
  name: 'eval.scenarios.projects',
  imports: [base, framework],
}).load();
