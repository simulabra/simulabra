import { __, base } from 'simulabra';
import framework from '../framework.js';

export default await async function (_, $, $framework) {
  $framework.EvalCase.new({
    title: 'Bare keyword task',
    async scenario(ctx) {
      const result = await ctx.interpret('task fix the squeaky door');
      if (!result.success) {
        throw new Error(`interpret failed: ${result.error}`);
      }
      ctx.assertToolCalled(result, 'create_task');
      ctx.assertToolNotCalled(result, 'create_log');
    }
  });

  $framework.EvalCase.new({
    title: 'Bare keyword log',
    async scenario(ctx) {
      const result = await ctx.interpret('log decided to go with the blue paint');
      if (!result.success) {
        throw new Error(`interpret failed: ${result.error}`);
      }
      ctx.assertToolCalled(result, 'create_log');
      ctx.assertToolNotCalled(result, 'create_task');
    }
  });

  $framework.EvalCase.new({
    title: 'Question that should read not write',
    async scenario(ctx) {
      const result = await ctx.interpret('what should I work on next?');
      if (!result.success) {
        throw new Error(`interpret failed: ${result.error}`);
      }
      ctx.assertToolNotCalled(result, 'create_task');
      ctx.assertToolNotCalled(result, 'create_log');
      ctx.assertToolNotCalled(result, 'create_project');
    }
  });

  $framework.EvalCase.new({
    title: 'Ambiguous verb no keyword',
    async scenario(ctx) {
      const result = await ctx.interpret('look into getting the roof inspected');
      if (!result.success) {
        throw new Error(`interpret failed: ${result.error}`);
      }
      const created = result.toolsExecuted?.some(t =>
        t.tool === 'create_task' || t.tool === 'create_log'
      );
      if (!created) {
        throw new Error(
          `Expected create_task or create_log, got: ${(result.toolsExecuted || []).map(t => t.tool).join(', ') || 'none'}`
        );
      }
    }
  });

  $framework.EvalCase.new({
    title: 'Casual project creation no keyword',
    async scenario(ctx) {
      const result = await ctx.interpret('make a project for meal planning');
      if (!result.success) {
        throw new Error(`interpret failed: ${result.error}`);
      }
      ctx.assertToolCalled(result, 'create_project');
      ctx.assertToolNotCalled(result, 'create_task');
    }
  });
}.module({
  name: 'eval.scenarios.realistic',
  imports: [base, framework],
}).load();
