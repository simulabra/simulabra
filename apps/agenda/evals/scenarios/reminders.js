import { __, base } from 'simulabra';
import framework from '../framework.js';

export default await async function (_, $, $framework) {
  $framework.EvalCase.new({
    title: 'Create a reminder',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'remind me tomorrow at 3pm to call the contractor'
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'create_reminder');
      const snap = await ctx.snapshot();
      const reminder = snap.reminders.find(r =>
        r.message?.toLowerCase().includes('contractor')
      );
      if (!reminder) {
        throw new Error('Expected a reminder mentioning "contractor" in the DB');
      }
    }
  });

  $framework.EvalCase.new({
    title: 'Create recurring reminder',
    async scenario(ctx) {
      const result = await ctx.interpret(
        'remind me every morning at 8am to check email'
      );
      if (!result.success) throw new Error(`interpret failed: ${result.error}`);
      ctx.assertToolCalled(result, 'create_reminder');
      const snap = await ctx.snapshot();
      const recurring = snap.reminders.find(r =>
        r.message?.toLowerCase().includes('email') && r.recurrence
      );
      if (!recurring) {
        throw new Error('Expected a recurring reminder about "email" in the DB');
      }
    }
  });
}.module({
  name: 'eval.scenarios.reminders',
  imports: [base, framework],
}).load();
