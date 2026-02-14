import { __, base } from 'simulabra';
import framework from '../framework.js';

export default await async function (_, $, $framework) {
  $framework.EvalCase.new({
    title: 'Create a log entry',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'note: found a great deal on running shoes at REI'
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'create_log');
      const snap = await ctx.snapshot();
      const logEntry = snap.logs.find(l =>
        l.content?.toLowerCase().includes('running shoes')
      );
      if (!logEntry) {
        throw new Error('Expected a log entry mentioning "running shoes" in the DB');
      }
    }
  });

  $framework.EvalCase.new({
    title: 'Search logs by keyword',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'search for anything about the bun release'
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'search');
    }
  });
}.module({
  name: 'eval.scenarios.logs',
  imports: [base, framework],
}).load();
